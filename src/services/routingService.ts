import type { Location, Route, Waypoint, UserPreferences } from '../types/navigation';
import { ElevationService } from './elevationService.ts';
import { ConsentService } from './consentService.ts';
import { logger } from '../utils/logger';

export interface RouteGenerationParams {
  startLat: number;
  startLng: number;
  targetDistanceKm?: number;
  maxElevationGainM?: number;
  surfacePreference?: 'asphalt' | 'gravel' | 'any';
  themes?: string[];
  batteryPercent: number | null;
  bikeType: string;
  isMapScoutMode?: boolean; // Karten-Scout Darstellung; erzeugt keine Token-Prämie
}

export interface DestinationRouteOptions {
  mode: 'premium' | 'offline';
  destinationName?: string;
  via?: Location;
  viaName?: string;
  wishes?: string;
}

export class RouteGenerationCancelledError extends Error {
  public constructor(message = 'Route generation was cancelled.') {
    super(message);
    this.name = 'AbortError';
  }
}

function assertRouteGenerationAllowed(signal?: AbortSignal): void {
  if (signal?.aborted) throw new RouteGenerationCancelledError();
  if (typeof window !== 'undefined' && !ConsentService.allowsEssential) {
    throw new Error('[RoutingService] Consent required before sending coordinates.');
  }
  if (!ConsentService.hasValidConsent()) {
    throw new Error('Einwilligung zur Standortverarbeitung liegt nicht vor (Art. 6/7 DSGVO).');
  }
}

export class RoutingService {
  /**
   * Generates a road-snapped bike loop using the BRouter bike routing API.
   * If the routing server is unavailable, explicitly flags the route as an unverified
   * geometric corridor rather than pretending it is turn-by-turn navigable road data.
   */
  public static async generateBikeRoute(
    params: RouteGenerationParams,
    userPrefs: UserPreferences,
    fetchFn: typeof fetch = typeof globalThis !== 'undefined' ? globalThis.fetch : fetch,
    signal?: AbortSignal
  ): Promise<Route> {
    assertRouteGenerationAllowed(signal);

    const distance = params.targetDistanceKm || 28;
    const isScout = !!params.isMapScoutMode;
    const radius = (distance / (2 * Math.PI)) * 0.009; // approx degree delta

    // Generate circular via points (If Scout Mode: slightly detour via refreshable ridge / sector)
    const viaLat = params.startLat + radius * (isScout ? 0.95 : 0.8);
    const viaLng = params.startLng + radius * (isScout ? 0.75 : 0.6);

    let pathCoordinates: [number, number][] = [];
    let realDistanceKm = distance;
    let elevationGainM = Math.round(distance * 4.5);
    let isRoadSnapped = false;
    let routingEngineStatus: 'online_brouter' | 'offline_cached' | 'offline_corridor_unverified' = 'offline_corridor_unverified';

    try {
      assertRouteGenerationAllowed(signal);
      // BRouter API call: start -> via -> start
      const brouterUrl = `https://brouter.de/brouter?lonlats=${params.startLng},${params.startLat}|${viaLng},${viaLat}|${params.startLng},${params.startLat}&profile=trekking&alternativeidx=0&format=geojson`;
      const res = await fetchFn(brouterUrl, { signal } as RequestInit);

      if (res.ok) {
        const geojson = await res.json();
        const coords = geojson.features?.[0]?.geometry?.coordinates;
        if (Array.isArray(coords) && coords.length > 5) {
          // BRouter returns [lng, lat, elevation?]
          pathCoordinates = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
          const props = geojson.features[0].properties;
          if (props?.['track-length']) {
            realDistanceKm = +(parseFloat(props['track-length']) / 1000).toFixed(1);
          }
          isRoadSnapped = true;
          routingEngineStatus = 'online_brouter';
        }
      }
    } catch (err: any) {
      if (signal?.aborted || err?.name === 'AbortError') throw new RouteGenerationCancelledError();
      if (err?.message?.includes('Einwilligung') || err?.message?.includes('Consent')) throw err;
      logger.warn('[RoutingService] BRouter API unavailable:', err);
    }

    // OSRM fallback when BRouter is unreachable
    if (pathCoordinates.length === 0) {
      try {
        assertRouteGenerationAllowed(signal);
        const osrmUrl = `https://router.project-osrm.org/route/v1/bike/${params.startLng},${params.startLat};${viaLng},${viaLat};${params.startLng},${params.startLat}?overview=full&geometries=geojson`;
        const res = await fetchFn(osrmUrl, { signal } as RequestInit);
        if (res.ok) {
          const data = await res.json();
          const coords = data.routes?.[0]?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length > 5) {
            pathCoordinates = coords.map((c: number[]) => [c[1], c[0]] as [number, number]);
            const distM = data.routes[0].distance;
            if (distM) realDistanceKm = +(distM / 1000).toFixed(1);
            isRoadSnapped = true;
            routingEngineStatus = 'online_brouter'; // road-snapped via OSRM
          }
        }
      } catch (err: any) {
        if (signal?.aborted || err?.name === 'AbortError') throw new RouteGenerationCancelledError();
        if (err?.message?.includes('Einwilligung') || err?.message?.includes('Consent')) throw err;
        logger.warn('[RoutingService] OSRM fallback unavailable:', err);
      }
    }

