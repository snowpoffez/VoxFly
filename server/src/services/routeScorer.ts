import type { ScoredRoute } from '../types.js'

const EARTH_R = 6371

function toRad(d: number) { return d * Math.PI / 180 }

function distKm(la1: number, lo1: number, la2: number, lo2: number) {
  const dLat = toRad(la2 - la1), dLon = toRad(lo2 - lo1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLon/2)**2
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function movePoint(lat: number, lon: number, bearingDeg: number, distKm: number): [number, number] {
  const R = EARTH_R, d = distKm / R, b = toRad(bearingDeg)
  const φ1 = toRad(lat), λ1 = toRad(lon)
  const φ2 = Math.asin(Math.sin(φ1)*Math.cos(d) + Math.cos(φ1)*Math.sin(d)*Math.cos(b))
  const λ2 = λ1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(φ1), Math.cos(d)-Math.sin(φ1)*Math.sin(φ2))
  return [φ2 * 180/Math.PI, λ2 * 180/Math.PI]
}

function bearingBetween(la1: number, lo1: number, la2: number, lo2: number): number {
  const φ1 = toRad(la1), φ2 = toRad(la2), dλ = toRad(lo2 - lo1)
  const y = Math.sin(dλ) * Math.cos(φ2)
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(dλ)
  return (Math.atan2(y, x) * 180/Math.PI + 360) % 360
}

async function fetchWeatherRisk(lat: number, lon: number): Promise<number> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&hourly=windspeed_10m,precipitation&timezone=UTC&forecast_days=1`
    const res  = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return 0.3
    const data = await res.json() as { hourly?: { windspeed_10m?: number[]; precipitation?: number[] } }
    const winds = data.hourly?.windspeed_10m?.slice(0, 6) ?? []
    const precip = data.hourly?.precipitation?.slice(0, 6) ?? []
    const avgWind   = winds.reduce((s, v) => s + v, 0) / (winds.length || 1)
    const avgPrecip = precip.reduce((s, v) => s + v, 0) / (precip.length || 1)
    const windRisk  = Math.min(1, avgWind / 60)
    const precipRisk = Math.min(1, avgPrecip / 5)
    return windRisk * 0.6 + precipRisk * 0.4
  } catch {
    return 0.3
  }
}

function buildWaypoints(
  fromLat: number, fromLon: number,
  toLat:   number, toLon:   number,
  headingOffset: number
): [number, number][] {
  const midLat = (fromLat + toLat) / 2
  const midLon = (fromLon + toLon) / 2
  const dist   = distKm(fromLat, fromLon, toLat, toLon)
  const brg    = bearingBetween(fromLat, fromLon, toLat, toLon)
  const devDist = dist * 0.3
  const [devLat, devLon] = movePoint(midLat, midLon, (brg + headingOffset + 360) % 360, devDist)
  return [[fromLat, fromLon], [devLat, devLon], [toLat, toLon]]
}

export async function scoreRoutes(
  fromLat: number, fromLon: number,
  toLat:   number, toLon:   number,
  turbulenceLevel = 0.5
): Promise<ScoredRoute[]> {
  const directDist = distKm(fromLat, fromLon, toLat, toLon)

  const candidates = [
    { id: 'direct', name: 'Direct Route',    offset: 0   },
    { id: 'north',  name: 'Northern Detour', offset: -15 },
    { id: 'south',  name: 'Southern Detour', offset: +15 },
  ]

  const scored = await Promise.all(candidates.map(async (c) => {
    const waypoints = buildWaypoints(fromLat, fromLon, toLat, toLon, c.offset)
    const midWp     = waypoints[1]
    const routeDist = waypoints.reduce((sum, wp, i) => {
      if (i === 0) return sum
      return sum + distKm(waypoints[i-1][0], waypoints[i-1][1], wp[0], wp[1])
    }, 0)

    const weatherRisk    = await fetchWeatherRisk(midWp[0], midWp[1])
    const turbulenceRisk = turbulenceLevel * (1 + Math.random() * 0.3 * Math.sign(c.offset))
    const fuelCost       = routeDist / directDist - 1
    const distancePenalty = Math.max(0, routeDist - directDist) / directDist

    const score =
      Math.min(1, turbulenceRisk) * 0.4 +
      weatherRisk                 * 0.3 +
      Math.min(1, fuelCost)       * 0.2 +
      Math.min(1, distancePenalty)* 0.1

    return {
      id:             c.id,
      name:           c.name,
      score:          Math.round(score * 1000) / 1000,
      turbulenceRisk: Math.round(turbulenceRisk * 100) / 100,
      weatherRisk:    Math.round(weatherRisk    * 100) / 100,
      fuelCost:       Math.round(fuelCost       * 100) / 100,
      distancePenalty: Math.round(distancePenalty * 100) / 100,
      waypoints,
      recommended:    false,
      headingOffset:  c.offset,
    } satisfies ScoredRoute
  }))

  // Lowest score wins — mark the best
  const best = scored.reduce((a, b) => a.score < b.score ? a : b)
  best.recommended = true

  return scored
}
