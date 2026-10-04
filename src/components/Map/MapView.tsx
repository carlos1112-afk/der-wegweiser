import { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Loader } from '@googlemaps/js-api-loader';
import type { Route, ChargingStation } from '../../types/navigation';
import { Compass, Box, Layers, Plus, Minus, Crosshair, MapPin, Zap, X, Play, Pause, Lock } from 'lucide-react';
import { TurnByTurnBanner } from './TurnByTurnBanner';
import { ElevationRibbon } from './ElevationRibbon';
import { useRouteTracker } from '../../hooks/useRouteTracker';
import { getGoogleMapsKey } from '../../services/PremiumKeyService';

export type MapTileTheme = 'topo' | 'cycle' | 'satellite' | 'dark' | 'satellite-3d' | 'topo-premium';

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
}

const THEME_META: Record<MapTileTheme, { name: string; premium: boolean }> = {
  topo:           { name: 'OpenTopoMap',    premium: false },
  cycle:          { name: 'Cycle + Terrain', premium: false },
  satellite:      { name: 'Satellit (ESRI)', premium: false },
  dark:           { name: 'Dark Vector',     premium: true },
  'satellite-3d': { name: 'Satellit 3D',     premium: true },
  'topo-premium': { name: 'Terrain Premium', premium: true },
};

const MAPLIBRE_THEMES = new Set<MapTileTheme>(['topo', 'cycle', 'satellite']);

// ── MapLibre style definitions ────────────────────────────────────────────────

function getMapLibreStyle(theme: MapTileTheme): maplibregl.StyleSpecification {
  switch (theme) {
    case 'cycle':
      return {
        version: 8,
        sources: {
          'terrain-dem': {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
          },
          cyclosm: {
            type: 'raster',
            tiles: ['https://a.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, CyclOSM',
            maxzoom: 18,
          },
          topo: {
            type: 'raster',
            tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 17,
          },
        },
        terrain: { source: 'terrain-dem', exaggeration: 1.0 },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#111' } },
          { id: 'cyclosm', type: 'raster', source: 'cyclosm' },
          { id: 'topo-overlay', type: 'raster', source: 'topo', paint: { 'raster-opacity': 0.35 } },
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: { 'hillshade-intensity': 0.4, 'hillshade-shadow-color': '#004040' },
          },
        ],
      };
    case 'topo':
      return {
        version: 8,
        sources: {
          topo: {
            type: 'raster',
            tiles: [
              'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors, SRTM',
            maxzoom: 17,
          },
        },
        layers: [{ id: 'topo', type: 'raster', source: 'topo' }],
      };
    case 'satellite':
    default:
      return {
        version: 8,
        sources: {
          esri: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '© Esri, DigitalGlobe, GeoEye, i-cubed, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo',
            maxzoom: 19,
          },
        },
        layers: [{ id: 'esri-satellite', type: 'raster', source: 'esri' }],
      };
  }
}

// ── Slope-colored GeoJSON builder ────────────────────────────────────────────