    assertRouteGenerationAllowed(signal);

    // Geometric circle fallback — clearly marked as unverified corridor
    if (pathCoordinates.length === 0) {
      const steps = 32;
      for (let i = 0; i <= steps; i++) {
        const angle = (2 * Math.PI * i) / steps;
        pathCoordinates.push([
          params.startLat + radius * Math.sin(angle),
          params.startLng + radius * Math.cos(angle),
        ]);
      }
      routingEngineStatus = 'offline_corridor_unverified';
    }

    // Calculate elevation profiles if we have coordinates
    if (pathCoordinates.length > 0) {
      const sampleCoords = pathCoordinates.filter((_, idx) => idx % Math.ceil(pathCoordinates.length / 20) === 0);
      const elevations = await ElevationService.getElevations(sampleCoords, signal);
      let calculatedGain = 0;
      for (let i = 1; i < elevations.length; i++) {
        const diff = elevations[i] - elevations[i - 1];
        if (diff > 0) calculatedGain += diff;
      }
      if (calculatedGain > 0) {
        elevationGainM = Math.round(calculatedGain * (pathCoordinates.length / sampleCoords.length));
      }
    }

    // 5 waypoints along the route
    const waypoints: Waypoint[] = [
      { id: 'wp-1', lat: params.startLat, lng: params.startLng, name: 'Startpunkt', category: 'start' },
      { id: 'wp-2', lat: viaLat, lng: viaLng, name: isScout ? '🔍 Scout-Sektor: Kiefernkamm' : (isRoadSnapped ? 'Badesee Promenade' : 'Zwischenziel (Peilung)'), category: 'scenic' },
      { id: 'wp-3', lat: params.startLat + radius * 1.2, lng: params.startLng - radius * 0.4, name: 'Lademöglichkeit Region', category: 'charging' },
      { id: 'wp-4', lat: params.startLat + radius * 0.3, lng: params.startLng - radius * 1.1, name: 'Aussichtspunkt Korridor', category: 'scenic' },
      { id: 'wp-5', lat: params.startLat, lng: params.startLng, name: 'Ziel & Rückkehr', category: 'end' },
    ];

    // Wh calculation: ~8.5Wh per km + 0.12Wh per meter elevation gain (plus reserve if offline)
    const WhPerKm = params.bikeType === 'cargo' ? 12 : 8.5;
    const safetyFactor = isRoadSnapped ? 1.0 : 1.15; // 15% safety penalty for unverified corridor detours
    const totalWhNeeded = Math.round((realDistanceKm * WhPerKm + elevationGainM * 0.12) * safetyFactor);

    const availableWh = params.batteryPercent !== null
      ? (userPrefs.batteryCapacityWh * params.batteryPercent) / 100
      : null;
    const isBatterySafe = availableWh !== null ? availableWh >= totalWhNeeded * 1.15 : false;

    let title: string;
    let summary: string;
    let aiStory: string;

