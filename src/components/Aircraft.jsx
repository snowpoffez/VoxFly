import React, { useEffect, useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

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

const formatAlt     = (m)   => m   == null ? '—' : `${Math.round(m).toLocaleString()} m (${Math.round(m * 3.28084).toLocaleString()} ft)`
const formatSpeed   = (ms)  => ms  == null ? '—' : `${Math.round(ms * 3.6)} km/h`
const formatHeading = (deg) => deg == null ? '—' : `${Math.round(deg)}°`

const planeIcon = (heading, isSelected) => {
  const deg    = heading ?? 0
  const color  = isSelected ? '#ff7a18' : '#e0f0ff'
  const shadow = isSelected
    ? 'drop-shadow(0 0 4px #ff7a18)'
    : 'drop-shadow(0 0 2px rgba(0,180,255,0.6))'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" 
    style="transform:rotate(${deg}deg);filter:${shadow};">
    <path fill="${color}" d="M12,2A1.5,1.5,0,0,0,10.5,3.5V8.5L2,14v2l8.5-2.5V19L8,21v1l4-1,4,1V21l-2.5-2V13.5L22,16V14L13.5,8.5V3.5A1.5,1.5,0,0,0,12,2Z"/>
  </svg>`

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  })
}

const labelStyle   = { color: '#888', marginRight: 4 }
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
    const run = async () => {
      try {
        const res = await fetch(buildUrl())
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        
        setAircraft((data.states ?? []).filter(isLargeAircraft))
        setStatus('ok')
      } catch (err) {
        console.error('Aircraft fetch failed:', err)
        setErrorMsg(err.message)
        setStatus('error')
      }
    }
    run()
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
        const icao24   = s[0]
        const callsign = (s[1] ?? '').trim() || icao24
        const country  = s[2] ?? '—'
        const lon      = s[5]
        const lat      = s[6]
        const baroAlt  = s[7]
        const velocity = s[9]
        const heading  = s[10]
        const vertRate = s[11]
        const geoAlt   = s[13]
        const squawk   = s[14] ?? '—'

        const isSelected = selectedCallsign === callsign

        return (
          <Marker
            key={icao24}
            position={[lat, lon]}
            icon={planeIcon(heading, isSelected)}
            zIndexOffset={isSelected ? 1000 : 0}
            eventHandlers={{
              click: () => onSelectAircraft?.({
                icao24, callsign, country, lat, lon,
                baroAlt, geoAlt, velocity, heading, vertRate, squawk,
              }),
            }}
          >
            <Popup>
              <div style={{ fontSize: '12px', lineHeight: '1.7', minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 4 }}>✈ {callsign}</div>
                <div><span style={labelStyle}>ICAO24</span>  {icao24.toUpperCase()}</div>
                <div><span style={labelStyle}>Origin</span>  {country}</div>
                <div><span style={labelStyle}>Squawk</span>  {squawk}</div>
                <div style={{ marginTop: 6, borderTop: '1px solid #ddd', paddingTop: 6 }}>
                  <div><span style={labelStyle}>Alt (baro)</span> {formatAlt(baroAlt)}</div>
                  <div><span style={labelStyle}>Alt (geo)</span>  {formatAlt(geoAlt)}</div>
                  <div><span style={labelStyle}>Speed</span>      {formatSpeed(velocity)}</div>
                  <div><span style={labelStyle}>Heading</span>    {formatHeading(heading)}</div>
                  <div><span style={labelStyle}>Vert. rate</span>{' '}
                    {vertRate != null
                      ? `${vertRate > 0 ? '↑' : '↓'} ${Math.abs(Math.round(vertRate))} m/s`
                      : '—'}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}