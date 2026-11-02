import { createHash, randomUUID } from 'node:crypto';
import { FieldPath, FieldValue, Timestamp, getFirestore, type DocumentReference } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { getFunctions } from 'firebase-admin/functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onTaskDispatched } from 'firebase-functions/tasks';
import { defineString } from 'firebase-functions/params';
import { RoutingError, ROUTING_CONSENT_VERSION, ROUTING_LIMITS } from './contracts';
import type { RouteCandidateV1, RouteRequestV1, ValidatedRouteV1 } from './contracts';
import { parseRouteRequest, validateRoute } from './validation';
import { isOperatorConfig, operatorRoutingBase, operatorRoutingUrl, parseBRouterTrack } from './freeRoute';
import { consumeRoutingLimit } from './placeSearch';
import { prepareWalletMutation } from '../wallet/firestoreLedger';
import { chooseRouteCandidate, RouteAiProviderError, scoreRouteCandidates, routeAiApiKey, routeAiModel, routeAiProvider, routeAiSecrets, routePremiumRelease } from './aiProvider';
import { fetchOpenRouteServiceCandidates, OpenRouteServiceError, routeEngine, routeProviderApiKey, routeProviderSecrets } from './openRouteService';

const baseUrl = defineString('BROUTER_BASE_URL', { default: '' });
const database = () => getFirestore();
const privateBucket = () => getStorage().bucket();
const QUOTE_TTL_MS = 5 * 60_000;
const JOB_LEASE_MS = 10 * 60_000;
const MAX_JOB_ATTEMPTS = 5;
const TASK_DISPATCH_DEADLINE_SECONDS = 5 * 60;
const OUTBOX_BATCH_SIZE = 100;

function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
function parsePremiumRequest(value: unknown): RouteRequestV1 {
  try {
    const request = parseRouteRequest(value);
    if (request.planning !== 'ai' || request.kind !== 'destination') throw new RoutingError('PREMIUM_REQUIRED');
    if (request.criteria.hard.length) throw new RoutingError('UNSUPPORTED_CRITERIA', 'Harte Vorgaben sind für diesen Premium-Router noch nicht nachweisbar.');
    if (request.criteria.surfacePreference !== 'any' || request.criteria.wishes.trim() || request.interests.length
      || request.criteria.weights.asphalt !== 0 || request.criteria.weights.nature !== 0
      || request.profile.batteryPercent !== null || request.profile.batteryCapacityWh !== null) {
      throw new RoutingError('UNSUPPORTED_CRITERIA', 'Oberfläche, Freitext, Interessen und Akku werden noch nicht mit geprüften Routendaten bewertet; diese Anfrage wird nicht belastet.');
    }
    if (request.profile.consentVersion !== String(ROUTING_CONSENT_VERSION)) throw new RoutingError('CONSENT_REQUIRED');
    return request;
  } catch (error) {
    if (error instanceof RoutingError) throw new HttpsError('failed-precondition', error.message, { routingCode: error.code });
    throw new HttpsError('invalid-argument', 'Invalid premium route request.');
  }
}
async function assertReleased(): Promise<Record<string, any>> {
  const config: Record<string, any> = (await database().collection('routing_config').doc('current').get()).data() ?? {};
  const extendedConfig = config as Record<string, any>;
  if (routePremiumRelease.value() !== 'true' || config.premiumEnabled !== true || config.premiumProviderVerified !== true
    || !routeAiProvider.value() || !routeAiModel.value()) {
    throw new HttpsError('failed-precondition', 'Premium-Routenplanung ist für diese Umgebung nicht freigegeben.');
  }
  if (!['brouter', 'openrouteservice'].includes(routeEngine.value())) throw new HttpsError('failed-precondition', 'Premium-Straßenrouter ist ungültig konfiguriert.');
  if (routeEngine.value() === 'brouter') {
    let validUrl = false;
    try { operatorRoutingBase(baseUrl.value()); validUrl = true; } catch { /* fail closed below */ }
    if (!isOperatorConfig(config) || !validUrl) throw new HttpsError('failed-precondition', 'BRouter ist ohne bestätigte Betreiberkonfiguration gesperrt.');
  }
  if (routeEngine.value() === 'openrouteservice' && (extendedConfig.premiumRouterVerified !== true || !routeProviderApiKey.value())) {
    throw new HttpsError('failed-precondition', 'OpenRouteService ist ohne bestätigte Betreiberkonfiguration und API-Schlüssel gesperrt.');
  }
  if (!['vertex', 'gemini', 'openai', 'anthropic'].includes(routeAiProvider.value())) throw new HttpsError('failed-precondition', 'KI-Anbieter ist ungültig konfiguriert.');
  if (routeAiProvider.value() !== 'vertex' && !routeAiApiKey.value()) throw new HttpsError('failed-precondition', 'Für den gewählten KI-Anbieter fehlt der serverseitige API-Schlüssel.');
  return config;
}
function userOwnedRef(collection: string, uid: string, id: string) { return database().collection(collection).doc(digest(`${uid}:${id}`)); }
function safeOperatorConfig(value: unknown) {
  if (!isOperatorConfig(value)) return null;
  return { freeEnabled: true as const, gate0Verified: true as const, engineVersion: value.engineVersion,
    dataVersion: value.dataVersion, coverageId: value.coverageId, bounds: { ...value.bounds } };
}
function selectedProviderSecrets() {
  // Jobs can outlive a quote or a deployment-level provider change. Bind every supported
  // credential to the worker so the persisted provider choice remains executable.
  return [...routeAiSecrets, ...routeProviderSecrets];
}
async function enqueuePremiumRoute(jobId: string): Promise<void> {
  await getFunctions().taskQueue('locations/europe-west3/functions/processPremiumRoute').enqueue({ jobId }, {
    dispatchDeadlineSeconds: TASK_DISPATCH_DEADLINE_SECONDS,
  });
}
async function updatePendingOutbox(ref: DocumentReference, patch: Record<string, unknown>): Promise<void> {
  await database().runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists && snapshot.data()?.state === 'pending') tx.set(ref, patch, { merge: true });
  });
}

