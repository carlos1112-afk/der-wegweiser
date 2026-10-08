import type { StyleSpecification } from 'maplibre-gl';

/** Dark Vector / OpenMapTiles / kein Hillshade / keine Konturen */
export const CYBERPUNK_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'Wegweiser Dark Vector',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      attribution: '&copy; OpenMapTiles &copy; OpenStreetMap contributors · OpenFreeMap',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#05080f' },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'wood'],
      paint: { 'fill-color': '#07140f', 'fill-opacity': 0.55 },
    },
    {
      id: 'landuse-residential',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', ['get', 'class'], 'residential'],
      paint: { 'fill-color': '#0a1020', 'fill-opacity': 0.7 },
    },
    {
      id: 'landuse-industrial',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', ['industrial', 'commercial']]],
      paint: { 'fill-color': '#0c0a18', 'fill-opacity': 0.65 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#061428' },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: {
        'line-color': '#0a3a5c',
        'line-width': 1.2,
        'line-opacity': 0.85,
      },
    },
    {
      id: 'building-fill',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': '#0d1526',
        'fill-opacity': 0.9,
        'fill-outline-color': '#1a3a4a',
      },
    },
    {
      id: 'building-neon',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'line-color': '#00c8d8',
        'line-width': 0.8,
        'line-opacity': 0.75,
      },
    },
    {
      id: 'road-path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track', 'service']]],
      paint: {
        'line-color': '#1a4a3a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 1.4],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'tertiary', 'street']]],
      paint: {
        'line-color': '#1f6b7a',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 2.2],
        'line-opacity': 0.85,
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'primary']]],
      paint: {
        'line-color': '#00c8d8',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 16, 3.2],
        'line-opacity': 0.9,
      },
    },
    {
      id: 'road-motorway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk']]],
      paint: {
        'line-color': '#ff00ff',
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 14, 4.0],
        'line-opacity': 0.95,
      },
    },
    {
      id: 'road-rail',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'rail'],
      paint: {
        'line-color': '#3a2060',
        'line-width': 1.1,
        'line-dasharray': [2, 2],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'boundary-admin',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 4],
      paint: {
        'line-color': '#1a3048',
        'line-width': 0.8,
        'line-dasharray': [4, 3],
        'line-opacity': 0.5,
      },
    },
    {
      id: 'place-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'village']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:de'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 16],
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#7fd4e0',
        'text-halo-color': '#05080f',
        'text-halo-width': 1.4,
        'text-opacity': 0.9,
      },
    },
  ],
};

/** Neon green for cluster cubes */
export const CLUSTER_FILL = '#00ff9f';
/** Brighter neon rim */
export const CLUSTER_OUTLINE = '#39ff14';

/** Alias for convenience */
export const DARK_VECTOR_STYLE = CYBERPUNK_MAP_STYLE;