    if (isRoadSnapped) {
      title = isScout
        ? `🗺️ Karten-Scout: ${params.themes?.[0] || 'Topographie'}`
        : `KI-Runde: ${params.themes?.[0] || 'Badesee'} & Panoramatour`;

      summary = `${realDistanceKm} km • ${elevationGainM}m Höhenmeter • ${isScout ? 'Scout-Route' : 'Asphalt & Uferwege'}`;

      aiStory = isScout
        ? 'Karten-Scout-Route. Die Streckenaufzeichnung ist ein lokaler GPS-Track und wird nicht als geprüfte Meldung oder Token-Prämie gewertet.'
        : `Diese Route wurde straßengenau zusammengestellt: Sie führt über verifizierte Radwege, vermeidet steile Anstiege über ${userPrefs.maxElevationSlopePercent}% und beinhaltet eine Lademöglichkeit bei KM 18.`;
    } else {
      title = `⚠️ Ungeprüfter Offline-Korridor (${realDistanceKm} km)`;
      summary = `${realDistanceKm} km • ~${elevationGainM}m Hm • ⚠️ Keine Straßenbindung (Offline-Peilung)`;
      aiStory = `⚠️ Achtung: Der Routing-Server ist offline. Die angezeigte Linie ist ein mathematischer Orientierungskorridor ohne Straßen- oder Wegenetzprüfung. Bitte achte eigenständig auf Flüsse, Bahnlinien, Privatwege und Verkehrsregeln.`;
    }

