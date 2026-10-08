import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Route, ChargingStation } from '../../types/navigation';
import { CYBERPUNK_MAP_STYLE } from './cyberpunkStyle';
import {
  stationsToClusterGeoJSON,
  CLUSTER_CUBE_FILL,
  CLUSTER_CUBE_OUTLINE,
  CLUSTER_OUTLINE_LINE_WIDTH,
  GLOW_OPACITY,
  PULSE_LAYER_ID,
  clusterHoverPaintOverrides,
  buildClusterInteractionSpecs,
  pulseOpacity,
} from './clusterCubes';
import {
  DEFAULT_PITCH,
  DEFAULT_BEARING,
  FLAT_PITCH,
  applyDarkVectorCamera,
  attachDarkVectorCameraApi,
  setFlatCameraForNegativtest,
} from './cameraContract';

const CLUSTER_SOURCE = 'cluster-cubes';
const CLUSTER_GLOW_SOURCE = 'cluster-glow';
const CLUSTER_LAYER = 'cluster-cubes-extrusion';
const CLUSTER_OUTLINE_LAYER = 'cluster-cubes-outline';
const CLUSTER_GLOW_LAYER = 'cluster-glow-extrusion';
const CLUSTER_PULSE_LAYER = PULSE_LAYER_ID;
const ROUTE_SOURCE = 'route-line';
const ROUTE_LAYER = 'route-neon';
const ROUTE_GLOW_LAYER = 'route-neon-glow';
const USER_SOURCE = 'user-point';
const USER_LAYER = 'user-pulse';
const DEST_SOURCE = 'dest-point';
const DEST_LAYER = 'dest-marker';

export interface CyberpunkMapLibreProps {
  userLocation: { lat: number; lng: number };
  heading?: number | null;
  currentRoute: Route | null;
  chargingStations: ChargingStation[];
  selectedDestination?: { lat: number; lng: number } | null;
  isCourseUp?: boolean;
  isAutoFollow?: boolean;
  is3DMode?: boolean;
  onUserInteraction?: () => void;
  onMapClick?: (lat: number, lng: number) => void;
  onStationClick?: (station: ChargingStation) => void;
  mapRefOut?: React.MutableRefObject<MapLibreMap | null>;
}

