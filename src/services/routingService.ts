import { routeArchive } from './routeArchiveService';
import { UserIdentity } from './userIdentity';
import type { Location, Route, UserPreferences } from '../types/navigation';
import type { RouteLocation, RouteRequestV1 } from '../types/routing';
import { RoutingError } from '../types/routing';
import { ConsentService, CONSENT_VERSION } from './consentService';
import { FreeRouteService } from './freeRouteService';
import { PremiumRouteService, type RoutePriority } from './premiumRouteService';
export interface RouteGenerationParams {
  startLat: number; startLng: number; targetDistanceKm?: number; maxElevationGainM?: number;
  surfacePreference?: 'asphalt' | 'gravel' | 'any'; themes?: string[]; batteryPercent: number | null;
  bikeType: string; isMapScoutMode?: boolean;
}
export interface DestinationRouteOptions {
  mode: 'standard' | 'premium' | 'offline'; start?: RouteLocation; destinationName?: string;
  via?: Location[]; wishes?: string; userSelectedPriority?: RoutePriority;
}
export class RouteGenerationCancelledError extends Error {
  constructor(message = 'Route generation was cancelled.') { super(message); this.name = 'AbortError'; }
}
function allowed(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RouteGenerationCancelledError();
  if (!ConsentService.allowsEssential) throw new RoutingError('CONSENT_REQUIRED', 'Einwilligung zur Standortverarbeitung fehlt.');
}
export class RoutingService {
  /** Legacy roundtrip entry is closed until real network anchors and premium jobs are available. */
  static async generateBikeRoute(_params: RouteGenerationParams, _prefs: UserPreferences,
    _legacyFetch?: typeof fetch, signal?: AbortSignal): Promise<Route> {
    allowed(signal);
    throw new RoutingError('PREMIUM_UNAVAILABLE', 'Persönliche Rundtouren sind noch nicht freigegeben.');
  }
  static async generateDestinationRoute(start: Location, destination: Location, prefs: UserPreferences,
    options: DestinationRouteOptions, _legacyFetch?: typeof fetch, signal?: AbortSignal): Promise<Route> {
    allowed(signal);
    if (options.mode === 'offline') throw new RoutingError('OFFLINE_UNAVAILABLE', 'Lokales Offline-Routing ist noch nicht verfügbar.');
    if (!options.start?.confirmed || options.start.lat !== start.lat || options.start.lng !== start.lng) throw new RoutingError('INVALID_START', 'Bitte einen aktuellen GPS-Start oder einen manuellen Start bestätigen.');
    const ownerId = UserIdentity.getUserId();
    if (routeArchive.hasPending(ownerId)) throw new Error('Zuerst die noch offene Archiv-Sicherung abschließen.');
    const profile = prefs;
    const premium = options.mode === 'premium';
    const request: RouteRequestV1 = { version: 1, requestId: crypto.randomUUID(), kind: 'destination', planning: premium ? 'ai' : 'standard',
      start: options.start, destination, mandatoryStops: options.via ?? [], interests: [],
      // Free routing is intentionally not personalized; premium uses only preferences shown in the confirmation flow.
      criteria: { hard: [], surfacePreference: 'any', wishes: '',
        weights: { asphalt: 0, nature: 0, flat: profile.avoidSteepHills ? 1 : 0 } },
      profile: { bike: 'bicycle', batteryPercent: null, batteryCapacityWh: null,
        confirmedAt: Date.now(), consentVersion: String(CONSENT_VERSION) } };
    const premiumResult = premium ? await PremiumRouteService.generate(request, options.userSelectedPriority ?? null, signal) : null;
    const selected = premiumResult?.route ?? await FreeRouteService.plan(request, signal);
    const candidates = premiumResult?.candidates ?? [selected];
    let selectedArchiveId: string | undefined;
    let selectedRoute: Route | undefined;
    for (const [index, candidate] of candidates.entries()) {
      const isSelected = candidate.id === selected.id;
      const result: Route = { id: candidate.id, title: `${premium ? `KI-Alternative ${index + 1}` : 'Route'}: ${options.destinationName || 'Ausgewähltes Ziel'}`,
        summary: `${(candidate.metrics.distanceM.value! / 1000).toFixed(1)} km · ${premium ? 'KI-Premium' : 'Kostenlos'} · ${candidate.provenance.engine}`,
        aiStory: isSelected && premiumResult ? `${premiumResult.evidence.reason}${premiumResult.evidence.criteriaUnknown.length ? ` Unbekannte Kriterien: ${premiumResult.evidence.criteriaUnknown.join(', ')}.` : ''}${premiumResult.unrestoredCandidateIds.length ? ` Weitere Varianten sind dauerhaft serverseitig gespeichert, konnten aber noch nicht lokal synchronisiert werden (Auftrag ${premiumResult.jobId}).` : ''}`
          : premium ? 'Vom KI-Routing erzeugte und serverseitig archivierte Alternative.'
            : candidate.guidanceCapability === 'track' ? 'Geprüfte Trackgeometrie. Abbiegeführung, Oberflächen- und Akkudaten sind noch nicht verfügbar; Freitextwünsche werden nicht ausgewertet.' : 'Kostenlose Fahrradroute.',
        distanceKm: candidate.metrics.distanceM.value! / 1000, elevationGainM: candidate.metrics.ascentM.value,
        estimatedTimeMin: candidate.metrics.durationS.value === null ? null : candidate.metrics.durationS.value / 60,
        estimatedBatteryConsumptionWh: candidate.metrics.energyWh.value, isBatterySafe: null, surfaceBreakdown: null,
        pathCoordinates: candidate.geometry.map(p => [p.lat, p.lng]), chargingStopsOnRoute: [], isRoadSnapped: true,
        isOfflineFallbackCorridor: false, routingEngineStatus: candidate.provenance.engine === 'openrouteservice' ? 'online_openrouteservice' : 'online_brouter', validatedRoute: candidate,
        waypoints: [{ id: 'start', ...request.start, name: 'Bestätigter Start', category: 'start' },
          ...(options.via ?? []).map((stop, index) => ({ id: `via-${index}`, ...stop, name: stop.name || `Zwischenstopp ${index + 1}`, category: 'scenic' as const })),
          { id: 'destination', ...destination, name: options.destinationName || 'Ziel', category: 'end' }] };
      const archived = premiumResult
        ? await routeArchive.saveGenerated(ownerId, result, `premium:${premiumResult.jobId}:${candidate.id}`)
        : await routeArchive.saveGenerated(ownerId, result);
      if (isSelected) { selectedArchiveId = archived.id; selectedRoute = result; }
    }
    if (!selectedRoute || !selectedArchiveId) throw new Error('Die ausgewählte Route wurde nicht vollständig archiviert.');
    // A successful result is archived even if the preview was cancelled while it was in flight,
    // but a stale preview must never replace the user's current screen.
    if (signal?.aborted) throw new RouteGenerationCancelledError();
    return { ...selectedRoute, archivePlanId: selectedArchiveId };
  }
}
