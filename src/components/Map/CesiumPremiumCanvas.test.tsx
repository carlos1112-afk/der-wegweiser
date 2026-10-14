// @vitest-environment jsdom
/**
 * Unit-Tests: CesiumPremiumCanvas — Viewer-Lebenszyklus, Terrain-Fallback, Layer-Konfiguration,
 * Ladesäulen-Entities. Cesium selbst braucht echtes WebGL (in jsdom nicht verfügbar), daher wird
 * das 'cesium'-Modul komplett gemockt; der Headless-Browser-Rendertest (Playwright) prüft
 * separat, dass tatsächlich ein WebGL-Canvas mit Inhalt entsteht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { CesiumPremiumCanvas, type CesiumPremiumCanvasHandle } from './CesiumPremiumCanvas';
import type { ChargingStation } from '../../types/navigation';

const getCesiumIonToken = vi.fn();
vi.mock('../../services/CesiumKeyService', () => ({
  getCesiumIonToken: (...args: unknown[]) => getCesiumIonToken(...args),
  UserFacingError: class UserFacingError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
}));

// ── Cesium-Mock ────────────────────────────────────────────────────────────
// Alles, was die gemockte Fabrik unten referenziert, muss via vi.hoisted() VOR dem Hoisting
// des vi.mock()-Aufrufs existieren (vi.mock wird an den Dateianfang gezogen, Klassen-
// Deklarationen werden anders als "mock"-präfixierte const/let NICHT automatisch mit-gehoisted).
const cesiumMock = vi.hoisted(() => {
  const state: { lastViewerOptions: any; lastViewerInstance: any; lastGlobeMaterial: any } = {
    lastViewerOptions: undefined,
    lastViewerInstance: undefined,
    lastGlobeMaterial: undefined,
  };

  const destroyMock = vi.fn();
  const flyToMock = vi.fn();
  const entitiesAddMock = vi.fn();
  const entitiesRemoveMock = vi.fn();
  const addImageryProviderMock = vi.fn((_provider: unknown) => ({ alpha: 1 }));
  const primitivesAddMock = vi.fn();
  const scenePick = vi.fn();
  const setInputActionMock = vi.fn();
  const handlerDestroyMock = vi.fn();

  class MockEntity {
    id: string;
    opts: any;
    constructor(opts: any) {
      this.opts = opts;
      this.id = opts.id;
    }
  }

  class MockViewer {
    scene: any;
    camera = { flyTo: flyToMock };
    imageryLayers = { addImageryProvider: addImageryProviderMock };
    entities = {
      add: (opts: any) => {
        const e = new MockEntity(opts);
        entitiesAddMock(opts);
        return e;
      },
      remove: entitiesRemoveMock,
    };
    terrainProvider: any;
    private destroyed = false;

    constructor(_container: Element, options: any) {
      state.lastViewerOptions = options;
      state.lastViewerInstance = this;
      this.terrainProvider = options.terrainProvider;
      this.scene = {
        globe: {},
        primitives: { add: primitivesAddMock },
        pick: scenePick,
        canvas: {},
        verticalExaggeration: 1,
      };
      Object.defineProperty(this.scene.globe, 'material', {
        get: () => state.lastGlobeMaterial,
        set: (v) => { state.lastGlobeMaterial = v; },
      });
    }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; destroyMock(); }
  }

  return {
    state,
    destroyMock, flyToMock, entitiesAddMock, entitiesRemoveMock, addImageryProviderMock,
    primitivesAddMock, scenePick, setInputActionMock, handlerDestroyMock,
    MockEntity, MockViewer,
  };
});

const {
  state: cesiumMockState,
  destroyMock, flyToMock, entitiesAddMock, entitiesRemoveMock, addImageryProviderMock,
  primitivesAddMock, setInputActionMock, handlerDestroyMock,
} = cesiumMock;

vi.mock('cesium', () => {
  const { MockViewer, MockEntity, setInputActionMock, handlerDestroyMock } = cesiumMock;
  return {
    Viewer: MockViewer,
    EllipsoidTerrainProvider: class EllipsoidTerrainProvider {},
    Ion: { defaultAccessToken: '' },
    Cartesian3: {
      fromDegrees: vi.fn((...args: number[]) => ({ __cartesian3: args })),
    },
    Math: { toRadians: (d: number) => (d * Math.PI) / 180 },
    createWorldTerrainAsync: vi.fn(),
    createWorldImageryAsync: vi.fn(),
    createOsmBuildingsAsync: vi.fn(),
    Material: { fromType: vi.fn((type: string) => ({ __materialType: type })) },
    UrlTemplateImageryProvider: class UrlTemplateImageryProvider {
      options: any;
      constructor(options: any) {
        this.options = options;
      }
    },
    Color: {
      fromCssColorString: vi.fn(() => ({ withAlpha: vi.fn(() => ({ __color: true })) })),
    },
    HeightReference: { CLAMP_TO_GROUND: 1 },
    CallbackProperty: class CallbackProperty {
      callback: () => unknown;
      isConstant: boolean;
      constructor(callback: () => unknown, isConstant: boolean) {
        this.callback = callback;
        this.isConstant = isConstant;
      }
    },
    ScreenSpaceEventHandler: class ScreenSpaceEventHandler {
      setInputAction = setInputActionMock;
      destroy = handlerDestroyMock;
    },
    ScreenSpaceEventType: { LEFT_CLICK: 2 },
    defined: (v: unknown) => v !== undefined && v !== null,
    Entity: MockEntity,
  };
});

const station = (id: string, lat = 50, lng = 10): ChargingStation => ({
  id, name: `Station ${id}`, lat, lng, plugType: 'schuko_230v', isWeatherproof: true, isFree: true,
  openingHours: '24/7', nearbyAmenities: [], verifiedByCount: 0, createdAt: '2026-01-01',
  createdByUserId: 'u1', isVerifiedBikeInfrastructure: false,
});

beforeEach(() => {
  vi.clearAllMocks();
  cesiumMockState.lastViewerOptions = undefined;
  cesiumMockState.lastViewerInstance = undefined;
  cesiumMockState.lastGlobeMaterial = undefined;
  getCesiumIonToken.mockResolvedValue('ION_TOKEN');
});

afterEach(() => {
  cleanup();
});

const baseProps = {
  theme: 'satellite-3d' as const,
  userLocation: { lat: 50, lng: 10 },
  heading: 0,
  isCourseUp: false,
  chargingStations: [] as ChargingStation[],
};

describe('CesiumPremiumCanvas — Init & Token', () => {
  it('fetches the ion token and sets Cesium.Ion.defaultAccessToken before constructing the Viewer', async () => {
    const Cesium = await import('cesium');
    render(<CesiumPremiumCanvas {...baseProps} />);
    await waitFor(() => expect(cesiumMockState.lastViewerOptions).toBeDefined());
    expect(getCesiumIonToken).toHaveBeenCalledTimes(1);
    expect(Cesium.Ion.defaultAccessToken).toBe('ION_TOKEN');
  });

  it('starts with a flat EllipsoidTerrainProvider (never unconditionally active terrain)', async () => {
    const Cesium = await import('cesium');
    render(<CesiumPremiumCanvas {...baseProps} />);
    await waitFor(() => expect(cesiumMockState.lastViewerOptions).toBeDefined());
    expect(cesiumMockState.lastViewerOptions.terrainProvider).toBeInstanceOf(Cesium.EllipsoidTerrainProvider);
  });

  it('calls onError and never constructs a Viewer when the token broker fails', async () => {
    getCesiumIonToken.mockRejectedValueOnce(new Error('network down'));
    const onError = vi.fn();
    render(<CesiumPremiumCanvas {...baseProps} onError={onError} />);
    await waitFor(() => expect(onError).toHaveBeenCalledWith('Premium-3D-Karte konnte nicht geladen werden.'));
    expect(cesiumMockState.lastViewerOptions).toBeUndefined();
  });
});

describe('CesiumPremiumCanvas — Terrain-Fallback (Lektion MapLibre-Trichter-Bug)', () => {
  it('swaps in Cesium World Terrain when createWorldTerrainAsync resolves', async () => {
    const Cesium = await import('cesium');
    const worldTerrain = { __worldTerrain: true };
    (Cesium.createWorldTerrainAsync as any).mockResolvedValueOnce(worldTerrain);
    render(<CesiumPremiumCanvas {...baseProps} />);
    await waitFor(() => expect(cesiumMockState.lastViewerInstance?.terrainProvider).toBe(worldTerrain));
  });

  it('keeps the flat Ellipsoid fallback (no onError) when createWorldTerrainAsync rejects', async () => {
    const Cesium = await import('cesium');
    (Cesium.createWorldTerrainAsync as any).mockRejectedValueOnce(new Error('ion unreachable'));
    const onError = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<CesiumPremiumCanvas {...baseProps} onError={onError} />);
    await waitFor(() => expect(Cesium.createWorldTerrainAsync).toHaveBeenCalled());
    expect(onError).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cesium World Terrain nicht verfügbar'),
      expect.anything(),
    );
  });
});

describe('CesiumPremiumCanvas — Layer-Konfiguration je Theme', () => {
  it('satellite-3d: lädt Welt-Imagery + OSM-Buildings', async () => {
    const Cesium = await import('cesium');
    (Cesium.createWorldImageryAsync as any).mockResolvedValueOnce({ __imagery: true });
    (Cesium.createOsmBuildingsAsync as any).mockResolvedValueOnce({ __buildings: true });
    render(<CesiumPremiumCanvas {...baseProps} theme="satellite-3d" />);
    await waitFor(() => expect(addImageryProviderMock).toHaveBeenCalledWith({ __imagery: true }));
    expect(primitivesAddMock).toHaveBeenCalledWith({ __buildings: true });
  });

  it('topo-premium: setzt SlopeRamp-Material statt Imagery, keine Gebäude', async () => {
    render(<CesiumPremiumCanvas {...baseProps} theme="topo-premium" />);
    await waitFor(() => expect(cesiumMockState.lastGlobeMaterial).toEqual({ __materialType: 'SlopeRamp' }));
    expect(primitivesAddMock).not.toHaveBeenCalled();
    expect(addImageryProviderMock).not.toHaveBeenCalled();
  });

  it('cycle-premium: SlopeRamp-Material zusätzlich mit CyclOSM-Overlay (gleiche Quelle wie Free-cycle)', async () => {
    const Cesium = await import('cesium');
    render(<CesiumPremiumCanvas {...baseProps} theme="cycle-premium" />);
    await waitFor(() => expect(cesiumMockState.lastGlobeMaterial).toEqual({ __materialType: 'SlopeRamp' }));
    expect(addImageryProviderMock).toHaveBeenCalledTimes(1);
    const providerArg = addImageryProviderMock.mock.calls[0][0];
    expect(providerArg).toBeInstanceOf(Cesium.UrlTemplateImageryProvider);
    expect((providerArg as any).options.url).toContain('tile-cyclosm.openstreetmap.fr');
  });
});

describe('CesiumPremiumCanvas — Ladesäulen (Platzhalter-Boxen)', () => {
  it('fügt für jede Ladesäule eine Box-Entity mit CLAMP_TO_GROUND hinzu', async () => {
    const Cesium = await import('cesium');
    render(<CesiumPremiumCanvas {...baseProps} chargingStations={[station('s1'), station('s2')]} />);
    await waitFor(() => expect(entitiesAddMock).toHaveBeenCalledTimes(2));
    const call = entitiesAddMock.mock.calls.find(([opts]) => opts.id === 's1')![0];
    expect(call.box.heightReference).toBe(Cesium.HeightReference.CLAMP_TO_GROUND);
    expect(call.box.dimensions).toBeInstanceOf(Cesium.CallbackProperty);
  });

  it('entfernt Entities für Stationen, die aus der Liste verschwinden', async () => {
    const { rerender } = render(
      <CesiumPremiumCanvas {...baseProps} chargingStations={[station('s1'), station('s2')]} />,
    );
    await waitFor(() => expect(entitiesAddMock).toHaveBeenCalledTimes(2));
    rerender(<CesiumPremiumCanvas {...baseProps} chargingStations={[station('s1')]} />);
    await waitFor(() => expect(entitiesRemoveMock).toHaveBeenCalledTimes(1));
  });
});

describe('CesiumPremiumCanvas — imperative recenter()', () => {
  it('fliegt zur aktuellen userLocation, Nordausrichtung', async () => {
    const ref = createRef<CesiumPremiumCanvasHandle>();
    render(<CesiumPremiumCanvas {...baseProps} ref={ref} />);
    await waitFor(() => expect(cesiumMockState.lastViewerOptions).toBeDefined());
    flyToMock.mockClear();
    ref.current!.recenter();
    expect(flyToMock).toHaveBeenCalledWith(
      expect.objectContaining({ orientation: expect.objectContaining({ heading: 0 }) }),
    );
  });
});

describe('CesiumPremiumCanvas — Cleanup', () => {
  it('zerstört Viewer und Click-Handler beim Unmount', async () => {
    const { unmount } = render(<CesiumPremiumCanvas {...baseProps} />);
    await waitFor(() => expect(setInputActionMock).toHaveBeenCalled());
    unmount();
    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(handlerDestroyMock).toHaveBeenCalledTimes(1);
  });
});
