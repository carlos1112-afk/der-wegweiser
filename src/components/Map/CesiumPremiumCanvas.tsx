import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Cesium from 'cesium';
import type { ChargingStation } from '../../types/navigation';
import { cycleSource } from './mapSources';
import { getCesiumIonToken, UserFacingError } from '../../services/CesiumKeyService';

export type CesiumPremiumTheme = 'satellite-3d' | 'topo-premium' | 'cycle-premium';

export interface CesiumPremiumCanvasHandle {
  /** Fliegt die Kamera zurück zur aktuellen userLocation, Nordausrichtung (Standort-Button). */
  recenter: () => void;
}

interface CesiumPremiumCanvasProps {
  theme: CesiumPremiumTheme;
  userLocation: { lat: number; lng: number };
  heading?: number | null;
  isCourseUp: boolean;
  chargingStations: ChargingStation[];
  onSelectStation?: (station: ChargingStation) => void;
  onError?: (message: string) => void;
}

// Platzhalter-Maße der Ladesäulen-Box in Metern — kein fertiges glTF-Modell vorhanden,
// siehe addOrUpdateStationEntities().
const STATION_BOX_WIDTH_M = 2.2;
const STATION_BOX_DEPTH_M = 2.2;
const STATION_BOX_HEIGHT_M = 3.2;

const CAMERA_HEIGHT_M = 900;

export const CesiumPremiumCanvas = forwardRef<CesiumPremiumCanvasHandle, CesiumPremiumCanvasProps>(
  ({ theme, userLocation, heading, isCourseUp, chargingStations, onSelectStation, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<Cesium.Viewer | null>(null);
    const stationEntitiesRef = useRef<Map<string, Cesium.Entity>>(new Map());
    // Von Click-Handler gelesen, der nur einmal pro Viewer eingerichtet wird — Refs halten die
    // jeweils aktuellen Props, ohne den Handler bei jeder Prop-Änderung neu aufzusetzen.
    const chargingStationsRef = useRef(chargingStations);
    chargingStationsRef.current = chargingStations;
    const onSelectStationRef = useRef(onSelectStation);
    onSelectStationRef.current = onSelectStation;

    useImperativeHandle(
      ref,
      () => ({
        recenter: () => {
          const viewer = viewerRef.current;
          if (!viewer || viewer.isDestroyed()) return;
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(userLocation.lng, userLocation.lat, CAMERA_HEIGHT_M),
            orientation: { heading: 0, pitch: Cesium.Math.toRadians(-60) },
            duration: 0.5,
          });
        },
      }),
      [userLocation],
    );

    // ── Viewer-Lebenszyklus: einmal pro Theme (Elternkomponente remountet via key={theme}) ──
    useEffect(() => {
      if (!containerRef.current) return;
      let cancelled = false;
      let handler: Cesium.ScreenSpaceEventHandler | undefined;

      (async () => {
        let viewer: Cesium.Viewer;
        try {
          const token = await getCesiumIonToken();
          if (cancelled) return;
          Cesium.Ion.defaultAccessToken = token;

          viewer = new Cesium.Viewer(containerRef.current!, {
            // Flaches Ellipsoid-Terrain als Startzustand: wird nur durch applyWorldTerrain()
            // ersetzt, wenn das Laden von Cesium World Terrain tatsächlich gelingt. Lektion aus
            // dem MapLibre-Trichter-Bug (Commit 9f5b3fa): Terrain darf nie unconditional aktiv
            // sein, ein Ladefehler darf nie zu verzerrtem Rendering führen.
            terrainProvider: new Cesium.EllipsoidTerrainProvider(),
            baseLayer: false,
            animation: false,
            timeline: false,
            geocoder: false,
            homeButton: false,
            sceneModePicker: false,
            navigationHelpButton: false,
            infoBox: false,
            selectionIndicator: false,
            fullscreenButton: false,
            baseLayerPicker: false,
            requestRenderMode: true,
            maximumRenderTimeChange: Infinity,
            msaaSamples: 1,
          });
          if (viewer?.scene?.globe) {
            viewer.scene.globe.maximumScreenSpaceError = 2.5;
          }
        } catch (e) {
          if (cancelled) return;
          const message =
            e instanceof UserFacingError ? e.message : 'Premium-3D-Karte konnte nicht geladen werden.';
          onError?.(message);
          return;
        }
        if (cancelled) {
          viewer.destroy();
          return;
        }
        viewerRef.current = viewer;

        await configureLayers(viewer, theme);
        if (cancelled) return;
        await applyWorldTerrain(viewer, theme);
        if (cancelled) return;

        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(userLocation.lng, userLocation.lat, CAMERA_HEIGHT_M),
          duration: 0,
        });

        addOrUpdateStationEntities(viewer, stationEntitiesRef.current, chargingStationsRef.current);

        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
          const picked = viewer.scene.pick(movement.position);
          const entity = Cesium.defined(picked) ? picked.id : undefined;
          if (!(entity instanceof Cesium.Entity)) return;
          const station = chargingStationsRef.current.find((s) => s.id === entity.id);
          if (station) onSelectStationRef.current?.(station);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      })();

      return () => {
        cancelled = true;
        handler?.destroy();
        stationEntitiesRef.current.clear();
        const viewer = viewerRef.current;
        viewerRef.current = null;
        if (viewer && !viewer.isDestroyed()) viewer.destroy();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [theme]);

    // ── Ladesäulen-Entities aktualisieren, wenn sich die Liste ändert ──
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      addOrUpdateStationEntities(viewer, stationEntitiesRef.current, chargingStations);
    }, [chargingStations]);

    // ── Kamera folgt der userLocation (wie das bisherige Google-Maps-Verhalten) ──
    useEffect(() => {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) return;
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(userLocation.lng, userLocation.lat, CAMERA_HEIGHT_M),
        orientation: isCourseUp
          ? { heading: Cesium.Math.toRadians(heading ?? 0), pitch: Cesium.Math.toRadians(-60) }
          : { heading: 0, pitch: Cesium.Math.toRadians(-60) },
        duration: 0.5,
      });
    }, [userLocation, heading, isCourseUp]);

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
  },
);
CesiumPremiumCanvas.displayName = 'CesiumPremiumCanvas';

