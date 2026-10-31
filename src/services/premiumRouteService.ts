import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import { ConsentService } from './consentService';
import { isValidatedRoute, validateRoute } from '../types/routing';
import type { RouteCandidateV1, RouteRequestV1, ValidatedRouteV1 } from '../types/routing';
import type { Route } from '../types/navigation';
import { routeArchive } from './routeArchiveService';

export type RoutePriority = 'shorter' | 'flatter' | 'faster' | null;
interface PremiumQuote { quoteId: string; amount: number; currency: 'token'; priceVersion: string; expiresAt: number; provider: string; model: string; routerProvider: 'brouter' | 'openrouteservice' }
interface PremiumResponse {
  jobId: string; status: 'ready' | 'queued' | 'running' | 'failed' | 'cancelled'; route?: ValidatedRouteV1;
  alternatives?: Array<{ id: string; selected: boolean; distanceM: number; ascentM: number | null; durationS: number | null }>;
  planningEvidence?: { provider: string; model: string; reason: string; criteriaUnknown: string[] };
  failureCode?: string | null; attempts?: number;
}

function waitForNextPoll(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new DOMException('Abgebrochen', 'AbortError'));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, 2000);
    const abort = () => { window.clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new DOMException('Abgebrochen', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export class PremiumRouteService {
  static async syncArchivedCandidates(): Promise<{ restored: number; failed: number }> {
    const uid = auth.currentUser?.uid;
    if (!functions || !uid || !ConsentService.allowsEssential) throw new Error('Für die Archivwiederherstellung sind Anmeldung und Einwilligung erforderlich.');
    const listCall = httpsCallable<{ cursor?: { createdAt: number; docId: string } }, { jobs: Array<{ jobId: string; request: RouteRequestV1; createdAt: number; selectedCandidateId: string; candidates: Array<{ id: string; distanceM: number; ascentM: number | null; durationS: number | null }> }>; nextCursor: { createdAt: number; docId: string } | null }>(functions, 'listPremiumRouteArchive', { timeout: 30000 });
    const jobs: Array<{ jobId: string; request: RouteRequestV1; createdAt: number; selectedCandidateId: string; candidates: Array<{ id: string; distanceM: number; ascentM: number | null; durationS: number | null }> }> = [];
    let cursor: { createdAt: number; docId: string } | undefined;
    do {
      const page = (await listCall(cursor ? { cursor } : {})).data;
      if (!Array.isArray(page.jobs)) throw new Error('Ungültige Archivantwort.');
      jobs.push(...page.jobs);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    let restored = 0, failed = 0;
    const getCall = httpsCallable<{ jobId: string; candidateId: string }, { jobId: string; route: ValidatedRouteV1 }>(functions, 'getPremiumRouteCandidate', { timeout: 30000 });
    for (const job of jobs) for (const meta of job.candidates) {
      try {
        const response = (await getCall({ jobId: job.jobId, candidateId: meta.id })).data;
        if (response.jobId !== job.jobId || response.route.id !== meta.id) throw new Error('Archivroute stimmt nicht mit dem Auftrag überein.');
        const candidate = await validateRoute(job.request, {
          version: response.route.version, id: response.route.id, requestId: response.route.requestId,
          execution: response.route.execution, geometry: response.route.geometry, metrics: response.route.metrics,
          maneuvers: response.route.maneuvers, provenance: response.route.provenance, criteriaFindings: response.route.criteriaFindings,
        }, async text => {
          const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
          return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
        });
        if (candidate.contentHash !== response.route.contentHash || candidate.requestHash !== response.route.requestHash) throw new Error('Prüfsumme der Archivroute stimmt nicht.');
        const route: Route = { id: candidate.id, title: 'KI-Alternative: Ziel',
          summary: `${(candidate.metrics.distanceM.value! / 1000).toFixed(1)} km · KI-Premium`,
          aiStory: meta.id === job.selectedCandidateId ? 'Wiederhergestellte, serverseitig gespeicherte Premiumroute.' : 'Wiederhergestellte, ungefahrene Premiumalternative.',
          distanceKm: candidate.metrics.distanceM.value! / 1000, elevationGainM: candidate.metrics.ascentM.value,
          estimatedTimeMin: candidate.metrics.durationS.value === null ? null : candidate.metrics.durationS.value / 60,
          estimatedBatteryConsumptionWh: candidate.metrics.energyWh.value, isBatterySafe: null, surfaceBreakdown: null,
          pathCoordinates: candidate.geometry.map(point => [point.lat, point.lng]), chargingStopsOnRoute: [], isRoadSnapped: true,
          isOfflineFallbackCorridor: false, routingEngineStatus: candidate.provenance.engine === 'openrouteservice' ? 'online_openrouteservice' : 'online_brouter', validatedRoute: candidate,
          waypoints: [{ id: 'start', ...job.request.start, name: 'Start', category: 'start' },
            ...job.request.mandatoryStops.map((point, index) => ({ id: `via-${index}`, ...point, name: `Zwischenstopp ${index + 1}`, category: 'scenic' as const })),
            ...(job.request.kind === 'destination' ? [{ id: 'destination', ...job.request.destination, name: 'Ziel', category: 'end' as const }] : [])] };
        await routeArchive.saveGenerated(uid, route, `premium:${job.jobId}:${meta.id}`);
        restored++;
      } catch { failed++; }
    }
    return { restored, failed };
  }
  static async isAvailable(): Promise<boolean> {
    if (!functions || !ConsentService.allowsEssential) return false;
    const call = httpsCallable<void, { premiumEnabled: boolean }>(functions, 'getRoutingCapabilities', { timeout: 10000 });
    return (await call()).data?.premiumEnabled === true;
  }
  static async generate(request: RouteRequestV1, priority: RoutePriority, signal?: AbortSignal): Promise<{
    route: ValidatedRouteV1; candidates: ValidatedRouteV1[]; unrestoredCandidateIds: string[]; jobId: string;
    alternatives: NonNullable<PremiumResponse['alternatives']>; evidence: NonNullable<PremiumResponse['planningEvidence']>;
  }> {
    const revision = ConsentService.getRevision(), uid = auth.currentUser?.uid ?? null;
    if (!functions || !uid) throw new Error('Für die persönliche Routenplanung ist ein angemeldetes Konto erforderlich.');
    if (!ConsentService.allowsEssential || signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const quoteCall = httpsCallable<{ route: RouteRequestV1 }, PremiumQuote>(functions, 'quotePremiumRoute', { timeout: 15000 });
    const quote = (await quoteCall({ route: request })).data;
    if (!quote || !quote.quoteId || !Number.isSafeInteger(quote.amount) || quote.amount < 1 || quote.currency !== 'token'
      || !['brouter', 'openrouteservice'].includes(quote.routerProvider)) throw new Error('Ungültiges Preisangebot.');
    if (signal?.aborted || revision !== ConsentService.getRevision() || uid !== auth.currentUser?.uid) throw new DOMException('Abgebrochen', 'AbortError');
    const priorityLabel = priority === 'flatter' ? 'möglichst flach' : priority === 'faster' ? 'möglichst schnell' : 'möglichst kurz';
    const accepted = typeof window !== 'undefined'
      && window.confirm(`Persönliche KI-Routenplanung (${priorityLabel}) kostet ${quote.amount} Token. Verarbeitet werden Start, Ziel, ausdrücklich gesetzte Wegpunkte, Flachheitswunsch und diese Priorität. KI-Anbieter: ${quote.provider} (${quote.model}); Straßenrouter: ${quote.routerProvider}. Oberfläche, Freitext, Akku und Fahrhistorie werden in dieser Version nicht bewertet. Belastet wird erst nach dauerhafter Speicherung aller gültigen Routenvarianten. Jetzt starten?`);
    if (!accepted) throw new DOMException('Preisangebot abgelehnt.', 'AbortError');
    const createCall = httpsCallable<{ route: RouteRequestV1; quoteId: string; userSelectedPriority: RoutePriority }, PremiumResponse>(
      functions, 'createPremiumRoute', { timeout: 190000 });
    let response = (await createCall({ route: request, quoteId: quote.quoteId, userSelectedPriority: priority })).data;
    if (!response?.jobId) throw new Error('Premiumauftrag lieferte keine Auftrags-ID.');
    const jobId = response.jobId;
    const cancelCall = httpsCallable<{ jobId: string }, { status: string }>(functions, 'cancelPremiumRoute', { timeout: 15000 });
    const assertActive = () => {
      if (signal?.aborted || revision !== ConsentService.getRevision() || uid !== auth.currentUser?.uid) {
        throw new DOMException('Abgebrochen', 'AbortError');
      }
    };
    try {
      assertActive();
      const resultCall = httpsCallable<{ jobId: string }, PremiumResponse>(functions, 'getPremiumRouteResult', { timeout: 30000 });
      const deadline = Date.now() + 9 * 60_000;
      while (response.status !== 'ready') {
        assertActive();
        if (response.status === 'failed' || response.status === 'cancelled') {
          throw new Error(`Premiumauftrag ${response.status} (${response.failureCode ?? 'ohne Fehlercode'}). Auftrags-ID: ${response.jobId}.`);
        }
        if (Date.now() >= deadline) throw new Error(`Premiumauftrag läuft weiter; nach Abschluss kannst du die Varianten beim nächsten Archivabgleich wiederherstellen. Auftrags-ID: ${response.jobId}.`);
        await waitForNextPoll(signal);
        assertActive();
        response = (await resultCall({ jobId })).data;
        assertActive();
        if (response?.jobId !== jobId) throw new Error('Premiumantwort gehört nicht zum angefragten Auftrag.');
      }
      if (response?.status !== 'ready' || !response.route || !Array.isArray(response.alternatives) || !response.planningEvidence) {
        throw new Error(`Premiumauftrag ${response?.status ?? 'unbekannt'}${response?.jobId ? ` (${response.jobId})` : ''}. Ergebnis kann über die Auftrags-ID erneut abgerufen werden.`);
      }
      const wire = response.route;
      const validateWire = async (candidateWire: ValidatedRouteV1): Promise<ValidatedRouteV1> => {
        const candidate: RouteCandidateV1 = { version: candidateWire.version, id: candidateWire.id, requestId: candidateWire.requestId, execution: candidateWire.execution,
          geometry: candidateWire.geometry, metrics: candidateWire.metrics, maneuvers: candidateWire.maneuvers, provenance: candidateWire.provenance, criteriaFindings: candidateWire.criteriaFindings };
        const validated = await validateRoute(request, candidate, async text => {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
        });
        if (validated.contentHash !== candidateWire.contentHash || validated.requestHash !== candidateWire.requestHash || !isValidatedRoute(validated)) {
          throw new Error('Premiumroute konnte lokal nicht erneut bestätigt werden.');
        }
        return validated;
      };
      const route = await validateWire(wire);
      assertActive();
      const candidates = [route];
      const unrestoredCandidateIds: string[] = [];
      // Each artifact is fetched individually after durable server completion, so one oversized callable response
      // cannot hide or truncate the remaining route alternatives.
      for (const alternative of response.alternatives) {
        if (alternative.id === route.id) continue;
        assertActive();
        const candidateCall = httpsCallable<{ jobId: string; candidateId: string }, { jobId: string; route: ValidatedRouteV1 }>(functions, 'getPremiumRouteCandidate', { timeout: 30000 });
        try {
          const artifact = (await candidateCall({ jobId: response.jobId, candidateId: alternative.id })).data;
          if (artifact.jobId !== response.jobId || !artifact.route || artifact.route.id !== alternative.id) throw new Error('Stored route candidate response mismatch.');
          candidates.push(await validateWire(artifact.route));
        } catch { unrestoredCandidateIds.push(alternative.id); }
        assertActive();
      }
      return { route, candidates, unrestoredCandidateIds, jobId: response.jobId, alternatives: response.alternatives, evidence: response.planningEvidence };
    } catch (error) {
      if (signal?.aborted || revision !== ConsentService.getRevision() || uid !== auth.currentUser?.uid) {
        try { await cancelCall({ jobId }); }
        catch { throw new Error(`Abbruch konnte nicht bestätigt werden. Bitte Auftragsstatus im Archiv prüfen. Auftrags-ID: ${jobId}.`); }
      }
      throw error;
    }
  }
}