export const quotePremiumRoute = onCall({ region: 'europe-west3', enforceAppCheck: true, secrets: selectedProviderSecrets() }, async request => {
  if (!request.app || !request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication and App Check required.');
  const config = await assertReleased();
  const uid = request.auth.uid;
  const [suspended, deletion] = await Promise.all([
    database().collection('suspended_users').doc(uid).get(),
    database().collection('account_deletion_locks').doc(digest(uid)).get(),
  ]);
  if (suspended.exists || deletion.exists) throw new HttpsError('permission-denied', 'Account is not eligible for premium routing.');
  const route = parsePremiumRequest(request.data?.route);
  const requestHash = digest(stableJson(route));
  const rawPrice = config.premiumTokenPrice ?? ROUTING_LIMITS.defaultTokenPrice;
  if (!Number.isSafeInteger(rawPrice) || rawPrice < 1 || rawPrice > 100) throw new HttpsError('failed-precondition', 'Premiumpreis ist ungültig konfiguriert.');
  const quoteId = randomUUID(), expiresAt = Date.now() + QUOTE_TTL_MS;
  const ref = userOwnedRef('premium_route_quotes', uid, quoteId);
  const routerProvider = routeEngine.value(), aiProvider = routeAiProvider.value(), aiModel = routeAiModel.value();
  const routerBaseUrl = routerProvider === 'brouter' ? operatorRoutingBase(baseUrl.value()).origin : null;
  const safeRoutingConfig = { operator: safeOperatorConfig(config),
    premiumRouterVerified: (config as Record<string, unknown>).premiumRouterVerified === true };
  const routingConfigHash = digest(stableJson(safeRoutingConfig));
  await ref.create({ userId: uid, quoteId, requestHash, routerProvider, aiProvider, aiModel, routerBaseUrl,
    safeRoutingConfig, routingConfigHash, amount: rawPrice,
    priceVersion: 'v1', createdAt: FieldValue.serverTimestamp(), expiresAt });
  return { quoteId, amount: rawPrice, currency: 'token', priceVersion: 'v1', expiresAt,
    provider: aiProvider, model: aiModel, routerProvider };
});

async function brouterCandidate(route: RouteRequestV1, config: unknown, pinnedBaseUrl: string, index: number): Promise<RouteCandidateV1> {
  if (!isOperatorConfig(config)) throw new HttpsError('failed-precondition', 'Betreiberrouting ist nicht freigegeben.');
  let url: string;
  try { url = operatorRoutingUrl(pinnedBaseUrl, route, index); }
  catch { throw new HttpsError('unavailable', 'Betreiberrouting ist nicht erreichbar.'); }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok || !response.body) throw new HttpsError('unavailable', 'Keine Routeralternative verfügbar.');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, body = '';
    try {
      for (;;) {
        const item = await reader.read(); if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > ROUTING_LIMITS.maxArtifactBytes) { await reader.cancel(); throw new HttpsError('resource-exhausted', 'Routerantwort überschreitet das Größenlimit.'); }
        body += decoder.decode(item.value, { stream: true });
      }
      body += decoder.decode();
    } finally { reader.releaseLock(); }
    return parseBRouterTrack(JSON.parse(body), route, config, index);
  } finally { clearTimeout(timer); }
}
async function loadArtifact(path: string, expectedHash: string): Promise<ValidatedRouteV1> {
  const [bytes] = await privateBucket().file(path).download();
  if (digest(bytes.toString('utf8')) !== expectedHash) throw new HttpsError('data-loss', 'Routenartefakt-Prüfsumme stimmt nicht.');
  return JSON.parse(bytes.toString('utf8')) as ValidatedRouteV1;
}
async function responseFor(job: Record<string, any>) {
  const selected = job.artifacts.find((artifact: any) => artifact.id === job.selectedCandidateId);
  if (!selected) throw new HttpsError('data-loss', 'Gespeicherte Routenauswahl fehlt.');
  return { jobId: job.jobId, status: job.state, route: await loadArtifact(selected.path, selected.sha256),
    alternatives: job.artifacts.map((artifact: any) => ({ id: artifact.id, selected: artifact.id === job.selectedCandidateId,
      distanceM: artifact.distanceM, ascentM: artifact.ascentM, durationS: artifact.durationS })), planningEvidence: job.planningEvidence };
}

