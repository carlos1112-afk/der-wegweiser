import { describe, it, expect } from 'vitest';
import {
  readMapKeys,
  demSource,
  cycleSource,
  topoSource,
  satelliteSource,
  MAPTILER_TERRAIN_MAXZOOM,
} from './mapSources';

const NONE = {};
const MT = { maptiler: 'MT-KEY' };
const TF = { thunderforest: 'TF-KEY' };

describe('readMapKeys', () => {
  it('liest beide Schlüssel aus den VITE-Variablen', () => {
    expect(readMapKeys({ VITE_MAPTILER_API_KEY: 'a', VITE_THUNDERFOREST_API_KEY: 'b' })).toEqual({
      maptiler: 'a',
      thunderforest: 'b',
    });
  });

  it('behandelt fehlende, leere und nur aus Leerzeichen bestehende Werte als nicht gesetzt', () => {
    expect(readMapKeys({})).toEqual({ maptiler: undefined, thunderforest: undefined });
    expect(readMapKeys({ VITE_MAPTILER_API_KEY: '', VITE_THUNDERFOREST_API_KEY: '   ' })).toEqual({
      maptiler: undefined,
      thunderforest: undefined,
    });
  });

  it('schneidet Leerzeichen um den Schlüssel ab', () => {
    expect(readMapKeys({ VITE_MAPTILER_API_KEY: '  abc \n' }).maptiler).toBe('abc');
  });
});

describe('Quellen ohne Schlüssel: bisherige schlüsselfreie Anbieter, kein MapTiler/Thunderforest', () => {
  it('Höhendaten: AWS Terrarium ohne maxzoom (wie vor dem PR)', () => {
    const d = demSource(NONE);
    expect(d.tiles[0]).toContain('elevation-tiles-prod/terrarium');
    expect(d.encoding).toBe('terrarium');
    expect(d.maxzoom).toBeUndefined();
  });

  it('Cycle: CyclOSM', () => {
    expect(cycleSource(NONE).tiles[0]).toContain('tile-cyclosm.openstreetmap.fr');
  });

  it('Topo: a/b/c bei Topo-Thema, nur a als Überlagerung im Cycle-Thema', () => {
    expect(topoSource(NONE, true).tiles).toHaveLength(3);
    expect(topoSource(NONE, false).tiles).toHaveLength(1);
    expect(topoSource(NONE, true).tiles.every((t) => t.includes('opentopomap.org'))).toBe(true);
  });

  it('Satellit: Esri', () => {
    expect(satelliteSource(NONE).tiles[0]).toContain('arcgisonline.com');
  });

  it('keine Quelle ohne Schlüssel enthält maptiler, thunderforest, "key=" oder "apikey="', () => {
    const all = [
      ...demSource(NONE).tiles,
      ...cycleSource(NONE).tiles,
      ...topoSource(NONE, true).tiles,
      ...satelliteSource(NONE).tiles,
    ].join(' ');
    expect(all).not.toMatch(/maptiler|thunderforest|key=|apikey=/i);
  });
});

describe('Quellen mit Schlüssel', () => {
  it('Höhendaten: MapTiler, Mapbox-Kodierung und maxzoom, damit keine nicht vorhandenen Kacheln angefragt werden', () => {
    const d = demSource(MT);
    expect(d.tiles[0]).toContain('api.maptiler.com/tiles/terrain-rgb-v2/');
    expect(d.tiles[0]).toContain('key=MT-KEY');
    expect(d.encoding).toBe('mapbox');
    expect(d.maxzoom).toBe(MAPTILER_TERRAIN_MAXZOOM);
    expect(MAPTILER_TERRAIN_MAXZOOM).toBeLessThanOrEqual(14);
  });

  it('Cycle: Thunderforest mit apikey und Namensnennung', () => {
    const c = cycleSource(TF);
    expect(c.tiles[0]).toContain('tile.thunderforest.com/cycle/');
    expect(c.tiles[0]).toContain('apikey=TF-KEY');
    expect(c.attribution).toContain('Thunderforest');
    expect(c.attribution).toContain('OpenStreetMap');
  });

  it('Topo und Satellit: MapTiler mit Namensnennung (MapTiler und OpenStreetMap)', () => {
    for (const s of [topoSource(MT, true), satelliteSource(MT)]) {
      expect(s.tiles).toHaveLength(1);
      expect(s.tiles[0]).toContain('api.maptiler.com');
      expect(s.tiles[0]).toContain('key=MT-KEY');
      expect(s.attribution).toContain('MapTiler');
      expect(s.attribution).toContain('OpenStreetMap');
    }
  });

  it('der MapTiler-Schlüssel schaltet Thunderforest nicht ein und umgekehrt', () => {
    expect(cycleSource(MT).tiles[0]).toContain('cyclosm');
    expect(topoSource(TF, true).tiles[0]).toContain('opentopomap');
    expect(demSource(TF).tiles[0]).toContain('terrarium');
  });

  it('Sonderzeichen im Schlüssel werden URL-kodiert (kein Einschleusen weiterer Parameter)', () => {
    const t = satelliteSource({ maptiler: 'a&b=c#d' }).tiles[0];
    expect(t).toContain('key=a%26b%3Dc%23d');
    expect(t).not.toContain('&b=');
  });
});
