// Live wind field from the free Open-Meteo API (no key, CORS-enabled).
// We sample a coarse grid over the region in a single multi-location request,
// convert meteorological wind (speed + the direction it blows FROM) into flow
// vectors, and expose a bilinearly-interpolated sampler for the overlay.

const REGION = { west: -84, east: -74, south: 41, north: 47 }
const N_LON = 6
const N_LAT = 5

// field = { lats:[asc], lons:[asc], u:[lat][lon], v:[lat][lon] } in m/s,
// where u = eastward component, v = northward component (the way wind blows TO).
let field = null
let loading = false

function buildGrid(b) {
  const lats = []
  const lons = []
  for (let i = 0; i < N_LAT; i++) {
    lats.push(b.south + ((b.north - b.south) * i) / (N_LAT - 1))
  }
  for (let j = 0; j < N_LON; j++) {
    lons.push(b.west + ((b.east - b.west) * j) / (N_LON - 1))
  }
  return { lats, lons }
}

export async function loadWindField(bounds = REGION) {
  if (loading) return
  loading = true

  const { lats, lons } = buildGrid(bounds)
  const latParams = []
  const lonParams = []
  for (const la of lats) {
    for (const lo of lons) {
      latParams.push(la.toFixed(3))
      lonParams.push(lo.toFixed(3))
    }
  }

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${latParams.join(',')}` +
    `&longitude=${lonParams.join(',')}` +
    '&current=wind_speed_10m,wind_direction_10m' +
    '&wind_speed_unit=ms'

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    // Multi-location requests return an array; single returns an object.
    const arr = Array.isArray(data) ? data : [data]

    const u = []
    const v = []
    let k = 0
    for (let i = 0; i < lats.length; i++) {
      u[i] = []
      v[i] = []
      for (let j = 0; j < lons.length; j++) {
        const cur = arr[k++]?.current || {}
        const speed = cur.wind_speed_10m ?? 0
        const dirFrom = cur.wind_direction_10m ?? 0
        const r = (dirFrom * Math.PI) / 180
        // Direction wind blows TO = FROM + 180°, hence the negative signs.
        u[i][j] = -speed * Math.sin(r)
        v[i][j] = -speed * Math.cos(r)
      }
    }
    field = { lats, lons, u, v }
    console.log(
      `[wind] Open-Meteo field loaded (${lats.length * lons.length} points)`
    )
  } catch (e) {
    console.warn('[wind] Open-Meteo fetch failed, using synthetic field:', e.message)
  } finally {
    loading = false
  }
}

// Gentle fallback so the overlay shows something before the first fetch resolves
// (or if the API is unreachable).
function synthetic(lat, lon) {
  const u = 4 + Math.sin(lat * 1.4) * 2
  const v = 1 + Math.cos(lon * 1.1) * 1.5
  return [u, v]
}

export function sampleWind(lat, lon) {
  if (!field) return synthetic(lat, lon)
  const { lats, lons, u, v } = field

  const la = Math.min(Math.max(lat, lats[0]), lats[lats.length - 1])
  const lo = Math.min(Math.max(lon, lons[0]), lons[lons.length - 1])

  let i = 0
  while (i < lats.length - 2 && lats[i + 1] < la) i++
  let j = 0
  while (j < lons.length - 2 && lons[j + 1] < lo) j++

  const tLa = (la - lats[i]) / (lats[i + 1] - lats[i] || 1)
  const tLo = (lo - lons[j]) / (lons[j + 1] - lons[j] || 1)

  const bil = (m) => {
    const top = m[i][j] * (1 - tLo) + m[i][j + 1] * tLo
    const bot = m[i + 1][j] * (1 - tLo) + m[i + 1][j + 1] * tLo
    return top * (1 - tLa) + bot * tLa
  }

  return [bil(u), bil(v)]
}

export function hasWindField() {
  return !!field
}