// ── Layer-Konfiguration je Theme ──────────────────────────────────────────────

async function configureLayers(viewer: Cesium.Viewer, theme: CesiumPremiumTheme): Promise<void> {
  if (theme === 'satellite-3d') {
    try {
      const imagery = await Cesium.createWorldImageryAsync();
      if (viewer.isDestroyed()) return;
      viewer.imageryLayers.addImageryProvider(imagery);
      const buildings = await Cesium.createOsmBuildingsAsync();
      if (viewer.isDestroyed()) return;
      viewer.scene.primitives.add(buildings);
    } catch (e) {
      console.warn('[CesiumPremiumCanvas] Luftbild/Gebäude-Layer (ion) nicht verfügbar:', e);
    }
    return;
  }

  // topo-premium & cycle-premium: Hillshade-ähnliches Material statt Luftbild, keine Gebäude.
  viewer.scene.globe.material = Cesium.Material.fromType('SlopeRamp');

  if (theme === 'cycle-premium') {
    // Gleiche CyclOSM-Kachelquelle wie der Free-`cycle`-Modus (mapSources.ts) — kein
    // zusätzlicher Schlüssel nötig.
    const cyclosm = cycleSource({});
    const overlay = new Cesium.UrlTemplateImageryProvider({
      url: cyclosm.tiles[0],
      credit: cyclosm.attribution,
      maximumLevel: cyclosm.maxzoom,
    });
    const layer = viewer.imageryLayers.addImageryProvider(overlay);
    layer.alpha = 0.55;
  }
}

async function applyWorldTerrain(viewer: Cesium.Viewer, theme: CesiumPremiumTheme): Promise<void> {
  viewer.scene.verticalExaggeration = theme === 'satellite-3d' ? 1.0 : 1.8;
  try {
    const terrain = await Cesium.createWorldTerrainAsync();
    if (viewer.isDestroyed()) return;
    viewer.terrainProvider = terrain;
  } catch (e) {
    // Lektion aus dem MapLibre-Trichter-Bug (Commit 9f5b3fa): ein Terrain-Ladefehler (ion-Asset
    // nicht erreichbar, Netzwerkfehler) darf niemals zu verzerrtem Rendering führen — bleibt
    // beim im Viewer-Konstruktor gesetzten flachen EllipsoidTerrainProvider-Fallback.
    console.warn('[CesiumPremiumCanvas] Cesium World Terrain nicht verfügbar, flacher Fallback bleibt aktiv:', e);
  }
}

// ── Ladesäulen als animierte 3D-Platzhalter-Boxen ─────────────────────────────
//
// PLATZHALTER: Es liegt kein fertiges glTF-Modell für Ladesäulen vor. Statt eines echten
// Designobjekts wird hier eine pulsierende Box-Geometrie gerendert. Spätere Ersetzung:
// `box` durch `model: { uri: '.../charging-station.glb', minimumPixelSize: 48 }` ersetzen,
// Position/heightReference bleiben gleich.

function pulsingBoxDimensions(): Cesium.CallbackProperty {
  return new Cesium.CallbackProperty(() => {
    const scale = 1 + 0.15 * Math.sin(Date.now() / 600);
    return new Cesium.Cartesian3(STATION_BOX_WIDTH_M, STATION_BOX_DEPTH_M, STATION_BOX_HEIGHT_M * scale);
  }, false);
}

function addOrUpdateStationEntities(
  viewer: Cesium.Viewer,
  existing: Map<string, Cesium.Entity>,
  stations: ChargingStation[],
): void {
  const newIds = new Set(stations.map((s) => s.id));

  existing.forEach((entity, id) => {
    if (!newIds.has(id)) {
      viewer.entities.remove(entity);
      existing.delete(id);
    }
  });

  stations.forEach((station) => {
    if (existing.has(station.id)) return;
    const entity = viewer.entities.add({
      id: station.id,
      position: Cesium.Cartesian3.fromDegrees(station.lng, station.lat),
      box: {
        dimensions: pulsingBoxDimensions(),
        material: Cesium.Color.fromCssColorString('#ffb700').withAlpha(0.85),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#00e6a3'),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
    existing.set(station.id, entity);
  });
}

export default CesiumPremiumCanvas;
