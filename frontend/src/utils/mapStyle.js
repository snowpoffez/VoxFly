// Keyless MapLibre styles. No Mapbox/Google token required.
//
// Choose with VITE_MAP_STYLE in frontend/.env: "dark" (default) or "satellite".
// Both are raster styles, so they work offline-degrade gracefully (blank dark
// map) and support pitch/rotate the same as a vector style.

// Free, keyless glyph (font) endpoint so symbol/text layers (airport labels)
// can render on top of the raster base styles.
const GLYPHS = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'

const DARK = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#000010' } },
    { id: 'carto-dark', type: 'raster', source: 'carto-dark' },
  ],
}

const SATELLITE = {
  version: 8,
  glyphs: GLYPHS,
  sources: {
    'esri-sat': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#000010' } },
    { id: 'esri-sat', type: 'raster', source: 'esri-sat' },
  ],
}

export function getMapStyle() {
  const choice = (import.meta.env.VITE_MAP_STYLE || 'dark').toLowerCase()
  return choice === 'satellite' ? SATELLITE : DARK
}
