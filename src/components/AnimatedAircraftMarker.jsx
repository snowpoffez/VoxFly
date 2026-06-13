import React, { useEffect, useRef } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

const EARTH_RADIUS_M = 6371000
const CORRECTION_MS = 1500

const labelStyle = { color: '#888', marginRight: 4 }

const formatAlt = (m) =>
  m == null ? '—' : `${Math.round(m).toLocaleString()} m (${Math.round(m * 3.28084).toLocaleString()} ft)`
const formatSpeed = (ms) => (ms == null ? '—' : `${Math.round(ms * 3.6)} km/h`)
const formatHeading = (deg) => (deg == null ? '—' : `${Math.round(deg)}°`)

const planeIcon = (heading, isSelected) => {
  const deg = heading ?? 0
  const color = isSelected ? '#ff7a18' : '#e0f0ff'
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

const movePosition = (lat, lon, headingDeg, distanceM) => {
  const latRad = (lat * Math.PI) / 180
  const lonRad = (lon * Math.PI) / 180
  const bearingRad = (headingDeg * Math.PI) / 180
  const angularDist = distanceM / EARTH_RADIUS_M

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDist) +
      Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearingRad)
  )
  const newLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDist) * Math.cos(latRad),
      Math.cos(angularDist) - Math.sin(latRad) * Math.sin(newLatRad)
    )

  return {
    lat: (newLatRad * 180) / Math.PI,
    lon: (newLonRad * 180) / Math.PI,
  }
}

const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - (1 - t) ** 2

const distanceM = (lat1, lon1, lat2, lon2) =>
  Math.hypot(
    (lat2 - lat1) * 111320,
    (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180)
  )

const lerpAngle = (from, to, t) => {
  if (from == null) return to ?? 0
  if (to == null) return from
  const diff = ((to - from + 540) % 360) - 180
  return from + diff * t
}

const extrapolate = (state, now) => {
  const elapsed = Math.max(0, (now - state.updatedAt) / 1000)
  if (state.velocity == null || state.heading == null || elapsed === 0) {
    return { lat: state.lat, lon: state.lon }
  }
  return movePosition(state.lat, state.lon, state.heading, state.velocity * elapsed)
}

const getDisplayPosition = (state, now) => {
  if (!state.correcting) return extrapolate(state, now)

  const t = Math.min(1, (now - state.corrStart) / CORRECTION_MS)
  const eased = easeOut(t)
  const pos = {
    lat: lerp(state.corrFrom.lat, state.corrTo.lat, eased),
    lon: lerp(state.corrFrom.lon, state.corrTo.lon, eased),
  }

  if (t >= 1) {
    state.correcting = false
    state.lat = state.corrTo.lat
    state.lon = state.corrTo.lon
    state.updatedAt = now
  }

  return pos
}

export default function AnimatedAircraftMarker({ craft, isSelected, onSelect }) {
  const markerRef = useRef(null)
  const stateRef = useRef({
    lat: craft.lat,
    lon: craft.lon,
    heading: craft.heading,
    velocity: craft.velocity,
    displayHeading: craft.heading ?? 0,
    updatedAt: Date.now(),
    correcting: false,
    corrFrom: { lat: craft.lat, lon: craft.lon },
    corrTo: { lat: craft.lat, lon: craft.lon },
    corrStart: 0,
  })

  useEffect(() => {
    const state = stateRef.current
    const now = Date.now()
    const current = getDisplayPosition(state, now)
    const distM = distanceM(current.lat, current.lon, craft.lat, craft.lon)

    if (distM > 15) {
      state.correcting = true
      state.corrFrom = current
      state.corrTo = { lat: craft.lat, lon: craft.lon }
      state.corrStart = now
    } else {
      state.correcting = false
      state.lat = craft.lat
      state.lon = craft.lon
      state.updatedAt = now
    }

    state.heading = craft.heading
    state.velocity = craft.velocity
  }, [craft.lat, craft.lon, craft.heading, craft.velocity])

  useEffect(() => {
    let frameId

    const tick = () => {
      const marker = markerRef.current
      const state = stateRef.current
      if (marker) {
        const now = Date.now()
        const pos = getDisplayPosition(state, now)
        const heading = lerpAngle(state.displayHeading, state.heading ?? state.displayHeading, 0.12)
        state.displayHeading = heading

        marker.setLatLng([pos.lat, pos.lon])
        marker.setIcon(planeIcon(heading, isSelected))
      }
      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [isSelected])

  const {
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
  } = craft

  return (
    <Marker
      ref={markerRef}
      position={[lat, lon]}
      icon={planeIcon(heading, isSelected)}
      zIndexOffset={isSelected ? 1000 : 0}
      eventHandlers={{
        click: () =>
          onSelect?.({
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
          }),
      }}
    >
      <Popup>
        <div style={{ fontSize: '12px', lineHeight: '1.7', minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: 4 }}>✈ {callsign}</div>
          <div>
            <span style={labelStyle}>ICAO24</span> {icao24.toUpperCase()}
          </div>
          <div>
            <span style={labelStyle}>Origin</span> {country}
          </div>
          <div>
            <span style={labelStyle}>Squawk</span> {squawk}
          </div>
          <div style={{ marginTop: 6, borderTop: '1px solid #ddd', paddingTop: 6 }}>
            <div>
              <span style={labelStyle}>Alt (baro)</span> {formatAlt(baroAlt)}
            </div>
            <div>
              <span style={labelStyle}>Alt (geo)</span> {formatAlt(geoAlt)}
            </div>
            <div>
              <span style={labelStyle}>Speed</span> {formatSpeed(velocity)}
            </div>
            <div>
              <span style={labelStyle}>Heading</span> {formatHeading(heading)}
            </div>
            <div>
              <span style={labelStyle}>Vert. rate</span>{' '}
              {vertRate != null
                ? `${vertRate > 0 ? '↑' : '↓'} ${Math.abs(Math.round(vertRate))} m/s`
                : '—'}
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}
