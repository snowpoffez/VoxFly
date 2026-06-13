import maplibregl from 'maplibre-gl'
import * as THREE from 'three'

// Convert real-world lng/lat (+ optional altitude in metres) into the MapLibre
// internal mercator world units that a custom-layer projection matrix expects.
export function lngLatToMercator(lng, lat, altitude = 0) {
  return maplibregl.MercatorCoordinate.fromLngLat({ lng, lat }, altitude)
}

export function mercatorToVector3(merc) {
  return new THREE.Vector3(merc.x, merc.y, merc.z)
}

// Build a closed ellipse ring as [lng, lat] pairs, suitable for a GeoJSON polygon.
// radiusLatDeg / radiusLngDeg are the semi-axes in degrees.
export function buildEllipse(
  centerLat,
  centerLng,
  radiusLatDeg,
  radiusLngDeg,
  segments = 32
) {
  const ring = []
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const lng = centerLng + Math.cos(theta) * radiusLngDeg
    const lat = centerLat + Math.sin(theta) * radiusLatDeg
    ring.push([lng, lat])
  }
  return ring
}

export const TURB_ZONE = {
  lat: 43.9,
  lng: -78.8,
  radiusLat: 0.55,
  radiusLng: 0.9,
}