export const createPremiumRoute = onCall({ region: 'europe-west3', enforceAppCheck: true, timeoutSeconds: 180,
  memory: '1GiB', maxInstances: 10, secrets: selectedProviderSecrets() }, async request => {
  if (!request.app || !request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication and App Check required.');
  const uid = request.auth.uid;
  await assertReleased();
  const route = parsePremiumRequest(request.data?.route), requestHash = digest(stableJson(route));
  if (typeof request.data?.quoteId !== 'string' || request.data.quoteId.length > 80
    || !['shorter', 'flatter', 'faster', null].includes(request.data?.userSelectedPriority)) {
    throw new HttpsError('invalid-argument', 'Quote or priority is invalid.');
  }
  const quoteId = request.data.quoteId as string;
  const priority = request.data.userSelectedPriority as 'shorter' | 'flatter' | 'faster' | null;
  await consumeRoutingLimit({ auth: { uid }, ip: request.rawRequest.ip }, 'route');
  const jobId = digest(`${uid}:${route.requestId}`), jobRef = database().collection('premium_route_jobs').doc(jobId);
  const quoteRef = userOwnedRef('premium_route_quotes', uid, quoteId), activeRef = database().collection('premium_route_active').doc(digest(uid));
  const routingConfigRef = database().collection('routing_config').doc('current');
  const outboxRef = database().collection('premium_route_outbox').doc(jobId);
  let job: Record<string, any>;
  job = await database().runTransaction(async tx => {
    const [existing, quote, active, suspended, deletion, routingConfigSnapshot] = await Promise.all([tx.get(jobRef), tx.get(quoteRef), tx.get(activeRef),
      tx.get(database().collection('suspended_users').doc(uid)), tx.get(database().collection('account_deletion_locks').doc(digest(uid))),
      tx.get(routingConfigRef)]);
    if (suspended.exists || deletion.exists) throw new HttpsError('permission-denied', 'Account is not eligible for premium routing.');
    if (existing.exists) {
      const value = existing.data()!;
      if (value.userId !== uid || value.requestHash !== requestHash || value.priority !== priority) throw new HttpsError('already-exists', 'Idempotency key conflicts with a different request.');
      if (value.state === 'ready' || value.state === 'queued' || value.state === 'running') return value;
      throw new HttpsError('failed-precondition', 'Dieser idempotente Premiumauftrag ist bereits beendet. Bitte starte eine neue Anfrage.');
    }
    if (!quote.exists || quote.data()?.userId !== uid || quote.data()?.quoteId !== quoteId
      || quote.data()?.requestHash !== requestHash || quote.data()?.expiresAt <= Date.now()
      || !['brouter', 'openrouteservice'].includes(quote.data()?.routerProvider)
      || !['vertex', 'gemini', 'openai', 'anthropic'].includes(quote.data()?.aiProvider)
      || typeof quote.data()?.aiModel !== 'string' || !quote.data()?.aiModel) throw new HttpsError('failed-precondition', 'Angebot fehlt, ist abgelaufen oder passt nicht mehr zur Anfrage.');
    const currentConfig = routingConfigSnapshot.data() ?? {};
    const currentSafeConfig = { operator: safeOperatorConfig(currentConfig),
      premiumRouterVerified: currentConfig.premiumRouterVerified === true };
    if (quote.data()?.routingConfigHash !== digest(stableJson(currentSafeConfig))
      || quote.data()?.routerProvider !== routeEngine.value()) {
      throw new HttpsError('failed-precondition', 'Routingkonfiguration hat sich seit dem Angebot geändert. Bitte erneut anfragen.');
    }
    if (active.exists) throw new HttpsError('resource-exhausted', 'Es läuft bereits ein Premiumauftrag.');
    const subscription = await tx.get(database().collection('subscriptions').doc(uid));
    if (subscription.data()?.status !== 'active') throw new HttpsError('permission-denied', 'Aktives Premiumabo erforderlich.');
    const reserve = await prepareWalletMutation(database(), tx, uid, { operation: 'reserve', amount: quote.data()!.amount, reference: jobId });
    reserve.commit();
    const value = { userId: uid, jobId, requestId: route.requestId, requestHash, request: route, quoteId, priority,
      routerProvider: quote.data()!.routerProvider,
      routerBaseUrl: quote.data()!.routerBaseUrl, safeRoutingConfig: quote.data()!.safeRoutingConfig,
      routingConfigHash: quote.data()!.routingConfigHash,
      aiProvider: quote.data()!.aiProvider, aiModel: quote.data()!.aiModel,
      amount: quote.data()!.amount, state: 'queued', runId: null, attempts: 0, leaseUntil: Date.now() + JOB_LEASE_MS,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
    tx.create(jobRef, value);
    tx.create(activeRef, { userId: uid, jobId, state: 'queued', leaseUntil: value.leaseUntil });
    tx.create(outboxRef, { jobId, userId: uid, state: 'pending', attempts: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(quoteRef, { consumedAt: FieldValue.serverTimestamp(), jobId });
    return value;
  });
  if (job.state === 'ready') return responseFor(job);
  // The durable outbox lets the scheduler recover the narrow crash window between the Firestore
  // reservation transaction and Cloud Tasks enqueue. Duplicate task delivery is handled by the worker lease.
  try {
    await enqueuePremiumRoute(jobId);
    await updatePendingOutbox(outboxRef, { state: 'enqueued', updatedAt: FieldValue.serverTimestamp() });
  } catch {
    await updatePendingOutbox(outboxRef, { attempts: FieldValue.increment(1), lastEnqueueFailureAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
  return { jobId, status: job.state };
});

function isPermanentPremiumFailure(error: unknown): boolean {
  if (error instanceof OpenRouteServiceError) return !error.retryable;
  if (error instanceof RouteAiProviderError) return !error.retryable;
  if (!(error instanceof HttpsError)) return false;
  return ['invalid-argument', 'permission-denied', 'failed-precondition', 'not-found', 'data-loss'].includes(error.code);
}

export const processPremiumRoute = onTaskDispatched({ region: 'europe-west3', timeoutSeconds: 300,
  memory: '1GiB', maxInstances: 10, invoker: 'private', secrets: selectedProviderSecrets(),
  retryConfig: { maxAttempts: MAX_JOB_ATTEMPTS, minBackoffSeconds: 15, maxBackoffSeconds: 300, maxDoublings: 5 },
  rateLimits: { maxConcurrentDispatches: 10 } }, async task => {
  const jobId = task.data?.jobId;
  if (typeof jobId !== 'string' || !/^[a-f0-9]{64}$/.test(jobId)) throw new HttpsError('invalid-argument', 'Invalid premium route task.');
  const jobRef = database().collection('premium_route_jobs').doc(jobId), snapshot = await jobRef.get(), initial = snapshot.data();
  if (!initial || !initial.userId) return;
  const uid = initial.userId as string, activeRef = database().collection('premium_route_active').doc(digest(uid));
  const outboxRef = database().collection('premium_route_outbox').doc(jobId), runId = randomUUID();
  const claimed: Record<string, any> | null = await database().runTransaction(async tx => {
    const [currentSnapshot, activeSnapshot, suspended, deletion] = await Promise.all([tx.get(jobRef), tx.get(activeRef),
      tx.get(database().collection('suspended_users').doc(uid)), tx.get(database().collection('account_deletion_locks').doc(digest(uid)))]);
    const current = currentSnapshot.data(), active = activeSnapshot.data();
    if (!current || current.userId !== uid || ['ready', 'failed', 'cancelled'].includes(current.state)) return null;
    if (current.state === 'running' && current.leaseUntil > Date.now()) return null;
    if (current.state !== 'queued' && current.state !== 'running') return null;
    if (current.attempts >= MAX_JOB_ATTEMPTS) {
      const release = await prepareWalletMutation(database(), tx, uid, { operation: 'release', amount: current.amount, reference: jobId });
      release.commit();
      tx.update(jobRef, { state: 'failed', failureCode: 'attempt_limit_reached', leaseUntil: 0, updatedAt: FieldValue.serverTimestamp() });
      if (activeSnapshot.exists && active?.jobId === jobId) tx.delete(activeRef);
      tx.set(outboxRef, { state: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return null;
    }
    if (!activeSnapshot.exists || active?.jobId !== jobId) {
      const release = await prepareWalletMutation(database(), tx, uid, { operation: 'release', amount: current.amount, reference: jobId });
      release.commit();
      tx.update(jobRef, { state: 'failed', failureCode: 'active_job_lock_missing', leaseUntil: 0, updatedAt: FieldValue.serverTimestamp() });
      tx.set(outboxRef, { state: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return null;
    }
    if (suspended.exists || deletion.exists) {
      const release = await prepareWalletMutation(database(), tx, uid, { operation: 'release', amount: current.amount, reference: jobId });
      release.commit();
      tx.update(jobRef, { state: 'failed', failureCode: 'account_not_eligible', leaseUntil: 0, updatedAt: FieldValue.serverTimestamp() });
      tx.delete(activeRef);
      tx.set(outboxRef, { state: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return null;
    }
    const next = { ...current, state: 'running', runId, attempts: current.attempts + 1,
      leaseUntil: Date.now() + JOB_LEASE_MS, updatedAt: FieldValue.serverTimestamp() };
    tx.set(jobRef, next);
    tx.set(activeRef, { userId: uid, jobId, state: 'running', runId, leaseUntil: next.leaseUntil });
    tx.set(outboxRef, { state: 'processing', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return next;
  });
  if (!claimed) return;

  const uploaded: string[] = [];
  try {
    const route = claimed.request as RouteRequestV1;
    const priority = claimed.priority as 'shorter' | 'flatter' | 'faster' | null;
    const pinnedConfig = claimed.safeRoutingConfig as { operator: unknown; premiumRouterVerified: boolean };
    const candidates = claimed.routerProvider === 'openrouteservice'
      ? pinnedConfig.premiumRouterVerified
      ? await fetchOpenRouteServiceCandidates(route, routeProviderApiKey.value())
      : (() => { throw new HttpsError('failed-precondition', 'Gespeicherter OpenRouteService-Status ist ungültig.'); })()
      : claimed.routerProvider === 'brouter'
        ? await Promise.all([0, 1, 2].map(index => brouterCandidate(route, pinnedConfig.operator, claimed.routerBaseUrl, index).catch(() => null)))
        : (() => { throw new HttpsError('failed-precondition', 'Gespeicherter Premiumrouter ist ungültig.'); })();
    const sha = async (text: string) => createHash('sha256').update(text).digest('hex');
    const valid: ValidatedRouteV1[] = [];
    for (const candidate of candidates) {
      if (!candidate || valid.some(other => JSON.stringify(other.geometry) === JSON.stringify(candidate.geometry))) continue;
      try { valid.push(await validateRoute(route, candidate, sha)); } catch { /* invalid alternatives are never exposed */ }
    }
    if (valid.length < 2) throw new HttpsError('failed-precondition', 'Der Router lieferte keine zwei unterschiedlichen, validen Kandidaten für eine KI-Auswahl.');
    const candidateFacts = valid.map(candidate => ({ id: candidate.id,
      distanceM: candidate.metrics.distanceM.value!, ascentM: candidate.metrics.ascentM.value,
      durationS: candidate.metrics.durationS.value }));
    const scoreInput = { candidates: candidateFacts, userSelectedPriority: priority, flatnessRequested: route.criteria.weights.flat > 0 };
    const candidateScores = scoreRouteCandidates(scoreInput);
    const ranked = await chooseRouteCandidate({ ...scoreInput, scoredCandidates: candidateScores },
      { provider: claimed.aiProvider, model: claimed.aiModel });
    const artifacts: Array<{ id: string; path: string; sha256: string; distanceM: number | null; ascentM: number | null; durationS: number | null }> = [];
    for (const candidate of valid) {
      const json = JSON.stringify(candidate), hash = digest(json), path = `users/${uid}/route-archive/${jobId}/${runId}/${hash}.json`;
      await privateBucket().file(path).save(json, { resumable: false, validation: 'crc32c', metadata: { contentType: 'application/json', cacheControl: 'private, no-store' } });
      uploaded.push(path);
      artifacts.push({ id: candidate.id, path, sha256: hash, distanceM: candidate.metrics.distanceM.value,
        ascentM: candidate.metrics.ascentM.value, durationS: candidate.metrics.durationS.value });
    }
    const selected = artifacts.find(artifact => artifact.id === ranked.choice.candidateId);
    if (!selected) throw new HttpsError('data-loss', 'KI-Auswahl gehört nicht zur Kandidatenmenge.');
    const evidence = { provider: ranked.provider, model: ranked.model, selectedPriority: priority,
      reason: ranked.choice.reason, weights: { explicitPriority: 0.5,
        distanceAndTime: route.criteria.weights.flat > 0 && priority !== 'flatter' && candidateFacts.every(candidate => candidate.ascentM !== null) ? 0.3 : 0.5,
        measuredFlatness: route.criteria.weights.flat > 0 && priority !== 'flatter' && candidateFacts.every(candidate => candidate.ascentM !== null) ? 0.2 : 0,
        history: 0 }, candidates: candidateScores,
      criteriaUnknown: route.criteria.weights.flat > 0 && candidateFacts.some(candidate => candidate.ascentM === null) ? ['flatness:router_ascent_unavailable'] : [] };
    await database().runTransaction(async tx => {
      const [current, active, suspended, deletion] = await Promise.all([tx.get(jobRef), tx.get(activeRef),
        tx.get(database().collection('suspended_users').doc(uid)), tx.get(database().collection('account_deletion_locks').doc(digest(uid)))]);
      if (!current.exists || current.data()?.runId !== runId || current.data()?.state !== 'running'
        || !active.exists || active.data()?.runId !== runId || current.data()?.leaseUntil <= Date.now()) throw new HttpsError('aborted', 'Job lease expired before completion.');
      if (suspended.exists || deletion.exists) throw new HttpsError('permission-denied', 'Account is no longer eligible.');
      const capture = await prepareWalletMutation(database(), tx, uid, { operation: 'capture', amount: current.data()!.amount, reference: jobId });
      capture.commit();
      tx.update(jobRef, { state: 'ready', artifacts, selectedCandidateId: selected.id, planningEvidence: evidence,
        artifactHash: selected.sha256, readyAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), leaseUntil: 0 });
      tx.delete(activeRef);
      tx.set(outboxRef, { state: 'complete', completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return;
  } catch (error) {
    await Promise.all(uploaded.map(path => privateBucket().file(path).delete({ ignoreNotFound: true }).catch(() => undefined)));
    let retry = false;
    await database().runTransaction(async tx => {
      const [currentSnapshot, activeSnapshot] = await Promise.all([tx.get(jobRef), tx.get(activeRef)]);
      const current = currentSnapshot.data(), active = activeSnapshot.data();
      if (!current || current.runId !== runId || current.state !== 'running') return;
      const terminal = isPermanentPremiumFailure(error) || current.attempts >= MAX_JOB_ATTEMPTS;
      if (terminal) {
        const release = await prepareWalletMutation(database(), tx, uid, { operation: 'release', amount: current.amount, reference: jobId });
        release.commit();
        tx.update(jobRef, { state: 'failed', failureCode: error instanceof HttpsError ? error.code : 'provider_or_router_failure',
          updatedAt: FieldValue.serverTimestamp(), leaseUntil: 0 });
        if (activeSnapshot.exists && active?.runId === runId) tx.delete(activeRef);
        tx.set(outboxRef, { state: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        const retryAt = Date.now() + 2 * 60_000;
        tx.update(jobRef, { state: 'queued', runId: null, leaseUntil: retryAt,
          lastFailureCode: error instanceof HttpsError ? error.code : 'provider_or_router_failure', updatedAt: FieldValue.serverTimestamp() });
        if (activeSnapshot.exists && active?.runId === runId) tx.set(activeRef, { userId: uid, jobId, state: 'queued', leaseUntil: retryAt });
        tx.set(outboxRef, { state: 'pending', lastFailureAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        retry = true;
      }
    });
    if (retry) throw error;
  }
});

export const getPremiumRouteResult = onCall({ region: 'europe-west3', enforceAppCheck: true }, async request => {
  if (!request.app || !request.auth?.uid || typeof request.data?.jobId !== 'string') throw new HttpsError('unauthenticated', 'Authentication and App Check required.');
  const jobId = request.data.jobId;
  if (!/^[a-f0-9]{64}$/.test(jobId)) throw new HttpsError('invalid-argument', 'Invalid job ID.');
  const snapshot = await database().collection('premium_route_jobs').doc(jobId).get(), job = snapshot.data();
  if (!job || job.userId !== request.auth.uid) throw new HttpsError('not-found', 'Route job not found.');
  if (job.state !== 'ready') return { jobId, status: job.state, failureCode: job.failureCode ?? job.lastFailureCode ?? null, attempts: job.attempts ?? 0 };
  return responseFor(job);
});

/** Returns one already archived candidate so clients can restore every generated alternative after reconnecting. */
export const getPremiumRouteCandidate = onCall({ region: 'europe-west3', enforceAppCheck: true }, async request => {
  if (!request.app || !request.auth?.uid || typeof request.data?.jobId !== 'string'
    || !/^[a-f0-9]{64}$/.test(request.data.jobId) || typeof request.data?.candidateId !== 'string') {
    throw new HttpsError('invalid-argument', 'Invalid route candidate request.');
  }
  const snapshot = await database().collection('premium_route_jobs').doc(request.data.jobId).get(), job = snapshot.data();
  if (!job || job.userId !== request.auth.uid) throw new HttpsError('not-found', 'Route job not found.');
  if (job.state !== 'ready') throw new HttpsError('failed-precondition', 'Route job is not ready.');
  const artifact = job.artifacts.find((item: any) => item.id === request.data.candidateId);
  if (!artifact) throw new HttpsError('not-found', 'Route candidate not found.');
  return { jobId: job.jobId, route: await loadArtifact(artifact.path, artifact.sha256) };
});

/** Lists bounded metadata for the caller's durable premium archive so lost local copies can be restored. */
export const listPremiumRouteArchive = onCall({ region: 'europe-west3', enforceAppCheck: true }, async request => {
  if (!request.app || !request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication and App Check required.');
  const cursor = request.data?.cursor;
  if (cursor !== undefined && (!cursor || typeof cursor.createdAt !== 'number' || !Number.isSafeInteger(cursor.createdAt)
    || typeof cursor.docId !== 'string' || !/^[a-f0-9]{64}$/.test(cursor.docId))) throw new HttpsError('invalid-argument', 'Invalid archive cursor.');
  let query = database().collection('premium_route_jobs').where('userId', '==', request.auth.uid)
    .orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
  if (cursor) query = query.startAfter(Timestamp.fromMillis(cursor.createdAt), cursor.docId);
  const snapshot = await query.limit(100).get();
  const jobs = snapshot.docs.map(document => {
    const job = document.data();
    if (job.state !== 'ready' || !Array.isArray(job.artifacts) || typeof job.jobId !== 'string') return null;
    return { jobId: job.jobId, request: job.request, createdAt: job.createdAt?.toMillis?.() ?? 0,
      selectedCandidateId: job.selectedCandidateId, planningEvidence: job.planningEvidence,
      candidates: job.artifacts.map((artifact: any) => ({ id: artifact.id, distanceM: artifact.distanceM,
        ascentM: artifact.ascentM ?? null, durationS: artifact.durationS ?? null })) };
  }).filter(Boolean);
  const last = snapshot.docs[snapshot.docs.length - 1];
  return { jobs, nextCursor: snapshot.size === 100 && last
    ? { createdAt: last.get('createdAt')?.toMillis?.() ?? 0, docId: last.id } : null };
});

export const cancelPremiumRoute = onCall({ region: 'europe-west3', enforceAppCheck: true }, async request => {
  if (!request.app || !request.auth?.uid || typeof request.data?.jobId !== 'string' || !/^[a-f0-9]{64}$/.test(request.data.jobId)) {
    throw new HttpsError('unauthenticated', 'Authentication and App Check required.');
  }
  const uid = request.auth.uid, jobRef = database().collection('premium_route_jobs').doc(request.data.jobId);
  const activeRef = database().collection('premium_route_active').doc(digest(uid));
  return database().runTransaction(async tx => {
    const [jobSnapshot, activeSnapshot] = await Promise.all([tx.get(jobRef), tx.get(activeRef)]);
    const job = jobSnapshot.data();
    if (!job || job.userId !== uid) throw new HttpsError('not-found', 'Route job not found.');
    if (job.state === 'ready') return { status: 'ready' };
    if (job.state !== 'running' && job.state !== 'queued') return { status: job.state };
    const release = await prepareWalletMutation(database(), tx, uid, { operation: 'release', amount: job.amount, reference: job.jobId });
    release.commit();
    tx.update(jobRef, { state: 'cancelled', leaseUntil: 0, cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(database().collection('premium_route_outbox').doc(job.jobId), { state: 'cancelled', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (activeSnapshot.exists && activeSnapshot.data()?.jobId === job.jobId) tx.delete(activeRef);
    return { status: 'cancelled' };
  });
});

/** Recovers the transactional outbox if a callable crashed between reserving tokens and enqueueing. */
export const dispatchPendingPremiumRouteOutbox = onSchedule({ region: 'europe-west3', schedule: 'every 1 minutes', timeZone: 'UTC', maxInstances: 1 }, async () => {
  const pending = await database().collection('premium_route_outbox').where('state', '==', 'pending').limit(OUTBOX_BATCH_SIZE).get();
  for (const document of pending.docs) {
    const outbox = document.data(), jobId = outbox.jobId;
    if (typeof jobId !== 'string' || !/^[a-f0-9]{64}$/.test(jobId)) continue;
    const jobRef = database().collection('premium_route_jobs').doc(jobId), jobSnapshot = await jobRef.get(), job = jobSnapshot.data();
    if (!job || !['queued', 'running'].includes(job.state)) {
      await document.ref.set({ state: job?.state === 'ready' ? 'complete' : job?.state === 'cancelled' ? 'cancelled' : 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      continue;
    }
    if ((outbox.attempts ?? 0) >= MAX_JOB_ATTEMPTS * 2) {
      const uid = job.userId, activeRef = database().collection('premium_route_active').doc(digest(uid));
      await database().runTransaction(async tx => {
        const [current, active] = await Promise.all([tx.get(jobRef), tx.get(activeRef)]), value = current.data();
        if (!value || !['queued', 'running'].includes(value.state)) return;
        const release = await prepareWalletMutation(database(), tx, uid, { operation: 'release', amount: value.amount, reference: jobId });
        release.commit();
        tx.update(jobRef, { state: 'failed', failureCode: 'queue_enqueue_exhausted', leaseUntil: 0, updatedAt: FieldValue.serverTimestamp() });
        if (active.exists && active.data()?.jobId === jobId) tx.delete(activeRef);
        tx.set(document.ref, { state: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      });
      continue;
    }
    try {
      await enqueuePremiumRoute(jobId);
      await updatePendingOutbox(document.ref, { state: 'enqueued', attempts: FieldValue.increment(1), lastEnqueuedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    } catch {
      await updatePendingOutbox(document.ref, { attempts: FieldValue.increment(1), lastEnqueueFailureAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    }
  }
});

/** Settles or requeues expired worker leases; no reservation is released merely by TTL. */
export const reconcileExpiredPremiumRoutes = onSchedule({ region: 'europe-west3', schedule: 'every 1 minutes', timeZone: 'UTC', maxInstances: 1 }, async () => {
  const now = Date.now();
  const expired = await database().collection('premium_route_active').where('leaseUntil', '<=', now).limit(100).get();
  for (const activeDocument of expired.docs) {
    await database().runTransaction(async tx => {
      const activeSnapshot = await tx.get(activeDocument.ref), active = activeSnapshot.data();
      if (!activeSnapshot.exists || !active || active.leaseUntil > Date.now() || typeof active.jobId !== 'string') return;
      const jobRef = database().collection('premium_route_jobs').doc(active.jobId);
      const jobSnapshot = await tx.get(jobRef), job = jobSnapshot.data();
      const outboxRef = database().collection('premium_route_outbox').doc(active.jobId);
      if (!job || ['ready', 'failed', 'cancelled'].includes(job.state)) { tx.delete(activeDocument.ref); return; }
      if (job.state === 'running' && job.leaseUntil > Date.now()) {
        tx.set(activeDocument.ref, { userId: job.userId, jobId: job.jobId, state: 'running', runId: job.runId, leaseUntil: job.leaseUntil });
        return;
      }
      if (job.attempts >= MAX_JOB_ATTEMPTS) {
        const release = await prepareWalletMutation(database(), tx, job.userId, { operation: 'release', amount: job.amount, reference: job.jobId });
        release.commit();
        tx.update(jobRef, { state: 'failed', failureCode: 'worker_lease_expired', leaseUntil: 0, updatedAt: FieldValue.serverTimestamp() });
        tx.set(outboxRef, { state: 'failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.delete(activeDocument.ref);
        return;
      }
      const retryAt = Date.now() + JOB_LEASE_MS;
      tx.update(jobRef, { state: 'queued', runId: null, leaseUntil: retryAt, updatedAt: FieldValue.serverTimestamp() });
      tx.set(activeDocument.ref, { userId: job.userId, jobId: job.jobId, state: 'queued', leaseUntil: retryAt });
      tx.set(outboxRef, { state: 'pending', leaseRecoveredAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
  }
});

export const ROUTE_ARTIFACT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Cleans up expired route jobs and their cloud storage artifacts older than 30 days */
export const cleanupExpiredRouteArtifacts = onSchedule({ region: 'europe-west3', schedule: 'every 24 hours', timeZone: 'UTC', maxInstances: 1 }, async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - ROUTE_ARTIFACT_RETENTION_MS);
  const expiredJobs = await database().collection('premium_route_jobs')
    .where('createdAt', '<=', cutoff)
    .limit(100)
    .get();

  for (const doc of expiredJobs.docs) {
    const data = doc.data();
    const uid = data.userId;
    const jobId = doc.id;
    if (uid && jobId) {
      try {
        const bucket = getStorage().bucket();
        const [files] = await bucket.getFiles({ prefix: `users/${uid}/route-archive/${jobId}/` });
        await Promise.all(files.map(file => file.delete()));
      } catch (err) {
        console.warn(`[Cleanup] Storage deletion failed for job ${jobId}:`, err);
      }
    }
    await doc.ref.delete();
    await database().collection('premium_route_outbox').doc(jobId).delete().catch(() => {});
  }
});
