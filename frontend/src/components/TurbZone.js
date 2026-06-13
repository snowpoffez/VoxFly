import { buildEllipse, TURB_ZONE } from '../utils/mercator'

// Adds a turbulence-zone polygon (fill + outline) rendered natively by Mapbox.
// Returns a tick(t) helper to pulse the fill opacity from the animation loop.
export function addTurbZone(map) {
  const ring = buildEllipse(
    TURB_ZONE.lat,
    TURB_ZONE.lng,
    TURB_ZONE.radiusLat,
    TURB_ZONE.radiusLng,
    48
  )

  map.addSource('turb-zone', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
    },
  })

  map.addLayer({
    id: 'turb-fill',
    type: 'fill',
    source: 'turb-zone',
    paint: { 'fill-color': '#ff8800', 'fill-opacity': 0.15 },
  })

  map.addLayer({
    id: 'turb-outline',
    type: 'line',
    source: 'turb-zone',
    paint: { 'line-color': '#ff6600', 'line-width': 1.5, 'line-opacity': 0.6 },
  })

  function tick(t, active) {
    const base = active ? 0.28 : 0.12
    const amp = active ? 0.12 : 0.04
    const val = base + Math.sin(t * 2.5) * amp
    map.setPaintProperty('turb-fill', 'fill-opacity', val)
    map.setPaintProperty(
      'turb-outline',
      'line-color',
      active ? '#ff3300' : '#ff6600'
    )
  }

  return { tick }
}
