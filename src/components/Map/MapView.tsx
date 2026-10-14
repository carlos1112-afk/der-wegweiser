import { useState, useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';
import { setOptions as gMapsSetOptions, importLibrary as gMapsImportLibrary } from '@googlemaps/js-api-loader';
import type { Route, ChargingStation } from '../../types/navigation';
import { Compass, Box, Layers, Plus, Minus, Crosshair, MapPin, Zap, X, Lock } from 'lucide-react';
import { TurnByTurnBanner } from './TurnByTurnBanner';
import { ElevationRibbon } from './ElevationRibbon';
import { useRouteTracker } from '../../hooks/useRouteTracker';
import { getGoogleMapsKey } from '../../services/PremiumKeyService';
import { readMapKeys, demSource, cycleSource, topoSource, satelliteSource } from './mapSources';

export type MapTileTheme = 'topo' | 'cycle' | 'satellite' | 'satellite-3d' | 'topo-premium' | 'cycle-premium';

interface MapViewProps {
  userLocation: { lat: number; lng: number };
  accuracy?: number | null;
  heading?: number | null;
  currentRoute: Route | null;
  chargingStations: ChargingStation[];
  onSelectStation?: (station: ChargingStation) => void;
  onAutoReroute?: () => void;
  onOpenReviewModal?: (station: ChargingStation) => void;
  onPlanRouteToPoint?: (lat: number, lng: number) => void;
  onPlanRouteToStation?: (station: ChargingStation) => void;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
  onOpenScanner?: () => void;
  onCardOpenChange?: (open: boolean) => void;
  telemetry?: any;
  selectedDestination?: { lat: number; lng: number; label?: string } | null;
}

// MapLibre v6 leitet die Worker-Datei aus import.meta.url ab ("./maplibre-gl-worker.mjs" neben dem Chunk).
// Vite liefert sie dort nicht aus, der Worker lädt nicht und die Karte bleibt leer.
// scripts/copy_maplibre_worker.mjs legt Worker und Shared-Datei unter public/maplibre/ ab.
maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.mjs`);

const THEME_META: Record<MapTileTheme, { name: string; premium: boolean }> = {
  topo:            { name: 'OpenTopoMap',      premium: false },
  cycle:           { name: 'Cycle + Terrain',  premium: false },
  satellite:       { name: 'Satellit (ESRI)',  premium: false },
  'satellite-3d':  { name: 'Satellit Premium', premium: true  },
  'topo-premium':  { name: 'Topo Premium',     premium: true  },
  'cycle-premium': { name: 'Bike Premium',     premium: true  },
};

const MAPLIBRE_THEMES = new Set<MapTileTheme>(['topo', 'cycle', 'satellite']);

/**
 * Terrain-Überhöhung je Free-Theme. Wird NICHT im Style-JSON gesetzt (siehe unten),
 * sondern erst von applyTerrain() aktiviert, wenn der Nutzer den 3D-Toggle einschaltet.
 * Grund: Mit Terrain fest im Style verschiebt MapLibre die Bodengeometrie anhand der
 * DEM-Kachel-Werte IMMER, auch im "2D"-Modus. Liefert die DEM-Quelle bei einem Hakler
 * (Netzwerk, falsche/fehlende Kachel) Müllwerte statt echter Höhendaten, entstehen daraus
 * chaotische Höhen-Spitzen direkt unter der Kamera — sichtbar als der "Trichter"-Rendering-
 * Fehler (radial verzerrtes Schachbrettmuster), der auch ohne aktiven 3D-Toggle auftrat.
 */
const TERRAIN_EXAGGERATION: Record<'topo' | 'cycle' | 'satellite', number> = {
  topo: 1.2,
  cycle: 1.0,
  satellite: 1.0,
};

function applyTerrain(map: maplibregl.Map, theme: MapTileTheme, enabled: boolean): void {
  if (!enabled || !(theme in TERRAIN_EXAGGERATION)) {
    map.setTerrain(null);
    return;
  }
  map.setTerrain({ source: 'terrain-dem', exaggeration: TERRAIN_EXAGGERATION[theme as 'topo' | 'cycle' | 'satellite'] });
}

// ── MapLibre style definitions ────────────────────────────────────────────────

function getMapLibreStyle(theme: MapTileTheme): maplibregl.StyleSpecification | string {
  const keys = readMapKeys();

  switch (theme) {
    case 'cycle': {
      const cycle = cycleSource(keys);
      const topo = topoSource(keys, false);
      const dem = demSource(keys);
      return {
        version: 8,
        sources: {
          'terrain-dem': { type: 'raster-dem', ...dem },
          cyclosm: { type: 'raster', tiles: cycle.tiles, tileSize: 256, attribution: cycle.attribution, maxzoom: cycle.maxzoom },
          topo: { type: 'raster', tiles: topo.tiles, tileSize: 256, maxzoom: topo.maxzoom },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#111' } } as maplibregl.BackgroundLayerSpecification,
          { id: 'cyclosm', type: 'raster', source: 'cyclosm' } as maplibregl.RasterLayerSpecification,
          { id: 'topo-overlay', type: 'raster', source: 'topo', paint: { 'raster-opacity': 0.35 } } as maplibregl.RasterLayerSpecification,
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: { 'hillshade-exaggeration': 0.4, 'hillshade-shadow-color': '#004040' },
          } as maplibregl.HillshadeLayerSpecification,
        ],
      };
    }
    case 'topo': {
      const topo = topoSource(keys, true);
      const dem = demSource(keys);
      return {
        version: 8,
        sources: {
          'terrain-dem': { type: 'raster-dem', ...dem },
          topo: { type: 'raster', tiles: topo.tiles, tileSize: 256, attribution: topo.attribution, maxzoom: topo.maxzoom },
        },
        layers: [
          { id: 'topo', type: 'raster', source: 'topo' } as maplibregl.RasterLayerSpecification,
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: { 'hillshade-exaggeration': 0.5, 'hillshade-shadow-color': '#2a1a08' },
          } as maplibregl.HillshadeLayerSpecification,
        ],
      };
    }
    case 'satellite':
    default: {
      const sat = satelliteSource(keys);
      const dem = demSource(keys);
      return {
        version: 8,
        sources: {
          'terrain-dem': { type: 'raster-dem', ...dem },
          esri: { type: 'raster', tiles: sat.tiles, tileSize: 256, attribution: sat.attribution, maxzoom: sat.maxzoom },
        },
        layers: [
          { id: 'esri-satellite', type: 'raster', source: 'esri' } as maplibregl.RasterLayerSpecification,
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: { 'hillshade-exaggeration': 0.25, 'hillshade-shadow-color': '#000020' },
          } as maplibregl.HillshadeLayerSpecification,
        ],
      };
    }
  }
}

// ── Google Maps satellite hybrid — night style (from Google Styled Maps) ─────
const SATELLITE_NIGHT_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];

// ── Google Maps topo-premium style (fallback when no Map ID configured) ──────
const TOPO_PREMIUM_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#f5ede0' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#4a3728' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5ede0' }] },
  { featureType: 'landscape.natural',  elementType: 'geometry',           stylers: [{ color: '#d4e8c2' }] },
  { featureType: 'poi.park',           elementType: 'geometry',           stylers: [{ color: '#b8dba0' }] },
  { featureType: 'poi.park',           elementType: 'labels.text.fill',   stylers: [{ color: '#2d6a1f' }] },
  { featureType: 'water',              elementType: 'geometry',           stylers: [{ color: '#7ab8d4' }] },
  { featureType: 'water',              elementType: 'labels.text.fill',   stylers: [{ color: '#1a5c80' }] },
  { featureType: 'water',              elementType: 'labels.text.stroke', stylers: [{ color: '#7ab8d4' }] },
  { featureType: 'road',               elementType: 'geometry',           stylers: [{ color: '#ffffff' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',    stylers: [{ color: '#c8b89a' }] },
  { featureType: 'road',               elementType: 'labels.text.fill',   stylers: [{ color: '#6b4f3a' }] },
  { featureType: 'road.highway',       elementType: 'geometry',           stylers: [{ color: '#f5c05a' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',    stylers: [{ color: '#e0a030' }] },
  { featureType: 'road.local',         elementType: 'geometry',           stylers: [{ color: '#ede8df' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',           stylers: [{ color: '#e8ddd0' }] },
  { featureType: 'administrative',     elementType: 'geometry.stroke',    stylers: [{ color: '#9c8070' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#4a3728' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business',       stylers: [{ visibility: 'off' }] },
];

// ── Google Maps cycle-premium style (fallback when no Map ID configured) ─────
const CYCLE_PREMIUM_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f0e8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#3d3522' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0e8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f5c842' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#e8e0d0' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#c8e6c9' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#2e7d32' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#a0c4e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#1a6fa8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#dcedc8' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#b0a090' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// ── Slope-colored GeoJSON builder ────────────────────────────────────────────

type RouteGeoJSON = FeatureCollection<LineString, { layer: string; color?: string; weight?: number }>;

function buildRouteGeoJSON(polyline: [number, number][], route: Route | null): RouteGeoJSON {
  const features: RouteGeoJSON['features'] = [];
  if (polyline.length < 2) return { type: 'FeatureCollection', features };

  // Full glow underlay
  features.push({
    type: 'Feature',
    properties: { layer: 'glow' },
    geometry: { type: 'LineString', coordinates: polyline.map(([lat, lng]) => [lng, lat]) },
  });

  // Per-segment slope colors
  polyline.forEach((pt, idx) => {
    if (idx >= polyline.length - 1) return;
    const next = polyline[idx + 1];
    const progress = idx / polyline.length;
    const isClimb =
      (progress > 0.35 && progress < 0.5) ||
      (route !== null && route.elevationGainM > 180 && idx % 7 === 2);
    const isDownhill = (progress > 0.75 && progress < 0.9) || idx % 7 === 5;
    const color = isClimb ? '#ff3333' : isDownhill ? '#00ff66' : '#00f0ff';
    features.push({
      type: 'Feature',
      properties: { layer: 'segment', color, weight: isClimb ? 6 : 5 },
      geometry: { type: 'LineString', coordinates: [[pt[1], pt[0]], [next[1], next[0]]] },
    });
  });

  return { type: 'FeatureCollection', features };
}

// ── Distance helper ────────────────────────────────────────────────────────────

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Helper to get route waypoints for action card display ─────────────────────

const getRouteWaypoints = (route: Route | null) => {
  if (!route) return [];
  const waypoints: { id: string; lat: number; lng: number; title: string; category: string; description?: string }[] = [];
  const existingCategories = new Set<string>();
  if (route.waypoints?.length) {
    route.waypoints.forEach((wp) => {
      const category = wp.category || 'scenic';
      waypoints.push({
        id: wp.id || `wp-${wp.lat}-${wp.lng}`,
        lat: wp.lat, lng: wp.lng,
        title: wp.name || (category === 'start' ? 'Start' : category === 'end' ? 'Ziel' : 'Wegpunkt'),
        category, description: wp.description,
      });
      existingCategories.add(category);
    });
  }
  if (!existingCategories.has('start') && route.pathCoordinates?.length) {
    waypoints.push({ id: 'route-start-point', lat: route.pathCoordinates[0][0], lng: route.pathCoordinates[0][1], title: 'Startpunkt', category: 'start' });
  }
  if (!existingCategories.has('end') && route.pathCoordinates && route.pathCoordinates.length > 1) {
    const last = route.pathCoordinates[route.pathCoordinates.length - 1];
    waypoints.push({ id: 'route-end-point', lat: last[0], lng: last[1], title: 'Zielort', category: 'end' });
  }
  if (route.chargingStopsOnRoute?.length) {
    route.chargingStopsOnRoute.forEach((station) => {
      const already = waypoints.some((wp) => Math.abs(wp.lat - station.lat) < 0.0001 && Math.abs(wp.lng - station.lng) < 0.0001);
      if (!already) {
        waypoints.push({ id: `route-charge-${station.id}`, lat: station.lat, lng: station.lng, title: station.name, category: 'charging', description: `Lade-Stopp (${station.plugType.toUpperCase()})` });
      }
    });
  }
  return waypoints;
};

// ── Main component ─────────────────────────────────────────────────────────────

export const MapView: React.FC<MapViewProps> = ({
  userLocation,
  accuracy,
  heading,
  currentRoute,
  chargingStations,
  onSelectStation,
  onAutoReroute,
  onOpenReviewModal,
  onPlanRouteToPoint,
  onPlanRouteToStation,
  isSimulating,
  onToggleSimulation,
  onCardOpenChange,
  telemetry,
  selectedDestination: externalSelectedDestination,
}) => {
  // ── Map engine refs
  const mlContainerRef = useRef<HTMLDivElement>(null);    // MapLibre canvas
  const googleContainerRef = useRef<HTMLDivElement>(null); // Google Maps canvas
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stationMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const googleMapRef = useRef<unknown>(null); // Google Maps instance (typed loosely)

  // ── State
  const [is3DMode, setIs3DMode] = useState(false);
  const [isCourseUp, setIsCourseUp] = useState(false);
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [tileTheme, setTileTheme] = useState<MapTileTheme>('cycle');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStationState, setSelectedStationState] = useState<ChargingStation | null>(null);
  const [mapStyleReady, setMapStyleReady] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const isMaplibreActive = MAPLIBRE_THEMES.has(tileTheme);
  const isGoogleActive = tileTheme === 'satellite-3d' || tileTheme === 'topo-premium' || tileTheme === 'cycle-premium';
  const isCardOpen = Boolean((!currentRoute && selectedDestination) || selectedStationState);
  const routePolyline = currentRoute?.pathCoordinates || [];
  const routeWaypoints = getRouteWaypoints(currentRoute);

  const { currentManeuver, isOffRoute, offRouteDistanceM } = useRouteTracker(
    userLocation, currentRoute,
    () => { if (onAutoReroute) onAutoReroute(); }
  );

  const currentHeadingDeg = heading ?? 0;

  useEffect(() => {
    if (currentRoute) setSelectedDestination(null);
  }, [currentRoute]);

  // Sync external selectedDestination prop (from SearchInput) into internal state
  useEffect(() => {
    if (externalSelectedDestination) {
      setSelectedStationState(null);
      setSelectedDestination({ lat: externalSelectedDestination.lat, lng: externalSelectedDestination.lng });
      if (mapRef.current && isMaplibreActive) {
        mapRef.current.flyTo({ center: [externalSelectedDestination.lng, externalSelectedDestination.lat], zoom: 15, speed: 1.5 });
      }
    }
  }, [externalSelectedDestination, isMaplibreActive]);

  useEffect(() => {
    if (onCardOpenChange) onCardOpenChange(isCardOpen);
  }, [isCardOpen, onCardOpenChange]);

  // ── MapLibre: add/update overlay layers ──────────────────────────────────────

  const addMapOverlays = useCallback((map: maplibregl.Map) => {
    // Route source + layers
    if (!map.getSource('route')) {
      map.addSource('route', { type: 'geojson', data: buildRouteGeoJSON(routePolyline, currentRoute) });
      map.addLayer({ id: 'route-glow', type: 'line', source: 'route',
        filter: ['==', ['get', 'layer'], 'glow'],
        paint: { 'line-color': '#00f0ff', 'line-width': 10, 'line-opacity': 0.35, 'line-blur': 4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route-main', type: 'line', source: 'route',
        filter: ['==', ['get', 'layer'], 'segment'],
        paint: { 'line-color': ['coalesce', ['get', 'color'], '#00f0ff'], 'line-width': 5, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' } });
    }
    // Accuracy circle source + layer
    if (!map.getSource('accuracy')) {
      const accData = buildAccuracyGeoJSON(userLocation, accuracy ?? 0);
      map.addSource('accuracy', { type: 'geojson', data: accData });
      map.addLayer({ id: 'accuracy-fill', type: 'fill', source: 'accuracy',
        paint: { 'fill-color': '#00f0ff', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'accuracy-border', type: 'line', source: 'accuracy',
        paint: { 'line-color': '#00f0ff', 'line-width': 1, 'line-opacity': 0.5 } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MapLibre: init (once) ────────────────────────────────────────────────────

  useEffect(() => {
    if (!mlContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mlContainerRef.current,
      style: getMapLibreStyle('cycle'),
      center: [userLocation.lng, userLocation.lat],
      zoom: 15,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    map.on('load', () => {
      setMapStyleReady(true);
      addMapOverlays(map);

      // User marker
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);
    });

    map.on('style.load', () => {
      setMapStyleReady(true);
      addMapOverlays(map);
    });

    map.on('dragstart', () => setIsAutoFollow(false));
    map.on('zoomstart', () => setIsAutoFollow(false));
    map.on('click', (e) => {
      if (currentRoute) return;
      setSelectedStationState(null);
      setSelectedDestination({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;
    return () => {
      userMarkerRef.current?.remove();
      stationMarkersRef.current.forEach((m) => m.remove());
      stationMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MapLibre: style switch on theme change ────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMaplibreActive) return;
    setMapStyleReady(false);
    map.setStyle(getMapLibreStyle(tileTheme));
  }, [tileTheme, isMaplibreActive]);

  // Resize MapLibre when it becomes visible again
  useEffect(() => {
    if (!isMaplibreActive || !mapRef.current) return;
    setTimeout(() => mapRef.current?.resize(), 50);
  }, [isMaplibreActive]);

  // ── MapLibre: update user position + bearing ──────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMaplibreActive) return;

    userMarkerRef.current?.setLngLat([userLocation.lng, userLocation.lat]);

    const el = userMarkerRef.current?.getElement();
    if (el) {
      el.style.transform = `rotate(${heading ?? 0}deg)`;
    }

    if (isAutoFollow) {
      map.easeTo({ center: [userLocation.lng, userLocation.lat], duration: 500 });
    }

    if (isCourseUp) {
      map.easeTo({ bearing: -(heading ?? 0), duration: 300 });
    }
  }, [userLocation, heading, isAutoFollow, isCourseUp, isMaplibreActive]);

  // ── MapLibre: 3D pitch toggle ─────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMaplibreActive) return;
    const targetPitch = is3DMode ? 45 : 0;
    map.easeTo({ pitch: targetPitch, duration: 500 });

    const apply = () => applyTerrain(map, tileTheme, is3DMode);
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once('style.load', apply);
    }
  }, [is3DMode, tileTheme, isMaplibreActive]);

  // ── MapLibre: update route GeoJSON ────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMaplibreActive || !mapStyleReady) return;
    const src = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildRouteGeoJSON(routePolyline, currentRoute));
  }, [currentRoute, routePolyline, mapStyleReady, isMaplibreActive]);

  // ── MapLibre: update accuracy circle ─────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMaplibreActive || !mapStyleReady) return;
    const src = map.getSource('accuracy') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(buildAccuracyGeoJSON(userLocation, accuracy ?? 0));
  }, [accuracy, userLocation, mapStyleReady, isMaplibreActive]);

  // ── MapLibre: charging station markers ───────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMaplibreActive) return;

    const existing = stationMarkersRef.current;
    const newIds = new Set(chargingStations.map((s) => s.id));

    // Remove stale
    existing.forEach((marker, id) => {
      if (!newIds.has(id)) { marker.remove(); existing.delete(id); }
    });

    // Add new
    chargingStations.forEach((station) => {
      if (existing.has(station.id)) return;
      const el = document.createElement('div');
      el.className = 'cyberpunk-marker-pin marker-charging';
      el.textContent = '⚡';
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        setSelectedDestination(null);
        setSelectedStationState(station);
        if (onSelectStation) onSelectStation(station);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([station.lng, station.lat])
        .addTo(map);
      existing.set(station.id, marker);
    });
  }, [chargingStations, isMaplibreActive, onSelectStation]);

  // ── Google Maps: lazy init for premium modes ──────────────────────────────────

  useEffect(() => {
    if (!isGoogleActive || !googleContainerRef.current) return;

    let cancelled = false;
    setGoogleError(null);

    (async () => {
      try {
        const apiKey = await getGoogleMapsKey();
        if (cancelled) return;

        gMapsSetOptions({ key: apiKey, v: 'weekly' });
        const { Map } = await gMapsImportLibrary('maps') as any;
        if (cancelled) return;

        const mapOptions: Record<string, unknown> = {
          center: { lat: userLocation.lat, lng: userLocation.lng },
          disableDefaultUI: true,
        };

        if (tileTheme === 'satellite-3d') {
          mapOptions.zoom = 14;
          mapOptions.mapTypeId = 'hybrid';
          mapOptions.tilt = 0;
          mapOptions.styles = SATELLITE_NIGHT_STYLE;
        } else if (tileTheme === 'topo-premium') {
          mapOptions.zoom = 13;
          mapOptions.mapTypeId = 'terrain';
          mapOptions.tilt = 45;
          const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_TOPO as string | undefined;
          if (mapId) mapOptions.mapId = mapId;
          else mapOptions.styles = TOPO_PREMIUM_STYLE;
        } else if (tileTheme === 'cycle-premium') {
          mapOptions.zoom = 14;
          mapOptions.mapTypeId = 'roadmap';
          mapOptions.tilt = 0;
          const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID_CYCLE as string | undefined;
          if (mapId) mapOptions.mapId = mapId;
          else mapOptions.styles = CYCLE_PREMIUM_STYLE;
        }

        const gMap = new Map(googleContainerRef.current!, mapOptions);
        googleMapRef.current = gMap;
      } catch (err) {
        if (!cancelled) {
          setGoogleError(err instanceof Error ? err.message : 'Google Maps Fehler');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [tileTheme, isGoogleActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update Google Maps position/heading ──────────────────────────────────────

  useEffect(() => {
    if (!isGoogleActive || !googleMapRef.current) return;
    const m = googleMapRef.current as any;
    m.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
    if (tileTheme === 'satellite-3d' && isCourseUp) {
      m.setHeading(-currentHeadingDeg);
    }
  }, [userLocation, isCourseUp, currentHeadingDeg, tileTheme, isGoogleActive]);

  // ── Map control handlers ───────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  const handleRecenter = useCallback(() => {
    setIsAutoFollow(true);
    setIsCourseUp(false);
    mapRef.current?.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 16, speed: 1.5 });
    if (isGoogleActive && googleMapRef.current) {
      const m = googleMapRef.current as any;
      m.setCenter({ lat: userLocation.lat, lng: userLocation.lng });
      if (tileTheme === 'satellite-3d') m.setHeading(0);
    }
  }, [userLocation, tileTheme]);

  /**
   * Standort-Button (Zielkreuz + Kompass zusammengelegt, wie bei Google Maps' eigenem
   * Standort-Button): 1. Tap zentriert (falls nicht zentriert), 2. Tap schaltet
   * Course-Up ein, 3. Tap schaltet zurück auf Nordausrichtung (bleibt zentriert).
   */
  const handleLocationButton = useCallback(() => {
    if (!isAutoFollow) {
      handleRecenter();
      return;
    }
    if (!isCourseUp) {
      setIsCourseUp(true);
      return;
    }
    setIsCourseUp(false);
    mapRef.current?.easeTo({ bearing: 0, duration: 400 });
    if (isGoogleActive && googleMapRef.current && tileTheme === 'satellite-3d') {
      (googleMapRef.current as any).setHeading(0);
    }
  }, [isAutoFollow, isCourseUp, handleRecenter, isGoogleActive, tileTheme]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    if (currentRoute) return;
    setSelectedStationState(null);
    setSelectedDestination({ lat, lng });
  }, [currentRoute]);

  const handleStationClick = useCallback((station: ChargingStation) => {
    setSelectedDestination(null);
    setSelectedStationState(station);
    if (onSelectStation) onSelectStation(station);
  }, [onSelectStation]);

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <TurnByTurnBanner
        maneuver={currentManeuver}
        isOffRoute={isOffRoute}
        offRouteDistanceM={offRouteDistanceM}
        onManualReroute={onAutoReroute}
      />

      {/* MapLibre canvas — free modes */}
      <div
        ref={mlContainerRef}
        style={{
          width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
          display: isMaplibreActive ? 'block' : 'none',
        }}
      />

      {/* Google Maps canvas — premium modes */}
      <div
        ref={googleContainerRef}
        style={{
          width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
          display: isGoogleActive ? 'block' : 'none',
          backgroundColor: '#0a0d14',
        }}
      >
        {googleError && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: '12px', color: 'var(--text-muted)', padding: '24px', textAlign: 'center' }}>
            <Lock size={32} style={{ color: 'var(--accent-gold)' }} />
            <div style={{ color: '#fff', fontWeight: 'bold' }}>Premium-Karte nicht verfügbar</div>
            <div style={{ fontSize: '0.8rem' }}>{googleError}</div>
          </div>
        )}
      </div>

      {/* Elevation ribbon */}
      {!selectedDestination && !selectedStationState && (
        <ElevationRibbon
          currentRoute={currentRoute}
          userLocation={userLocation}
          telemetry={telemetry}
          isNavigating={Boolean(currentRoute)}
        />
      )}

      {/* ── Destination action card ─────────────────────────────────────────── */}
      {!currentRoute && selectedDestination && (
        <div className="glass-panel action-bottom-card" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', bottom: '20px', left: '12px', right: '12px', maxWidth: '520px', margin: '0 auto',
            zIndex: 2200, padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '10px', backgroundColor: 'rgba(5, 10, 20, 0.96)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(0, 240, 255, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MapPin size={18} className="glow-text-cyan" />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                Neues Ziel gewählt
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ~{distKm(userLocation.lat, userLocation.lng, selectedDestination.lat, selectedDestination.lng).toFixed(1)} km Luftlinie
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button className="btn-cyberpunk btn-gold"
              onClick={(e) => { e.stopPropagation(); if (onPlanRouteToPoint) onPlanRouteToPoint(selectedDestination.lat, selectedDestination.lng); setSelectedDestination(null); }}
              style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              Route planen
            </button>
            <button onClick={(e) => { e.stopPropagation(); setSelectedDestination(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Charging station action card ────────────────────────────────────── */}
      {selectedStationState && (
        <div className="glass-panel action-bottom-card" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', bottom: '20px', left: '12px', right: '12px', maxWidth: '520px', margin: '0 auto',
            zIndex: 2200, padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--accent-gold)',
            boxShadow: 'var(--glow-gold)', display: 'flex', flexDirection: 'column', gap: '8px',
            backgroundColor: 'rgba(5, 10, 20, 0.96)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255, 183, 0, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Zap size={18} className="glow-text-gold" />
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {selectedStationState.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {selectedStationState.plugType.toUpperCase()} · ~{distKm(userLocation.lat, userLocation.lng, selectedStationState.lat, selectedStationState.lng).toFixed(1)} km
                </div>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setSelectedStationState(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            <button className="btn-cyberpunk btn-gold"
              onClick={(e) => { e.stopPropagation(); if (onPlanRouteToStation) onPlanRouteToStation(selectedStationState); setSelectedStationState(null); }}
              style={{ flex: 1, padding: '7px 12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
              Hierher navigieren
            </button>
            {onOpenReviewModal && (
              <button className="btn-cyberpunk"
                onClick={(e) => { e.stopPropagation(); onOpenReviewModal(selectedStationState); setSelectedStationState(null); }}
                style={{ padding: '7px 12px', fontSize: '0.75rem' }} title="Bewertung abgeben (+10 Tokens)">
                ⭐ Bewerten
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Floating HUD Controls ───────────────────────────────────────────── */}
      <div
        className={`floating-controls-right ${isCardOpen ? 'card-open' : ''} ${currentRoute ? 'nav-active' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: currentRoute ? '148px' : isCardOpen ? '106px' : '20px',
          right: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '6px', transition: 'bottom 0.25s ease',
        }}
      >
        {/* Layer Picker Menu */}
        {!currentRoute && showLayerMenu && (
          <div className="glass-panel" style={{
            position: 'absolute', bottom: '130px', right: '48px', padding: '10px',
            display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px',
            backgroundColor: 'rgba(10, 18, 30, 0.98)', border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)', zIndex: 2500,
          }}>
            {(Object.keys(THEME_META) as MapTileTheme[]).map((key) => (
              <button key={key}
                onClick={() => { setTileTheme(key); setShowLayerMenu(false); }}
                className={`btn-cyberpunk ${tileTheme === key ? 'btn-gold' : ''}`}
                style={{ fontSize: '0.75rem', padding: '6px 10px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {THEME_META[key].premium && <Lock size={10} style={{ color: 'var(--accent-gold)', flexShrink: 0 }} />}
                  {THEME_META[key].name}
                </span>
                {tileTheme === key && <span style={{ color: 'var(--accent-gold)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* Zoom pill */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', borderRadius: '10px',
          overflow: 'hidden', border: '1.5px solid var(--accent-cyan)', boxShadow: 'var(--glow-cyan)' }}>
          <button onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
            style={{ width: '38px', height: '32px', background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', cursor: 'pointer' }}
            title="Vergrößern">
            <Plus size={18} />
          </button>
          <div style={{ height: '1px', backgroundColor: 'rgba(0, 240, 255, 0.3)' }} />
          <button onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
            style={{ width: '38px', height: '32px', background: 'none', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', cursor: 'pointer' }}
            title="Verkleinern">
            <Minus size={18} />
          </button>
        </div>

        {/* Standort & Ausrichtung (Neu zentrieren + Course-Up, zusammengelegt) */}
        <button className="glass-panel"
          onClick={(e) => { e.stopPropagation(); handleLocationButton(); }}
          style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: isCourseUp ? 'var(--accent-neon-green)' : 'var(--accent-cyan)',
            border: `1.5px solid ${isCourseUp ? 'var(--accent-neon-green)' : 'var(--accent-cyan)'}`,
            boxShadow: isCourseUp ? 'var(--glow-green)' : 'var(--glow-cyan)' }}
          title={!isAutoFollow ? 'Auf GPS-Standort zentrieren' : isCourseUp ? 'Auf Norden fixieren' : 'In Fahrtrichtung drehen (Course-Up)'}>
          {isCourseUp
            ? <Compass size={18} style={{ transform: `rotate(${currentHeadingDeg}deg)`, transition: 'transform 0.3s ease' }} />
            : <Crosshair size={18} />}
        </button>

        {/* Layer picker button */}
        {!currentRoute && (
          <button className="glass-panel"
            onClick={(e) => { e.stopPropagation(); setShowLayerMenu(!showLayerMenu); }}
            style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', cursor: 'pointer',
              border: '1.5px solid var(--accent-cyan)',
              boxShadow: showLayerMenu ? 'var(--glow-cyan)' : '0 4px 16px rgba(0,0,0,0.5)' }}
            title="Karten-Ebene wechseln">
            <Layers size={18} />
          </button>
        )}

        {/* 3D toggle (only for MapLibre modes) */}
        {!currentRoute && isMaplibreActive && (
          <button className="glass-panel"
            onClick={(e) => { e.stopPropagation(); setIs3DMode(!is3DMode); }}
            style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', cursor: 'pointer',
              border: '1.5px solid var(--accent-cyan)',
              boxShadow: is3DMode ? 'var(--glow-cyan)' : '0 4px 16px rgba(0,0,0,0.5)' }}
            title="3D-Terrain umschalten">
            <Box size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

// ── Accuracy circle GeoJSON helper ────────────────────────────────────────────

function buildAccuracyGeoJSON(center: { lat: number; lng: number }, radiusM: number): Feature<Polygon> {
  if (radiusM <= 0) return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[]] } };
  const pts = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= pts; i++) {
    const angle = (i / pts) * 2 * Math.PI;
    const dLat = (radiusM / 111320) * Math.cos(angle);
    const dLng = (radiusM / (111320 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([center.lng + dLng, center.lat + dLat]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
}
