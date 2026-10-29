import { routeArchive } from './routeArchiveService';
import { UserIdentity } from './userIdentity';
import type { Location, Route, UserPreferences } from '../types/navigation';
import type { RouteLocation, RouteRequestV1 } from '../types/routing';
import { RoutingError } from '../types/routing';
import { ConsentService, CONSENT_VERSION } from './consentService';
import { FreeRouteService } from './freeRouteService';
export interface RouteGenerationParams {
  startLat: number; startLng: number; targetDistanceKm?: number; maxElevationGainM?: number;
  surfacePreference?: 'asphalt' | 'gravel' | 'any'; themes?: string[]; batteryPercent: number | null;
  bikeType: string; isMapScoutMode?: boolean;
}
export interface DestinationRouteOptions {
  mode: 'standard' | 'premium' | 'offline'; start?: RouteLocation; destinationName?: string;
  via?: Location; viaName?: string; wishes?: string;
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
    if (options.mode === 'premium') throw new RoutingError('PREMIUM_UNAVAILABLE', 'KI-Premium ist noch nicht freigegeben.');
    if (options.mode === 'offline') throw new RoutingError('OFFLINE_UNAVAILABLE', 'Lokales Offline-Routing ist noch nicht verfügbar.');
    if (!options.start?.confirmed || options.start.lat !== start.lat || options.start.lng !== start.lng) throw new RoutingError('INVALID_START', 'Bitte einen aktuellen GPS-Start oder einen manuellen Start bestätigen.');
    const ownerId = UserIdentity.getUserId();
    if (routeArchive.hasPending(ownerId)) throw new Error('Zuerst die noch offene Archiv-Sicherung abschließen.');
    const profile = prefs;
    const validBattery = Number.isFinite(profile.batteryCurrentPercent) && profile.batteryCurrentPercent >= 0 && profile.batteryCurrentPercent <= 100;
    const request: RouteRequestV1 = { version: 1, requestId: crypto.randomUUID(), kind: 'destination', planning: 'standard',
      start: options.start, destination, mandatoryStops: options.via ? [options.via] : [], interests: [],
      criteria: { hard: [], wishes: options.wishes ?? '', weights: { asphalt: profile.preferredSurface === 'asphalt' ? 1 : 0, nature: profile.preferredSurface === 'forest' ? 1 : 0, flat: profile.avoidSteepHills ? 1 : 0 } },
      profile: { bike: 'bicycle', batteryPercent: validBattery ? profile.batteryCurrentPercent : null,
        batteryCapacityWh: Number.isFinite(profile.batteryCapacityWh) && profile.batteryCapacityWh > 0 ? profile.batteryCapacityWh : null,
        confirmedAt: Date.now(), consentVersion: String(CONSENT_VERSION) } };
    const route = await FreeRouteService.plan(request);
    const result: Route = { id: route.id, title: `Route: ${options.destinationName || 'Ausgewähltes Ziel'}`, summary: `${(route.metrics.distanceM.value! / 1000).toFixed(1)} km · Kostenlos mit BRouter`,
      aiStory: route.guidanceCapability === 'track' ? 'Geprüfte Trackgeometrie. Abbiegeführung, Oberflächen- und Akkudaten sind noch nicht verfügbar.' : 'Kostenlose Fahrradroute.',
      distanceKm: route.metrics.distanceM.value! / 1000, elevationGainM: route.metrics.ascentM.value,
      estimatedTimeMin: route.metrics.durationS.value === null ? null : route.metrics.durationS.value / 60,
      estimatedBatteryConsumptionWh: route.metrics.energyWh.value, isBatterySafe: null, surfaceBreakdown: null,
      pathCoordinates: route.geometry.map(p => [p.lat, p.lng]), chargingStopsOnRoute: [], isRoadSnapped: true,
      isOfflineFallbackCorridor: false, routingEngineStatus: 'online_brouter', validatedRoute: route,
      waypoints: [{ id: 'start', ...request.start, name: 'Bestätigter Start', category: 'start' },
        ...(options.via ? [{ id: 'via', ...options.via, name: options.viaName || 'Zwischenziel', category: 'scenic' as const }] : []),
        { id: 'destination', ...destination, name: options.destinationName || 'Ziel', category: 'end' }] };
    // Save every completed computation even if another preview has since been requested.
    const archived = await routeArchive.saveGenerated(ownerId, result);
    allowed(signal);
    return { ...result, archivePlanId: archived.id };
  }
}