function ensureClusterLayers(map: MapLibreMap): void {
  if (!map.getSource(CLUSTER_GLOW_SOURCE)) {
    map.addSource(CLUSTER_GLOW_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'id',
    });
  }
  if (!map.getSource(CLUSTER_SOURCE)) {
    map.addSource(CLUSTER_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'id',
    });
  }

  const hoverPaint = clusterHoverPaintOverrides();

  // Soft glow under cubes (larger footprint) — Abschnitt-3 base; pulse is a separate layer
  if (!map.getLayer(CLUSTER_GLOW_LAYER)) {
    map.addLayer({
      id: CLUSTER_GLOW_LAYER,
      type: 'fill-extrusion',
      source: CLUSTER_GLOW_SOURCE,
      paint: {
        'fill-extrusion-color': CLUSTER_CUBE_FILL,
        // feature-state hover height (Abschnitt 4) — not a style swap
        'fill-extrusion-height': hoverPaint.glowHeight as never,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': GLOW_OPACITY,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }

  // Dedicated pulse-glow layer (same geometry as glow source) — opacity animated, not a style swap
  if (!map.getLayer(CLUSTER_PULSE_LAYER)) {
    const pulseSpec = buildClusterInteractionSpecs()[0];
    map.addLayer({
      id: pulseSpec.id,
      type: 'fill-extrusion',
      source: CLUSTER_GLOW_SOURCE,
      paint: pulseSpec.paint as never,
    });
  }

  if (!map.getLayer(CLUSTER_LAYER)) {
    map.addLayer({
      id: CLUSTER_LAYER,
      type: 'fill-extrusion',
      source: CLUSTER_SOURCE,
      paint: {
        'fill-extrusion-color': CLUSTER_CUBE_FILL,
        'fill-extrusion-height': hoverPaint.cubesHeight as never,
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.88,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }

  // Neon rim (#39ff14, line-width 2) on cube footprint edges
  if (!map.getLayer(CLUSTER_OUTLINE_LAYER)) {
    map.addLayer({
      id: CLUSTER_OUTLINE_LAYER,
      type: 'line',
      source: CLUSTER_SOURCE,
      paint: {
        'line-color': CLUSTER_CUBE_OUTLINE,
        'line-width': CLUSTER_OUTLINE_LINE_WIDTH,
        'line-opacity': 0.95,
        'line-blur': 0.2,
      },
    });
  }
}

function ensureRouteAndUserLayers(map: MapLibreMap): void {
  if (!map.getSource(ROUTE_SOURCE)) {
    map.addSource(ROUTE_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getLayer(ROUTE_GLOW_LAYER)) {
    map.addLayer({
      id: ROUTE_GLOW_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      paint: {
        'line-color': '#00f0ff',
        'line-width': 10,
        'line-opacity': 0.25,
        'line-blur': 4,
      },
    });
  }
  if (!map.getLayer(ROUTE_LAYER)) {
    map.addLayer({
      id: ROUTE_LAYER,
      type: 'line',
      source: ROUTE_SOURCE,
      paint: {
        'line-color': '#00f0ff',
        'line-width': 4,
        'line-opacity': 0.95,
      },
    });
  }

  if (!map.getSource(USER_SOURCE)) {
    map.addSource(USER_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getLayer(USER_LAYER)) {
    map.addLayer({
      id: USER_LAYER,
      type: 'circle',
      source: USER_SOURCE,
      paint: {
        'circle-radius': 8,
        'circle-color': '#00f0ff',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.95,
      },
    });
  }

  if (!map.getSource(DEST_SOURCE)) {
    map.addSource(DEST_SOURCE, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }
  if (!map.getLayer(DEST_LAYER)) {
    map.addLayer({
      id: DEST_LAYER,
      type: 'circle',
      source: DEST_SOURCE,
      paint: {
        'circle-radius': 10,
        'circle-color': '#ffb700',
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.95,
      },
    });
  }
}

export const CyberpunkMapLibre: React.FC<CyberpunkMapLibreProps> = ({
  userLocation,
  heading,
  currentRoute,
  chargingStations,
  selectedDestination = null,
  isCourseUp = false,
  isAutoFollow = true,
  is3DMode = true,
  onUserInteraction,
  onMapClick,
  onStationClick,
  mapRefOut,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredIdRef = useRef<number | string | null>(null);
  const stationsRef = useRef(chargingStations);
  const [webglError, setWebglError] = useState<string | null>(null);
  stationsRef.current = chargingStations;

  // Init map once — pitch/bearing MUST be set or extrusions stay flat
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    let raf = 0;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: CYBERPUNK_MAP_STYLE,
        center: [userLocation.lng, userLocation.lat],
        zoom: 15.2,
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        maxPitch: 80,
        attributionControl: { compact: true },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setWebglError(message);
      return;
    }

    mapRef.current = map;
    if (mapRefOut) mapRefOut.current = map;

    // Stable 3D camera API on the Map object + window debug hook
    attachDarkVectorCameraApi(map);
    (window as unknown as { __wwCyberMap?: MapLibreMap }).__wwCyberMap = map;

    map.on('error', (e) => {
      const msg = e?.error?.message || 'MapLibre error';
      if (/webgl|WebGL/i.test(msg)) {
        setWebglError(msg);
      }
    });

    map.on('load', () => {
      ensureClusterLayers(map);
      ensureRouteAndUserLayers(map);

      const { cubes, glow } = stationsToClusterGeoJSON(stationsRef.current);
      (map.getSource(CLUSTER_SOURCE) as GeoJSONSource).setData(cubes);
      (map.getSource(CLUSTER_GLOW_SOURCE) as GeoJSONSource).setData(glow);

      (map.getSource(USER_SOURCE) as GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Point',
              coordinates: [userLocation.lng, userLocation.lat],
            },
          },
        ],
      });

      // Force 3D camera again after style load (common MapLibre pitfall)
      applyDarkVectorCamera(map);
      map.resize();
    });

    map.on('click', (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_LAYER] });
      if (features.length > 0) {
        const props = features[0].properties as { id?: string } | null;
        const station = stationsRef.current.find((s: ChargingStation) => s.id === props?.id);
        if (station && onStationClick) {
          onStationClick(station);
          return;
        }
      }
      if (onMapClick) onMapClick(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('mousemove', CLUSTER_LAYER, (e) => {
      map.getCanvas().style.cursor = 'pointer';
      const feature = e.features?.[0];
      if (!feature || feature.id === undefined || feature.id === null) return;
      if (hoveredIdRef.current !== null && hoveredIdRef.current !== feature.id) {
        map.setFeatureState({ source: CLUSTER_SOURCE, id: hoveredIdRef.current }, { hover: false });
        map.setFeatureState({ source: CLUSTER_GLOW_SOURCE, id: hoveredIdRef.current }, { hover: false });
      }
      hoveredIdRef.current = feature.id;
      map.setFeatureState({ source: CLUSTER_SOURCE, id: feature.id }, { hover: true });
      map.setFeatureState({ source: CLUSTER_GLOW_SOURCE, id: feature.id }, { hover: true });
    });

    map.on('mouseleave', CLUSTER_LAYER, () => {
      map.getCanvas().style.cursor = '';
      if (hoveredIdRef.current !== null) {
        map.setFeatureState({ source: CLUSTER_SOURCE, id: hoveredIdRef.current }, { hover: false });
        map.setFeatureState({ source: CLUSTER_GLOW_SOURCE, id: hoveredIdRef.current }, { hover: false });
        hoveredIdRef.current = null;
      }
    });

    const markInteraction = () => {
      if (onUserInteraction) onUserInteraction();
    };
    map.on('dragstart', markInteraction);
    map.on('zoomstart', markInteraction);
    map.on('rotatestart', markInteraction);
    map.on('pitchstart', markInteraction);

    // Pulse-glow animation on dedicated layer (opacity via setPaintProperty — not a style swap)
    let pulseAlive = true;
    const pulse = (t: number) => {
      if (!pulseAlive || !mapRef.current) return;
      if (map.getLayer(CLUSTER_PULSE_LAYER)) {
        map.setPaintProperty(CLUSTER_PULSE_LAYER, 'fill-extrusion-opacity', pulseOpacity(t));
      }
      raf = requestAnimationFrame(pulse);
    };
    raf = requestAnimationFrame(pulse);

    return () => {
      pulseAlive = false;
      cancelAnimationFrame(raf);
      if (hoveredIdRef.current !== null) {
        try {
          map.setFeatureState({ source: CLUSTER_SOURCE, id: hoveredIdRef.current }, { hover: false });
          map.setFeatureState({ source: CLUSTER_GLOW_SOURCE, id: hoveredIdRef.current }, { hover: false });
        } catch {
          /* map may already be torn down */
        }
        hoveredIdRef.current = null;
      }
      const win = window as unknown as { __wwCyberMap?: MapLibreMap };
      if (win.__wwCyberMap === map) delete win.__wwCyberMap;
      map.remove();
      mapRef.current = null;
      if (mapRefOut) mapRefOut.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  // Camera: pitch/bearing contract for 3D + course-up (pitch=0 = flat extrusion)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (is3DMode) {
      const bearing = isCourseUp && heading != null ? heading : DEFAULT_BEARING;
      applyDarkVectorCamera(map, { bearing });
      map.easeTo({ pitch: DEFAULT_PITCH, bearing, duration: 450 });
    } else {
      setFlatCameraForNegativtest(map);
      map.easeTo({ pitch: FLAT_PITCH, bearing: 0, duration: 450 });
    }
  }, [is3DMode, isCourseUp, heading]);

  // Follow user
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isAutoFollow) return;
    map.easeTo({
      center: [userLocation.lng, userLocation.lat],
      duration: 500,
      bearing: isCourseUp && heading != null ? heading : map.getBearing(),
      pitch: is3DMode ? DEFAULT_PITCH : map.getPitch(),
    });
  }, [userLocation.lat, userLocation.lng, isAutoFollow, isCourseUp, heading, is3DMode]);

  // Cluster data updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureClusterLayers(map);
    const { cubes, glow } = stationsToClusterGeoJSON(chargingStations);
    (map.getSource(CLUSTER_SOURCE) as GeoJSONSource | undefined)?.setData(cubes);
    (map.getSource(CLUSTER_GLOW_SOURCE) as GeoJSONSource | undefined)?.setData(glow);
  }, [chargingStations]);

  // Route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureRouteAndUserLayers(map);
    const coords =
      currentRoute?.pathCoordinates?.map(([lat, lng]) => [lng, lat] as [number, number]) ?? [];
    const data =
      coords.length > 1
        ? {
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                properties: {},
                geometry: { type: 'LineString' as const, coordinates: coords },
              },
            ],
          }
        : { type: 'FeatureCollection' as const, features: [] };
    (map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(data);
  }, [currentRoute]);

  // User point
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureRouteAndUserLayers(map);
    (map.getSource(USER_SOURCE) as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [userLocation.lng, userLocation.lat],
          },
        },
      ],
    });
  }, [userLocation.lat, userLocation.lng]);

  // Selected destination pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    ensureRouteAndUserLayers(map);
    const features = selectedDestination
      ? [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'Point' as const,
              coordinates: [selectedDestination.lng, selectedDestination.lat] as [number, number],
            },
          },
        ]
      : [];
    (map.getSource(DEST_SOURCE) as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [selectedDestination]);

  // Resize when container becomes visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.resize(), 200);
    return () => window.clearTimeout(t);
  }, []);

  if (webglError) {
    return (
      <div
        className="cyberpunk-maplibre-root"
        data-testid="cyberpunk-maplibre-webgl-error"
        style={{
          width: '100%',
          height: '100%',
          background: '#05080f',
          color: '#7fd4e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          fontSize: 14,
        }}
      >
        WebGL nicht verfügbar — Cyberpunk-3D braucht eine GPU-fähige Ansicht.
        <br />
        <span style={{ color: '#39ff14', fontSize: 12 }}>{webglError}</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="cyberpunk-maplibre-root"
      style={{ width: '100%', height: '100%', background: '#05080f' }}
      data-testid="cyberpunk-maplibre"
    />
  );
};
