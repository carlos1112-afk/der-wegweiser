/** Policy revision includes persistent route and ride archives. */
export const ROUTING_CONSENT_VERSION = 3;
/** Versioned platform-neutral contract. Browser and Functions import this same module. */
export interface Coordinate { readonly lat: number; readonly lng: number }
export interface RouteLocation extends Coordinate {
  readonly source: 'gps' | 'manual' | 'saved';
  readonly observedAt: number;
  readonly accuracyM: number | null;
  readonly confirmed: boolean;
}
export interface ProfileSnapshotV1 {
  readonly bike: 'bicycle';
  readonly batteryPercent: number | null;
  readonly batteryCapacityWh: number | null;
  readonly confirmedAt: number;
  readonly consentVersion: string;
}
export interface CriteriaV1 {
  readonly hard: readonly ('avoid_ferries' | 'avoid_unpaved')[];
  readonly wishes: string;
  readonly weights: Readonly<{ asphalt: number; nature: number; flat: number }>;
}
interface RequestBase {
  readonly version: 1;
  readonly requestId: string;
  readonly planning: 'standard' | 'ai';
  readonly start: RouteLocation;
  readonly mandatoryStops: readonly Coordinate[];
  readonly interests: readonly string[];
  readonly criteria: CriteriaV1;
  readonly profile: ProfileSnapshotV1;
}
export type RouteRequestV1 = RequestBase & (
  { readonly kind: 'destination'; readonly destination: Coordinate } |
  { readonly kind: 'roundtrip'; readonly targetDistanceM: number }
);
export type RoutingErrorCode =
  | 'INVALID_REQUEST' | 'CONSENT_REQUIRED' | 'CANCELLED' | 'UNAVAILABLE'
  | 'OUTSIDE_COVERAGE' | 'MISSING_SEGMENTS' | 'INCOMPATIBLE_PACKAGE'
  | 'INVALID_GEOMETRY' | 'ENDPOINT_MISMATCH' | 'VIA_ORDER_MISMATCH'
  | 'DISTANCE_MISMATCH' | 'UNSUPPORTED_CRITERIA' | 'NO_MATCHING_ROUTE'
  | 'PREMIUM_UNAVAILABLE' | 'OFFLINE_UNAVAILABLE' | 'IDEMPOTENCY_CONFLICT'
  | 'INSUFFICIENT_BALANCE' | 'ALREADY_READY' | 'BUDGET_EXCEEDED'
  | 'INVALID_START' | 'UNSUPPORTED_CONSTRAINT' | 'NO_RESULTS' | 'NO_ROUTE'
  | 'ROUTE_INVALID' | 'MANEUVERS_UNAVAILABLE' | 'MODEL_UNAVAILABLE'
  | 'PREMIUM_REQUIRED' | 'INSUFFICIENT_TOKENS' | 'RATE_LIMITED'
  | 'OFFLINE_GRAPH_MISSING' | 'EXPIRED' | 'RESULT_EXPIRED';
export class RoutingError extends Error {
  readonly code: RoutingErrorCode;
  constructor(code: RoutingErrorCode, message: string = code) {
    super(message);
    this.code = code;
    this.name = 'RoutingError';
  }
}
export interface MetricV1 {
  readonly value: number | null;
  readonly quality: 'known' | 'estimated' | 'unknown';
  readonly source: string | null;
}
export interface RouteMetricsV1 {
  readonly distanceM: MetricV1;
  readonly ascentM: MetricV1;
  readonly durationS: MetricV1;
  readonly energyWh: MetricV1;
}
export type ManeuverAction = 'straight' | 'turn-left' | 'turn-right' | 'slight-left' | 'slight-right' | 'roundabout' | 'arrive';
export interface ManeuverV1 {
  readonly geometryIndex: number;
  readonly distanceAlongM: number;
  readonly action: ManeuverAction;
  readonly instruction: string;
  readonly street: string | null;
}
export interface RouteCandidateV1 {
  readonly version: 1;
  readonly id: string;
  readonly requestId: string;
  readonly execution: 'online' | 'local';
  readonly geometry: readonly Coordinate[];
  readonly metrics: RouteMetricsV1;
  readonly maneuvers: readonly ManeuverV1[];
  readonly provenance: Readonly<{ engine: 'brouter'; engineVersion: string; dataVersion: string; profile: string }>;
  readonly criteriaFindings: readonly Readonly<{ criterion: string; status: 'satisfied' | 'violated' | 'unknown'; source: string }>[];
}
// Opaque at compile time; only the validator may construct this type.
declare const validatedRoute: unique symbol;
export type ValidatedRouteV1 = RouteCandidateV1 & {
  readonly [validatedRoute]: true;
  readonly validationVersion: 1;
  readonly guidanceCapability: 'track' | 'turn_by_turn';
  readonly contentHash: string;
  readonly requestHash: string;
};
export interface PremiumResultV1 {
  readonly route: ValidatedRouteV1;
  readonly serverReceipt: Readonly<{ jobId: string; requestHash: string; artifactHash: string }>;
}
export interface RoutingCapabilitiesV1 {
  readonly version: 1;
  readonly coverage: readonly Readonly<{ id: string; dataVersion: string }>[];
  readonly profiles: readonly string[];
  readonly hardCriteria: CriteriaV1['hard'];
  readonly localEngine: 'brouter' | null;
  readonly priceVersion: string;
  readonly freeEnabled: boolean;
  readonly premiumEnabled: boolean;
  readonly offlineEnabled: boolean;
}
export interface NavigationSessionV1 {
  readonly version: 1;
  readonly sessionId: string;
  readonly originalRequest: RouteRequestV1;
  readonly originalRoute: ValidatedRouteV1;
  readonly connector: ValidatedRouteV1 | null;
  readonly progressM: number;
  readonly reachedMandatoryStopIndices: readonly number[];
  readonly lastPosition: RouteLocation | null;
  readonly packageVersion: string | null;
}
export type PremiumJobState = 'queued' | 'running' | 'ready' | 'cancelled' | 'failed' | 'expired';
export const ROUTING_LIMITS = Object.freeze({ maxStops: 5, maxWishes: 2000, maxDistanceM: 200000,
  minRoundtripM: 5000, maxRoundtripM: 120000, maxPoints: 100000, maxArtifactBytes: 8 * 1024 * 1024,
  snapM: 50, quoteTtlMs: 300000, jobDeadlineMs: 180000, defaultTokenPrice: 1 });
