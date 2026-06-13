import React, { useEffect, useState } from 'react'
import AnimatedAircraftMarker from './AnimatedAircraftMarker.jsx'

const POLL_INTERVAL_MS = 10000

const YYZ_COORDS = { lat: 43.6759, lon: -79.6294 }

const getBoundingBox = (centerLat, centerLon, radiusKm) => {
  const kmPerDegreeLat = 111.32
  const kmPerDegreeLon = 40075 * Math.cos(centerLat * Math.PI / 180) / 360

  const deltaLat = radiusKm / kmPerDegreeLat
  const deltaLon = radiusKm / Math.abs(kmPerDegreeLon)

  return {
    minLat: centerLat - deltaLat,
    maxLat: centerLat + deltaLat,
    minLon: centerLon - deltaLon,
    maxLon: centerLon + deltaLon
  }
}

const BBOX = getBoundingBox(YYZ_COORDS.lat, YYZ_COORDS.lon, 500)

const buildUrl = () => {
  const { minLat, maxLat, minLon, maxLon } = BBOX
  return `/api/opensky/states/all?lamin=${minLat}&lamax=${maxLat}&lomin=${minLon}&lomax=${maxLon}`
}

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const isLargeAircraft = (s) => {
  const icao24   = (s[0] ?? '').toLowerCase()
  const lon      = s[5]
  const lat      = s[6]
  const velocity = s[9]
  const geoAlt   = s[13]

  if (lat == null || lon == null) return false

  const distanceFromYYZ = calculateDistance(YYZ_COORDS.lat, YYZ_COORDS.lon, lat, lon)
  if (distanceFromYYZ > 1000) return false

  if (icao24.startsWith('a') && icao24 >= 'a70000') {
    const isFast = velocity != null && velocity > 130
    const isHigh = geoAlt != null && geoAlt > 4500
    if (!isFast && !isHigh) return false
  }

  if (icao24 >= 'c4b000' && icao24 <= 'c4b3ff') {
    if (geoAlt != null && geoAlt < 3500) return false
  }

  if (velocity != null && velocity < 60 && geoAlt != null && geoAlt < 1500) {
    return false
  }

  return true
}

const overlayStyle = (bg, fg) => ({
  position: 'fixed',
  bottom: 24,
  right: 16,
  zIndex: 1000,
  background: bg,
  color: fg,
  border: `1px solid ${fg}44`,
  padding: '6px 14px',
  borderRadius: 16,
  fontSize: 12,
  pointerEvents: 'none',
})

export default function Aircraft({ selectedCallsign, onSelectAircraft }) {
  const [aircraft, setAircraft] = useState([])
  const [status, setStatus]     = useState('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false

    const fetchAircraft = async () => {
      try {
        const res = await fetch(buildUrl())
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return

        setAircraft((data.states ?? []).filter(isLargeAircraft))
        setStatus('ok')
      } catch (err) {
        if (cancelled) return
        console.error('Aircraft fetch failed:', err)
        setErrorMsg(err.message)
        setStatus('error')
      }
    }

    fetchAircraft()
    const intervalId = setInterval(fetchAircraft, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  return (
    <>
      {status === 'loading' && (
        <div style={overlayStyle('#1a1a2e', '#7eb8f7')}>✈ Loading aircraft…</div>
      )}
      {status === 'error' && (
        <div style={overlayStyle('#2a1010', '#f77e7e')}>✈ Aircraft unavailable — {errorMsg}</div>
      )}
      {status === 'ok' && aircraft.length === 0 && (
        <div style={overlayStyle('#1a1a2e', '#7eb8f7')}>✈ No large aircraft in range</div>
      )}

      {aircraft.map((s) => {
        const icao24 = s[0]
        const callsign = (s[1] ?? '').trim() || icao24
        const country = s[2] ?? '—'
        const lon = s[5]
        const lat = s[6]
        const baroAlt = s[7]
        const velocity = s[9]
        const heading = s[10]
        const vertRate = s[11]
        const geoAlt = s[13]
        const squawk = s[14] ?? '—'

        return (
          <AnimatedAircraftMarker
            key={icao24}
            craft={{
              icao24,
              callsign,
              country,
              lat,
              lon,
              baroAlt,
              geoAlt,
              velocity,
              heading,
              vertRate,
              squawk,
            }}
            isSelected={selectedCallsign === callsign}
            onSelect={onSelectAircraft}
          />
        )
      })}
    </>
  )
}