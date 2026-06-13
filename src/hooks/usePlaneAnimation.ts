import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, Quaternion, Matrix4 } from 'three'
import { useGlobeStore, PlaneState } from '../store/useFlightStore'

const R = 5
const ALT = 0.2

interface Route {
  from: { lat: number; lng: number; name: string }
  to: { lat: number; lng: number; name: string }
}

const ROUTES: Route[] = [
  { from: { lat: 40.7, lng: -74.0, name: 'JFK' }, to: { lat: 51.5, lng: -0.1, name: 'LHR' } },
  { from: { lat: 35.7, lng: 139.7, name: 'NRT' }, to: { lat: 37.8, lng: -122.4, name: 'SFO' } },
  { from: { lat: 25.2, lng: 55.3, name: 'DXB' }, to: { lat: -33.9, lng: 151.2, name: 'SYD' } },
  { from: { lat: 1.35, lng: 103.8, name: 'SIN' }, to: { lat: 35.7, lng: 139.7, name: 'NRT' } },
  { from: { lat: 34.1, lng: -118.2, name: 'LAX' }, to: { lat: 40.7, lng: -74.0, name: 'JFK' } },
  { from: { lat: 51.5, lng: -0.1, name: 'LHR' }, to: { lat: 25.2, lng: 55.3, name: 'DXB' } },
  { from: { lat: 37.8, lng: -122.4, name: 'SFO' }, to: { lat: 35.7, lng: 139.7, name: 'NRT' } },
  { from: { lat: -33.9, lng: 151.2, name: 'SYD' }, to: { lat: 1.35, lng: 103.8, name: 'SIN' } },
  { from: { lat: 48.9, lng: 2.35, name: 'CDG' }, to: { lat: 40.7, lng: -74.0, name: 'JFK' } },
  { from: { lat: 22.3, lng: 114.2, name: 'HKG' }, to: { lat: 51.5, lng: -0.1, name: 'LHR' } },
  { from: { lat: -26.2, lng: 28.0, name: 'JNB' }, to: { lat: 25.2, lng: 55.3, name: 'DXB' } },
  { from: { lat: 55.8, lng: 37.6, name: 'SVO' }, to: { lat: 39.9, lng: 116.4, name: 'PEK' } },
]

const COLORS = [
  '#ff4444', '#4488ff', '#44ff88', '#ffaa00',
  '#ff44ff', '#00ccff', '#ff8844', '#88ff44',
  '#ff0044', '#44ffcc', '#cc44ff', '#ffff44',
]

function greatCirclePoint(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
  t: number,
) {
  const φ1 = lat1 * Math.PI / 180
  const λ1 = lng1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const λ2 = lng2 * Math.PI / 180

  const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1)
  const sinφ2 = Math.sin(φ2), cosφ2 = Math.cos(φ2)
  const cosΔλ = Math.cos(λ2 - λ1)

  const δ = Math.acos(
    sinφ1 * sinφ2 + cosφ1 * cosφ2 * cosΔλ,
  )

  if (δ < 1e-6) return { lat: lat1, lng: lng1, bearing: 0 }

  const a = Math.sin((1 - t) * δ) / Math.sin(δ)
  const b = Math.sin(t * δ) / Math.sin(δ)

  const x = a * cosφ1 * Math.cos(λ1) + b * cosφ2 * Math.cos(λ2)
  const y = a * cosφ1 * Math.sin(λ1) + b * cosφ2 * Math.sin(λ2)
  const z = a * sinφ1 + b * sinφ2

  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI,
    lng: Math.atan2(y, x) * 180 / Math.PI,
    bearing: Math.atan2(
      cosφ1 * sinφ2 - sinφ1 * cosφ2 * cosΔλ,
      cosφ2 * Math.sin(λ2 - λ1),
    ),
  }
}

function latLngToPos(lat: number, lng: number, radius: number): Vector3 {
  const φ = lat * Math.PI / 180
  const λ = lng * Math.PI / 180
  return new Vector3(
    radius * Math.cos(φ) * Math.cos(λ),
    radius * Math.sin(φ),
    radius * Math.cos(φ) * Math.sin(λ),
  )
}

function computePlane(
  route: Route, progress: number, color: string, flightNumber: string,
): PlaneState {
  const t = progress % 1
  const leg = Math.floor(progress) % 2
  const from = leg === 0 ? route.from : route.to
  const to = leg === 0 ? route.to : route.from

  const pt = greatCirclePoint(from.lat, from.lng, to.lat, to.lng, t)
  const pos = latLngToPos(pt.lat, pt.lng, R + ALT)

  const bearingRad = pt.bearing

  const up = pos.clone().normalize()
  const north = new Vector3(0, 1, 0)
  const east = new Vector3().crossVectors(up, north).normalize()
  const localNorth = new Vector3().crossVectors(east, up).normalize()

  const forward = new Vector3()
    .copy(localNorth).multiplyScalar(Math.cos(bearingRad))
    .add(east.clone().multiplyScalar(Math.sin(bearingRad)))
    .normalize()

  const right = new Vector3().crossVectors(forward, up).normalize()

  const quat = new Quaternion().setFromRotationMatrix(
    new Matrix4().set(
      right.x, up.x, -forward.x, 0,
      right.y, up.y, -forward.y, 0,
      right.z, up.z, -forward.z, 0,
      0, 0, 0, 1,
    ),
  )

  return {
    id: flightNumber,
    position: pos,
    quaternion: quat,
    altitude: ALT,
    heading: pt.bearing,
    color,
    flightNumber,
    origin: from.name,
    destination: to.name,
  }
}

export function usePlaneAnimation() {
  const setPlanes = useGlobeStore((s) => s.setPlanes)

  const planes = useMemo(() => {
    const data: { route: Route; progress: number; speed: number; color: string; flightNumber: string }[] = []
    for (let i = 0; i < ROUTES.length; i++) {
      data.push({
        route: ROUTES[i],
        progress: Math.random(),
        speed: 0.03 + Math.random() * 0.03,
        color: COLORS[i % COLORS.length],
        flightNumber: `VF${100 + i}`,
      })
    }
    return data
  }, [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const results: PlaneState[] = []

    for (const p of planes) {
      p.progress = (p.progress + p.speed * dt) % 2
      results.push(computePlane(p.route, p.progress, p.color, p.flightNumber))
    }

    setPlanes(results)
  })
}