type RouteGeoJSON = GeoJSON.FeatureCollection<GeoJSON.LineString, { layer: string; color?: string; weight?: number }>;

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
}) => {
  // ── Map engine refs
  const mlContainerRef = useRef<HTMLDivElement>(null);    // MapLibre canvas
  const googleContainerRef = useRef<HTMLDivElement>(null); // Google Maps canvas
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stationMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const googleMapRef = useRef<unknown>(null); // Google Maps instance (typed loosely)
  const googleMap3dRef = useRef<HTMLElement | null>(null); // Map3DElement

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
  const isGoogleActive = tileTheme === 'satellite-3d' || tileTheme === 'topo-premium';
  const isDarkActive = tileTheme === 'dark';

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
    const targetPitch = (is3DMode || tileTheme === 'cycle') ? 45 : 0;
    map.easeTo({ pitch: targetPitch, duration: 500 });
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
      el.addEventListener('click', (e) => {
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

        if (tileTheme === 'satellite-3d') {
          const loader = new Loader({ apiKey, version: 'alpha' });
          const maps3d = await loader.importLibrary('maps3d') as any;
          if (cancelled) return;

          const map3d: HTMLElement = new maps3d.Map3DElement();
          (map3d as any).center = { lat: userLocation.lat, lng: userLocation.lng, altitude: 50 };
          (map3d as any).tilt = 67.5;
          (map3d as any).range = 800;
          (map3d as any).heading = isCourseUp ? -currentHeadingDeg : 0;
          map3d.style.width = '100%';
          map3d.style.height = '100%';

          googleContainerRef.current!.innerHTML = '';
          googleContainerRef.current!.appendChild(map3d);
          googleMap3dRef.current = map3d;
          googleMapRef.current = map3d;

          if (routePolyline.length > 1) {
            const poly = new maps3d.Polyline3DElement();
            poly.coordinates = routePolyline.map(([lat, lng]: [number, number]) => ({ lat, lng, altitude: 5 }));
            (poly as any).strokeColor = '#00f0ff';
            (poly as any).strokeWidth = 8;
            (poly as any).altitudeMode = 'RELATIVE_TO_GROUND';
            map3d.appendChild(poly);
          }
        } else {
          // topo-premium: standard Google Maps terrain
          const loader = new Loader({ apiKey, version: 'weekly' });
          const { Map } = await loader.importLibrary('maps') as any;
          if (cancelled) return;

          const gMap = new Map(googleContainerRef.current!, {
            center: { lat: userLocation.lat, lng: userLocation.lng },
            zoom: 13,
            mapTypeId: 'terrain',
            tilt: 45,
            disableDefaultUI: true,
          });
          googleMapRef.current = gMap;
        }
      } catch (err) {
        if (!cancelled) {
          setGoogleError(err instanceof Error ? err.message : 'Google Maps Fehler');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [tileTheme, isGoogleActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update Google Maps 3D position/heading ────────────────────────────────────

  useEffect(() => {
    if (tileTheme !== 'satellite-3d' || !googleMap3dRef.current) return;
    const m = googleMap3dRef.current as any;
    m.center = { lat: userLocation.lat, lng: userLocation.lng, altitude: 50 };
    if (isCourseUp) m.heading = -currentHeadingDeg;
  }, [userLocation, isCourseUp, currentHeadingDeg, tileTheme]);

  // ── Map control handlers ───────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => mapRef.current?.zoomIn(), []);
  const handleZoomOut = useCallback(() => mapRef.current?.zoomOut(), []);

  const handleRecenter = useCallback(() => {
    setIsAutoFollow(true);
    setIsCourseUp(false);
    mapRef.current?.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 16, speed: 1.5 });
    if (tileTheme === 'satellite-3d' && googleMap3dRef.current) {
      const m = googleMap3dRef.current as any;
      m.center = { lat: userLocation.lat, lng: userLocation.lng, altitude: 50 };
      m.heading = 0;
    }
  }, [userLocation, tileTheme]);

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

      {/* Dark Vector stub — Grok engine mounts here */}
      {isDarkActive && (
        <div style={{
          width: '100%', height: '100%', position: 'absolute', top: 0, left: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#060a12', gap: '16px',
        }}
          data-theme="dark"
          id="grok-vector-mount"
        >
          {/* TODO: Grok vector engine mounts here */}
          <div style={{ color: 'var(--accent-cyan)', fontSize: '2rem' }}>🌃</div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>Dark Vector Engine</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Powered by Grok — Coming Soon</div>
        </div>
      )}

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

        {/* GPS Simulation Toggle */}
        {!currentRoute && onToggleSimulation && (
          <button className="glass-panel"
            onClick={(e) => { e.stopPropagation(); onToggleSimulation(); }}
            style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: isSimulating ? 'var(--accent-neon-green)' : 'var(--accent-cyan)',
              border: `1.5px solid ${isSimulating ? 'var(--accent-neon-green)' : 'var(--accent-cyan)'}`,
              boxShadow: isSimulating ? 'var(--glow-green)' : 'var(--glow-cyan)' }}
            title={isSimulating ? 'GPS-Simulation pausieren' : 'GPS-Simulation starten (Demo-Fahrt)'}>
            {isSimulating ? <Pause size={18} className="glow-text-green" /> : <Play size={18} />}
          </button>
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

        {/* Recenter */}
        <button className="glass-panel"
          onClick={(e) => { e.stopPropagation(); handleRecenter(); }}
          style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)', cursor: 'pointer',
            border: '1.5px solid var(--accent-cyan)', boxShadow: 'var(--glow-cyan)' }}
          title="Auf GPS-Standort zentrieren">
          <Crosshair size={18} />
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

        {/* Course-up / Compass */}
        <button className="glass-panel"
          onClick={(e) => { e.stopPropagation(); setIsCourseUp(!isCourseUp); if (isCourseUp) mapRef.current?.easeTo({ bearing: 0, duration: 400 }); }}
          style={{ width: '38px', height: '38px', borderRadius: '10px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            color: isCourseUp ? 'var(--accent-neon-green)' : 'var(--accent-cyan)',
            border: `1.5px solid ${isCourseUp ? 'var(--accent-neon-green)' : 'var(--accent-cyan)'}`,
            boxShadow: isCourseUp ? 'var(--glow-green)' : 'var(--glow-cyan)' }}
          title={isCourseUp ? 'Auf Norden fixieren' : 'In Fahrtrichtung drehen (Course-Up)'}>
          <Compass size={20} style={{ transform: isCourseUp ? `rotate(${currentHeadingDeg}deg)` : 'none', transition: 'transform 0.3s ease' }} />
        </button>
      </div>
    </div>
  );
};

// ── Accuracy circle GeoJSON helper ────────────────────────────────────────────

function buildAccuracyGeoJSON(center: { lat: number; lng: number }, radiusM: number): GeoJSON.Feature<GeoJSON.Polygon> {
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
