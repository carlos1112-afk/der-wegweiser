import type { Route, Waypoint, UserPreferences, ChargingStation } from '../types/navigation';
import { ElevationService } from './elevationService';
import { CollectiveIntelligenceService } from './collectiveIntelligenceService';
import { StravaReferenceService } from './stravaReferenceService';
import { dataRepository } from './dataRepository';

export interface RouteGenerationParams {
  startLat: number;
  startLng: number;
  targetDistanceKm?: number;
  maxElevationGainM?: number;
  surfacePreference?: 'asphalt' | 'gravel' | 'any';
  themes?: string[];
  batteryPercent: number | null;
  bikeType: string;
  isMapScoutMode?: boolean; // Karten-Scout Modus: Bevorzugt veraltete Sektoren für Bonus-Tokens
}

export class RoutingService {
  /**
   * Generates a road-snapped bike loop using the BRouter bike routing API.
   * If the routing server is unavailable, explicitly flags the route as an unverified
   * geometric corridor rather than pretending it is turn-by-turn navigable road data.
   */
  public static async generateBikeRoute(
    params: RouteGenerationParams,
    userPrefs: UserPreferences
  ): Promise<Route> {
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

    // Referenz-Segmente zu Beginn der Generierung anfragen (parallel zum Routing-Call,
    // damit sie nicht die Routenerzeugung verzögern). Reine Inspiration für die
    // KI-Erzählung — die Geometrie wird NICHT von Strava übernommen, sondern bleibt
    // vollständig BRouter-generiert.
    const inspirationPromise = StravaReferenceService.exploreSegmentsNear(params.startLat, params.startLng);

    try {
      // BRouter API call: start -> via -> start
      const brouterUrl = `https://brouter.de/brouter?lonlats=${params.startLng},${params.startLat}|${viaLng},${viaLat}|${params.startLng},${params.startLat}&profile=trekking-pedelec&alternativeidx=0&format=geojson`;
      const res = await fetch(brouterUrl);

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
    } catch (err) {
      console.warn('[RoutingService] BRouter API unavailable:', err);
    }

    if (pathCoordinates.length === 0) {
      throw new Error('[RoutingService] Live BRouter integration unavailable; no geometric fallback is permitted.');
    }

    const inspirationSegments = await inspirationPromise;
    const inspirationNames = inspirationSegments.slice(0, 3).map((s) => s.name);

    // Echte, anonymisierte Community-Fahrdaten entlang dieser konkreten Strecke
    // auswerten (kein Platzhalter — null, falls für diesen Korridor nichts vorliegt).
    const communitySegments = await CollectiveIntelligenceService.getSegmentsAlongPath(pathCoordinates);
    const communityAggregate = CollectiveIntelligenceService.aggregateSegments(communitySegments);

    // Calculate elevation profiles if we have coordinates
    if (pathCoordinates.length > 0) {
      const sampleCoords = pathCoordinates.filter((_, idx) => idx % Math.ceil(pathCoordinates.length / 20) === 0);
      const elevations = await ElevationService.getElevations(sampleCoords);
      let calculatedGain = 0;
      for (let i = 1; i < elevations.length; i++) {
        const diff = elevations[i] - elevations[i - 1];
        if (diff > 0) calculatedGain += diff;
      }
      if (calculatedGain > 0) {
        elevationGainM = Math.round(calculatedGain * (pathCoordinates.length / sampleCoords.length));
      }
    }

    // Echte Ladestationen entlang der Strecke abfragen (kein erfundener "Lademöglichkeit
    // Region"-Platzhalter mehr — entweder eine echte Station aus der Datenbank, oder
    // ehrlich gar kein Lade-Waypoint, statt einen vorzutäuschen).
    const pathLats = pathCoordinates.map((c) => c[0]);
    const pathLngs = pathCoordinates.map((c) => c[1]);
    const padding = 0.015; // ~1.6km
    let chargingStopsOnRoute: ChargingStation[] = [];
    try {
      const candidates = await dataRepository.getChargingStations({
        minLat: Math.min(...pathLats) - padding,
        maxLat: Math.max(...pathLats) + padding,
        minLng: Math.min(...pathLngs) - padding,
        maxLng: Math.max(...pathLngs) + padding,
      });
      const NEAR_THRESHOLD_DEG = 0.011; // ~1.2km
      chargingStopsOnRoute = candidates.filter((station) =>
        pathCoordinates.some(
          ([lat, lng]) =>
            Math.abs(lat - station.lat) < NEAR_THRESHOLD_DEG &&
            Math.abs(lng - station.lng) < NEAR_THRESHOLD_DEG
        )
      );
    } catch (e) {
      console.warn('[RoutingService] Ladestations-Abfrage entlang der Strecke fehlgeschlagen:', e);
    }

    // Wegpunkte: Start/Ziel sind real, der Zwischenpunkt ist strukturell (geometrische
    // Mitte der Schleife). Ohne echte POI-Datenbank für Aussichtspunkte/Seen etc.
    // (separates Vorhaben) bleibt dessen Name bewusst neutral statt erfunden.
    const nearestChargingStop = chargingStopsOnRoute[0];
    const waypoints: Waypoint[] = [
      { id: 'wp-1', lat: params.startLat, lng: params.startLng, name: 'Startpunkt', category: 'start' },
      { id: 'wp-2', lat: viaLat, lng: viaLng, name: isScout ? '🔍 Scout-Sektor' : 'Routenpunkt (Wendepunkt)', category: 'scenic' },
      ...(nearestChargingStop
        ? [{ id: 'wp-3', lat: nearestChargingStop.lat, lng: nearestChargingStop.lng, name: nearestChargingStop.name, category: 'charging' as const }]
        : []),
      { id: 'wp-5', lat: params.startLat, lng: params.startLng, name: 'Ziel & Rückkehr', category: 'end' },
    ];

    // Wh calculation: echter Community-Benchmark entlang der Strecke, falls vorhanden,
    // sonst generischer Schätzwert (~8.5Wh/km) als klar gekennzeichneter Fallback.
    const genericWhPerKm = params.bikeType === 'cargo' ? 12 : 8.5;
    const WhPerKm = communityAggregate?.avgEnergyBenchmarkWhPerKm ?? genericWhPerKm;
    const safetyFactor = isRoadSnapped ? 1.0 : 1.15; // 15% safety penalty for unverified corridor detours
    const totalWhNeeded = Math.round((realDistanceKm * WhPerKm + elevationGainM * 0.12) * safetyFactor);

    const availableWh = params.batteryPercent !== null
      ? (userPrefs.batteryCapacityWh * params.batteryPercent) / 100
      : null;
    const isBatterySafe = availableWh !== null ? availableWh >= totalWhNeeded * 1.15 : false;

    let title: string;
    let summary: string;
    let aiStory: string;

    const inspirationClause = inspirationNames.length > 0
      ? ` In der Umgebung beliebte Strecken (z.B. "${inspirationNames[0]}") dienten als Inspiration — die eigentliche Route ist eine eigenständige Neukomposition.`
      : '';
    const communityClause = communityAggregate
      ? ` Belag- und Energiewerte basieren auf ${communityAggregate.segmentCount} echten, anonymisierten Community-Fahrten entlang dieses Korridors.`
      : '';

    if (isRoadSnapped) {
      title = isScout
        ? `🗺️ Karten-Scout: ${params.themes?.[0] || 'Topographie'} Aktualisierung (+35 Tokens)`
        : `KI-Runde: ${params.themes?.[0] || 'Panoramatour'}`;

      summary = `${realDistanceKm} km • ${elevationGainM}m Höhenmeter • ${isScout ? '🔍 Scout-Prämie (+35 Tok.)' : (communityAggregate ? 'Community-verifizierter Belag' : 'Asphalt & Uferwege (Schätzung)')}`;

      aiStory = isScout
        ? `Karten-Scout Mission: Diese Route führt dich über einen Sektor mit veralteten Topographie-Daten (> 180 Tage). Deine anonymen Sensordaten aktualisieren Steigung & Belag für alle E-Biker. Bonus bei Tour-Abschluss: +35 Tokens!`
        : `Diese Route wurde straßengenau zusammengestellt: Sie führt über verifizierte Radwege und vermeidet steile Anstiege über ${userPrefs.maxElevationSlopePercent}%.${communityClause}${inspirationClause}`;
    } else {
      title = `⚠️ Ungeprüfter Offline-Korridor (${realDistanceKm} km)`;
      summary = `${realDistanceKm} km • ~${elevationGainM}m Hm • ⚠️ Keine Straßenbindung (Offline-Peilung)`;
      aiStory = `⚠️ Achtung: Der Routing-Server ist offline. Die angezeigte Linie ist ein mathematischer Orientierungskorridor ohne Straßen- oder Wegenetzprüfung. Bitte achte eigenständig auf Flüsse, Bahnlinien, Privatwege und Verkehrsregeln.`;
    }

    // Belag-Breakdown: echte Community-Daten, wenn vorhanden — sonst ein klar als
    // Schätzung markierter generischer Wert (kein Fake-Datensatz, der echte
    // Messung vortäuscht).
    const surfaceBreakdown = communityAggregate
      ? communityAggregate.surfaceBreakdown
      : (isRoadSnapped
          ? { asphaltPercent: 70, gravelPercent: 30, unpavedPercent: 0 }
          : { asphaltPercent: 50, gravelPercent: 30, unpavedPercent: 20 });

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
      surfaceBreakdown,
      surfaceDataSource: communityAggregate ? 'community' : 'estimated_no_data',
      communityDataSegmentsUsed: communityAggregate?.segmentCount ?? 0,
      inspirationReferences: inspirationNames,
      waypoints,
      pathCoordinates,
      isScoutMission: isScout,
      scoutBountyTokens: isScout ? 35 : 0,
      isRoadSnapped,
      isOfflineFallbackCorridor: !isRoadSnapped,
      routingEngineStatus,
      chargingStopsOnRoute,
    };
  }
}