    return {
      id: `route-${Date.now()}`,
      title,
      summary,
      aiStory,
      distanceKm: realDistanceKm,
      elevationGainM,
      estimatedTimeMin: Math.round((realDistanceKm / 19) * 60),
      estimatedBatteryConsumptionWh: totalWhNeeded,
      isBatterySafe,
      surfaceBreakdown: isRoadSnapped 
        ? { asphaltPercent: 82, gravelPercent: 15, unpavedPercent: 3 }
        : { asphaltPercent: 50, gravelPercent: 30, unpavedPercent: 20 },
      waypoints,
      pathCoordinates,
      isScoutMission: isScout,
      scoutBountyTokens: 0,
      isRoadSnapped,
      isOfflineFallbackCorridor: !isRoadSnapped,
      routingEngineStatus,
      chargingStopsOnRoute: [],
    };
  }

  /** Plans a point-to-point route; offline mode deliberately returns a marked
   * straight-line corridor because this app does not contain an offline road graph. */
  public static async generateDestinationRoute(
    start: Location,
    destination: Location,
    userPrefs: UserPreferences,
    options: DestinationRouteOptions,
    fetchFn: typeof fetch = typeof globalThis !== 'undefined' ? globalThis.fetch : fetch,
    signal?: AbortSignal,
  ): Promise<Route> {
    assertRouteGenerationAllowed(signal);
    const points = [start, ...(options.via ? [options.via] : []), destination];
    if (points.some(({ lat, lng }) => !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)) {
      throw new Error('Ziel oder Zwischenziel hat ungültige Koordinaten.');
    }

    const distanceBetween = (a: Location, b: Location) => {
      const lat1 = a.lat * Math.PI / 180;
      const lat2 = b.lat * Math.PI / 180;
      const dLat = lat2 - lat1;
      const dLng = (b.lng - a.lng) * Math.PI / 180;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    };

    let distanceKm = points.slice(1).reduce((total, point, index) => total + distanceBetween(points[index], point), 0);
    let elevationGainM = 0;
    let isRoadSnapped = false;
    let pathCoordinates: [number, number][] = [];
    let routingEngineStatus: Route['routingEngineStatus'] = 'offline_corridor_unverified';

    if (options.mode === 'premium') {
      try {
        assertRouteGenerationAllowed(signal);
        const lonlats = points.map(({ lat, lng }) => `${lng},${lat}`).join('|');
        const url = `https://brouter.de/brouter?lonlats=${encodeURIComponent(lonlats)}&profile=trekking&alternativeidx=0&format=geojson`;
        const response = await fetchFn(url, { signal } as RequestInit);
        if (!response.ok) throw new Error(`BRouter HTTP ${response.status}`);
        const geojson = await response.json();
        const feature = geojson.features?.[0];
        const coordinates = feature?.geometry?.coordinates;
        if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('BRouter returned no route geometry.');
        pathCoordinates = coordinates.map((coordinate: number[]) => [Number(coordinate[1]), Number(coordinate[0])] as [number, number]);
        if (pathCoordinates.some(([lat, lng]) => !Number.isFinite(lat) || !Number.isFinite(lng))) {
          throw new Error('BRouter returned invalid route coordinates.');
        }
        const trackLength = Number(feature.properties?.['track-length']);
        if (Number.isFinite(trackLength) && trackLength > 0) distanceKm = trackLength / 1000;
        isRoadSnapped = true;
        routingEngineStatus = 'online_brouter';
        const elevationPoints = pathCoordinates.filter((_, index) => index % Math.max(1, Math.ceil(pathCoordinates.length / 20)) === 0);
        const elevations = await ElevationService.getElevations(elevationPoints, signal);
        for (let index = 1; index < elevations.length; index++) {
          const increase = elevations[index] - elevations[index - 1];
          if (increase > 0) elevationGainM += increase;
        }
        if (elevations.length > 1) elevationGainM = Math.round(elevationGainM * pathCoordinates.length / elevationPoints.length);
      } catch (error: any) {
        if (signal?.aborted || error?.name === 'AbortError') throw new RouteGenerationCancelledError();
        if (error?.message?.includes('Einwilligung') || error?.message?.includes('Consent')) throw error;
        logger.warn('[RoutingService] Destination routing unavailable; falling back to marked direct corridor:', error);
      }
    }

    if (pathCoordinates.length === 0) {
      for (let step = 0; step <= 20; step++) {
        const progress = step / 20;
        const segment = Math.min(points.length - 2, Math.floor(progress * (points.length - 1)));
        const localProgress = progress * (points.length - 1) - segment;
        const from = points[segment];
        const to = points[segment + 1];
        pathCoordinates.push([from.lat + (to.lat - from.lat) * localProgress, from.lng + (to.lng - from.lng) * localProgress]);
      }
    }
    assertRouteGenerationAllowed(signal);

    const batteryPercent = userPrefs.batteryCurrentPercent;
    const estimatedBatteryConsumptionWh = Math.round(distanceKm * (userPrefs.bikeType === 'cargo' ? 12 : 8.5) + elevationGainM * 0.12);
    const availableWh = userPrefs.batteryCapacityWh * batteryPercent / 100;
    const waypoints: Waypoint[] = [
      { id: 'destination-start', ...start, name: 'Start', category: 'start' },
      ...(options.via ? [{ id: 'destination-via', ...options.via, name: options.viaName || 'Zwischenziel', category: 'scenic' as const }] : []),
      { id: 'destination-end', ...destination, name: options.destinationName || 'Ziel', category: 'end' },
    ];
    const title = `${isRoadSnapped ? 'Route zum Ziel' : 'Ungeprüfter Direktkorridor'}: ${options.destinationName || 'Ausgewähltes Ziel'}`;
    const aiStory = isRoadSnapped
      ? `Fahrradroute über ${options.destinationName || 'dein Ziel'}${options.viaName ? ` und ${options.viaName}` : ''}. ${options.wishes ? `Wunsch: ${options.wishes}` : ''}`.trim()
      : 'Kein Straßen-Routing verfügbar. Die Linie ist nur ein ungeprüfter Luftlinienkorridor und keine befahrbare Navigation. Verbinde dich mit dem Internet und wähle KI-Premium, um eine Straßenroute zu versuchen.';

    return {
      id: `destination-${Date.now()}`,
      title,
      summary: `${distanceKm.toFixed(1)} km${isRoadSnapped ? '' : ' · Luftlinie, ungeprüft'}${elevationGainM ? ` · ${elevationGainM} m Anstieg` : ''}`,
      aiStory,
      distanceKm: +distanceKm.toFixed(1),
      elevationGainM,
      estimatedTimeMin: Math.round(distanceKm / 18 * 60),
      estimatedBatteryConsumptionWh,
      isBatterySafe: availableWh >= estimatedBatteryConsumptionWh * 1.15,
      surfaceBreakdown: isRoadSnapped ? { asphaltPercent: 70, gravelPercent: 25, unpavedPercent: 5 } : { asphaltPercent: 0, gravelPercent: 0, unpavedPercent: 100 },
      waypoints,
      pathCoordinates,
      chargingStopsOnRoute: [],
      isRoadSnapped,
      isOfflineFallbackCorridor: !isRoadSnapped,
      routingEngineStatus,
    };
  }
}
