import { describe, expect, it } from 'vitest';
import {
  DARK_VECTOR_PITCH,
  DARK_VECTOR_BEARING,
  FLAT_PITCH,
  applyDarkVectorCamera,
  assertDarkVectorCamera,
  attachDarkVectorCameraApi,
  restoreDarkVectorCamera,
  setFlatCameraForNegativtest,
  type MapWithDarkVectorCamera,
} from './cameraContract';

function fakeMap(initial?: { pitch?: number; bearing?: number }): MapWithDarkVectorCamera {
  let pitch = initial?.pitch ?? 0;
  let bearing = initial?.bearing ?? 0;
  return {
    getPitch: () => pitch,
    setPitch: (p: number) => {
      pitch = p;
    },
    getBearing: () => bearing,
    setBearing: (b: number) => {
      bearing = b;
    },
  };
}

describe('cameraContract (Dark Vector 3D)', () => {
  it('documents mandatory pitch/bearing defaults', () => {
    expect(DARK_VECTOR_PITCH).toBe(58);
    expect(DARK_VECTOR_BEARING).toBe(-18);
    expect(FLAT_PITCH).toBe(0);
  });

  it('applyDarkVectorCamera enforces the 3D contract', () => {
    const map = fakeMap({ pitch: 0, bearing: 0 });
    applyDarkVectorCamera(map);
    const result = assertDarkVectorCamera(map);
    expect(result.ok).toBe(true);
    expect(result.pitch).toBe(DARK_VECTOR_PITCH);
    expect(result.bearing).toBe(DARK_VECTOR_BEARING);
  });

  it('Negativtest: pitch=0 is flat, then restore returns to contract', () => {
    const map = fakeMap();
    applyDarkVectorCamera(map);
    expect(assertDarkVectorCamera(map).ok).toBe(true);

    // pitch=0 → extrusion appears flat (contract Negativpfad)
    setFlatCameraForNegativtest(map);
    expect(map.getPitch()).toBe(FLAT_PITCH);
    expect(assertDarkVectorCamera(map).ok).toBe(false);

    restoreDarkVectorCamera(map);
    const restored = assertDarkVectorCamera(map);
    expect(restored.ok).toBe(true);
    expect(restored.pitch).toBe(DARK_VECTOR_PITCH);
    expect(restored.bearing).toBe(DARK_VECTOR_BEARING);
  });

  it('attachDarkVectorCameraApi exposes a stable API on the map object', () => {
    const map = fakeMap();
    const api = attachDarkVectorCameraApi(map);
    expect(map.__darkVectorCamera).toBe(api);
    expect(api.defaults).toEqual({ pitch: DARK_VECTOR_PITCH, bearing: DARK_VECTOR_BEARING });

    api.apply();
    expect(api.assert().ok).toBe(true);

    api.setFlatForNegativtest();
    expect(map.getPitch()).toBe(0);
    expect(api.assert().ok).toBe(false);

    api.restore();
    expect(api.assert().ok).toBe(true);
  });

  it('allows course-up bearing override while keeping mandatory pitch', () => {
    const map = fakeMap();
    applyDarkVectorCamera(map, { bearing: 90 });
    expect(map.getPitch()).toBe(DARK_VECTOR_PITCH);
    expect(map.getBearing()).toBe(90);
    expect(assertDarkVectorCamera(map, { bearing: 90 }).ok).toBe(true);
  });
});
