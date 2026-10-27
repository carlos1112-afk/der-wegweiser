import { ROUTING_LIMITS as L, RoutingError } from './contracts';
import type { Coordinate, RouteCandidateV1, RouteRequestV1, ValidatedRouteV1 } from './contracts';
import { cumulativeDistances, distanceM, isCoordinate, projectSegment } from './geometry';
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RoutingError('INVALID_REQUEST');
  return value as Record<string, any>;
}
function finite(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function text(value: unknown, max: number): boolean { return typeof value === 'string' && value.length > 0 && value.length <= max; }
/** Runtime boundary for callers, including older clients. No numeric coercion. */
export function parseRouteRequest(value: unknown): RouteRequestV1 {
  const r = object(value), s = object(r.start), c = object(r.criteria), p = object(r.profile), w = object(c.weights);
  const timestamp = (v: unknown) => finite(v, 0, Number.MAX_SAFE_INTEGER) && Number.isSafeInteger(v);
  if (r.version !== 1 || !text(r.requestId, 128) || !['standard', 'ai'].includes(r.planning)
    || !isCoordinate({ lat: s.lat, lng: s.lng }) || !['gps', 'manual', 'saved'].includes(s.source) || !timestamp(s.observedAt) || s.confirmed !== true
    || (s.source === 'gps' ? !finite(s.accuracyM, 0, 1000) : s.accuracyM !== null)
    || !Array.isArray(r.mandatoryStops) || r.mandatoryStops.length > L.maxStops || !r.mandatoryStops.every(isCoordinate)
    || !Array.isArray(r.interests) || r.interests.length > 40 || !r.interests.every((v: unknown) => text(v, 128))
    || !Array.isArray(c.hard) || c.hard.length > 2 || new Set(c.hard).size !== c.hard.length
    || !c.hard.every((v: unknown) => v === 'avoid_ferries' || v === 'avoid_unpaved')
    || typeof c.wishes !== 'string' || c.wishes.length > L.maxWishes
    || ![w.asphalt, w.nature, w.flat].every(v => finite(v, 0, 1))
    || p.bike !== 'bicycle' || !timestamp(p.confirmedAt) || !text(p.consentVersion, 128)
    || !(p.batteryPercent === null || finite(p.batteryPercent, 0, 100))
    || !(p.batteryCapacityWh === null || finite(p.batteryCapacityWh, 1, 5000))) throw new RoutingError('INVALID_REQUEST');
  if (r.kind === 'destination') {
    if (!isCoordinate(r.destination) || r.targetDistanceM !== undefined) throw new RoutingError('INVALID_REQUEST');
  } else if (r.kind === 'roundtrip') {
    if (!finite(r.targetDistanceM, L.minRoundtripM, L.maxRoundtripM) || r.destination !== undefined) throw new RoutingError('INVALID_REQUEST');
  } else throw new RoutingError('INVALID_REQUEST');
  // Fixed field order and allowed fields give hashing a stable normalized representation.
  // Copy nested data so an async caller cannot mutate an accepted request in place.
  const coordinate = (point: Coordinate): Coordinate => ({ lat: point.lat, lng: point.lng });
  const base = {
    version: 1 as const, requestId: r.requestId, planning: r.planning,
    start: { ...coordinate(s as unknown as Coordinate), source: s.source, observedAt: s.observedAt, accuracyM: s.accuracyM, confirmed: true },
    mandatoryStops: r.mandatoryStops.map(coordinate), interests: [...r.interests],
    criteria: { hard: [...c.hard].sort(), wishes: c.wishes,
      weights: { asphalt: w.asphalt, nature: w.nature, flat: w.flat } },
    profile: { bike: p.bike, batteryPercent: p.batteryPercent, batteryCapacityWh: p.batteryCapacityWh,
      confirmedAt: p.confirmedAt, consentVersion: p.consentVersion },
  };
  return (r.kind === 'destination' ? { ...base, kind: 'destination', destination: coordinate(r.destination) }
    : { ...base, kind: 'roundtrip', targetDistanceM: r.targetDistanceM }) as RouteRequestV1;
}
function orderedStops(stops: readonly Coordinate[], geometry: readonly Coordinate[], lengths: readonly number[]): boolean {
  let progress = 0;
  for (const stop of stops) {
    let found: number | null = null;
    for (let i = 0; i < geometry.length - 1; i++) {
      const projected = projectSegment(stop, geometry[i], geometry[i + 1], lengths[i], i);
      if (projected.distanceM <= L.snapM && projected.progressM >= progress && (found === null || projected.progressM < found)) found = projected.progressM;
    }
    if (found === null) return false;
    progress = found;
  }
  return true;
}
const validatedInstances = new WeakSet<object>();
/** Serialized/legacy data must pass validation again before it can start guidance. */
export function isValidatedRoute(value: unknown): value is ValidatedRouteV1 {
  return !!value && typeof value === 'object' && validatedInstances.has(value);
}
const actions = new Set(['straight', 'turn-left', 'turn-right', 'slight-left', 'slight-right', 'roundabout', 'arrive']);
/** Caller supplies a platform SHA-256 implementation; branded result is never obtained by casting in consumers. */
export async function validateRoute(request: RouteRequestV1, candidate: RouteCandidateV1,
  sha256: (canonical: string) => Promise<string>): Promise<ValidatedRouteV1> {
  const r = parseRouteRequest(request);
  // Snapshot before awaiting a digest, to avoid time-of-check/time-of-use mutation.
  let c: RouteCandidateV1;
  try {
    const serialized = JSON.stringify(candidate);
    if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > L.maxArtifactBytes) throw new Error('size');
    c = JSON.parse(serialized);
  } catch { throw new RoutingError('INVALID_GEOMETRY'); }
  if (!c || c.version !== 1 || !text(c.id, 128) || c.requestId !== r.requestId || !['online', 'local'].includes(c.execution)
    || c.provenance?.engine !== 'brouter' || !text(c.provenance.engineVersion, 128) || !text(c.provenance.dataVersion, 128)
    || !text(c.provenance.profile, 128) || !Array.isArray(c.geometry) || c.geometry.length < 2 || c.geometry.length > L.maxPoints
    || !c.geometry.every(isCoordinate) || !Array.isArray(c.criteriaFindings)) throw new RoutingError('INVALID_GEOMETRY');
  for (let i = 1; i < c.geometry.length; i++) {
    if (Math.abs(c.geometry[i].lng - c.geometry[i - 1].lng) > 180) throw new RoutingError('INVALID_GEOMETRY');
  }
  const lengths = cumulativeDistances(c.geometry), total = lengths[lengths.length - 1];
  if (total < 1 || total > L.maxDistanceM) throw new RoutingError('INVALID_GEOMETRY');
  const end = r.kind === 'destination' ? r.destination : r.start;
  if (distanceM(r.start, c.geometry[0]) > L.snapM || distanceM(end, c.geometry[c.geometry.length - 1]) > L.snapM) throw new RoutingError('ENDPOINT_MISMATCH');
  if (!orderedStops(r.mandatoryStops, c.geometry, lengths)) throw new RoutingError('VIA_ORDER_MISMATCH');
  const metrics = c.metrics;
  if (!metrics || ![metrics.distanceM, metrics.ascentM, metrics.durationS, metrics.energyWh].every(metric => metric && (
    metric.quality === 'unknown' ? metric.value === null && metric.source === null :
      (metric.quality === 'known' || metric.quality === 'estimated') && finite(metric.value, 0, Number.MAX_SAFE_INTEGER) && text(metric.source, 256)))) throw new RoutingError('INVALID_GEOMETRY');
  if (metrics.distanceM.value === null || Math.abs(metrics.distanceM.value - total) / total > 0.05) throw new RoutingError('DISTANCE_MISMATCH');
  if (r.kind === 'roundtrip' && Math.abs(total - r.targetDistanceM) / r.targetDistanceM > 0.2) throw new RoutingError('NO_MATCHING_ROUTE');
  for (const hard of r.criteria.hard) {
    const findings = c.criteriaFindings.filter(f => f.criterion === hard);
    if (!findings.length || findings.some(f => f.status !== 'satisfied' || !text(f.source, 256))) throw new RoutingError('UNSUPPORTED_CRITERIA');
  }
  if (!Array.isArray(c.maneuvers)) throw new RoutingError('INVALID_GEOMETRY');
  let previous = -1;
  for (const m of c.maneuvers) {
    if (!m || !Number.isInteger(m.geometryIndex) || m.geometryIndex < 0 || m.geometryIndex >= c.geometry.length
      || !finite(m.distanceAlongM, 0, total) || m.distanceAlongM < previous
      || Math.abs(lengths[m.geometryIndex] - m.distanceAlongM) > 5 || !actions.has(m.action)
      || !text(m.instruction, 1000) || !(m.street === null || text(m.street, 256))) throw new RoutingError('INVALID_GEOMETRY');
    previous = m.distanceAlongM;
  }
  // Hash covers the complete accepted content, not the original mutable object.
  const contentHash = await sha256(canonicalJson(c));
  const requestHash = await sha256(canonicalJson(r));
  if (![contentHash, requestHash].every(hash => /^[a-f0-9]{64}$/.test(hash))) throw new RoutingError('INVALID_GEOMETRY');
  const result = deepFreeze({ ...c, validationVersion: 1,
    guidanceCapability: c.maneuvers.length > 0 ? 'turn_by_turn' : 'track', contentHash, requestHash }) as ValidatedRouteV1;
  validatedInstances.add(result);
  return result;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Object key order must not change hashes across backend JSON and browser adapters. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  const result = JSON.stringify(value);
  if (result === undefined) throw new RoutingError('INVALID_GEOMETRY');
  return result;
}
