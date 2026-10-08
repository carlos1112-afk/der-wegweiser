/**
 * Dark Vector / Cyberpunk MapLibre — 3D camera contract.
 *
 * MapLibre fill-extrusion is visually flat at pitch 0. Dark Vector therefore
 * requires a non-zero pitch (and a fixed default bearing) on init, after style
 * load, and whenever 3D mode is active. CyclOSM / OpenTopo / Satellite are out
 * of scope for this module.
 */

/** Mandatory 3D pitch (degrees). pitch=0 → extrusion appears flat. */
export const DARK_VECTOR_PITCH = 58;

/** Mandatory default bearing (degrees) when not in course-up. */
export const DARK_VECTOR_BEARING = -18;

/** Negativtest / 2D: extrusion must look flat. */
export const FLAT_PITCH = 0;

/** Aliases matching prior CyberpunkMapLibre locals. */
export const DEFAULT_PITCH = DARK_VECTOR_PITCH;
export const DEFAULT_BEARING = DARK_VECTOR_BEARING;

/** Duck-typed MapLibre camera surface (no React). */
export interface DarkVectorCameraMap {
  getPitch(): number;
  setPitch(pitch: number): void;
  getBearing(): number;
  setBearing(bearing: number): void;
}

export type DarkVectorCameraAssert = {
  ok: boolean;
  pitch: number;
  bearing: number;
};

/** Stable API hung on the Map instance for debug / Negativtest. */
export type DarkVectorCameraApi = {
  defaults: { pitch: number; bearing: number };
  apply: (opts?: { bearing?: number }) => void;
  setFlatForNegativtest: () => void;
  restore: () => void;
  assert: (opts?: { bearing?: number }) => DarkVectorCameraAssert;
};

const CAMERA_KEY = '__darkVectorCamera' as const;

export type MapWithDarkVectorCamera = DarkVectorCameraMap & {
  [CAMERA_KEY]?: DarkVectorCameraApi;
};

function requireCameraMethods(map: DarkVectorCameraMap): void {
  if (
    typeof map.getPitch !== 'function' ||
    typeof map.setPitch !== 'function' ||
    typeof map.getBearing !== 'function' ||
    typeof map.setBearing !== 'function'
  ) {
    throw new Error('Dark Vector camera contract requires get/set Pitch and Bearing');
  }
}

/** Enforce mandatory 3D pitch + bearing (optional bearing override for course-up). */
export function applyDarkVectorCamera(
  map: DarkVectorCameraMap,
  opts?: { bearing?: number },
): void {
  requireCameraMethods(map);
  map.setPitch(DARK_VECTOR_PITCH);
  map.setBearing(opts?.bearing ?? DARK_VECTOR_BEARING);
}

/** Negativtest: pitch=0 so extrusions read as flat. */
export function setFlatCameraForNegativtest(map: DarkVectorCameraMap): void {
  requireCameraMethods(map);
  map.setPitch(FLAT_PITCH);
}

/** Restore mandatory Dark Vector camera after Negativtest or 2D toggle. */
export function restoreDarkVectorCamera(map: DarkVectorCameraMap): void {
  applyDarkVectorCamera(map);
}

/**
 * Check pitch (and bearing unless overridden) against the contract.
 * Pass opts.bearing when course-up uses a live heading.
 */
export function assertDarkVectorCamera(
  map: DarkVectorCameraMap,
  opts?: { bearing?: number },
): DarkVectorCameraAssert {
  requireCameraMethods(map);
  const pitch = map.getPitch();
  const bearing = map.getBearing();
  const expectedBearing = opts?.bearing ?? DARK_VECTOR_BEARING;
  return {
    ok: pitch === DARK_VECTOR_PITCH && bearing === expectedBearing,
    pitch,
    bearing,
  };
}

/** Attach stable `__darkVectorCamera` API on the Map object. */
export function attachDarkVectorCameraApi(map: MapWithDarkVectorCamera): DarkVectorCameraApi {
  requireCameraMethods(map);
  const api: DarkVectorCameraApi = {
    defaults: { pitch: DARK_VECTOR_PITCH, bearing: DARK_VECTOR_BEARING },
    apply: (opts) => applyDarkVectorCamera(map, opts),
    setFlatForNegativtest: () => setFlatCameraForNegativtest(map),
    restore: () => restoreDarkVectorCamera(map),
    assert: (opts) => assertDarkVectorCamera(map, opts),
  };
  map[CAMERA_KEY] = api;
  return api;
}
