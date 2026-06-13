import React, { useEffect, useRef } from 'react'
import { Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'

// ── physics constants ────────────────────────────────────────────────
const EARTH_RADIUS_M   = 6371000
const CORRECTION_MS    = 1500
const TURN_RATE_DEG_S  = 3       // °/s — standard-rate airliner turn
const THROTTLE_STEP_MS = 15      // m/s per throttle step  (~30 kt)
const CLIMB_RATE_MS    = 6       // m/s vertical (~1200 ft/min)
const MIN_VELOCITY     = 70      // m/s
const MAX_VELOCITY     = 290     // m/s  (~Mach 0.85)
const MAX_ALT          = 13000   // m  (~42 700 ft)
const MIN_ALT          = 100     // m
const ARRIVAL_DIST_M   = 25000   // m — clear destination when within 25 km

const makePlaneIcon = (isSelected, hasDestination) => {
  const color = hasDestination ? '#a78bfa' : isSelected ? '#fff' : '#666'
  const svg = `<svg id="plane-svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
    style="transform:rotate(0deg);">
    <path fill="${color}" d="M12,2A1.5,1.5,0,0,0,10.5,3.5V8.5L2,14v2l8.5-2.5V19L8,21v1l4-1,4,1V21l-2.5-2V13.5L22,16V14L13.5,8.5V3.5A1.5,1.5,0,0,0,12,2Z"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
}

// Great-circle bearing, 0–360°
const calcBearing = (lat1, lon1, lat2, lon2) => {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const y  = Math.sin(Δλ) * Math.cos(φ2)
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const movePosition = (lat, lon, hdg, distM) => {
  const φ1 = (lat * Math.PI) / 180, λ1 = (lon * Math.PI) / 180
  const θ  = (hdg * Math.PI) / 180, d  = distM / EARTH_RADIUS_M
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2))
  return { lat: (φ2 * 180) / Math.PI, lon: (λ2 * 180) / Math.PI }
}

const lerp      = (a, b, t) => a + (b - a) * t
const easeOut   = (t) => 1 - (1 - t) ** 2
const distM     = (la1, lo1, la2, lo2) =>
  Math.hypot((la2 - la1) * 111320, (lo2 - lo1) * 111320 * Math.cos((la1 * Math.PI) / 180))
const lerpAngle = (from, to, t) => {
  if (from == null) return to ?? 0
  if (to   == null) return from
  const diff = ((to - from + 540) % 360) - 180
  return from + diff * t
}

const extrapolate = (state, now) => {
  const elapsed = Math.max(0, (now - state.updatedAt) / 1000)
  if (!state.velocity || !state.heading || elapsed === 0) return { lat: state.lat, lon: state.lon }
  return movePosition(state.lat, state.lon, state.heading, state.velocity * elapsed)
}

const getDisplayPosition = (state, now) => {
  if (!state.correcting) return extrapolate(state, now)
  const t   = Math.min(1, (now - state.corrStart) / CORRECTION_MS)
  const pos = { lat: lerp(state.corrFrom.lat, state.corrTo.lat, easeOut(t)), lon: lerp(state.corrFrom.lon, state.corrTo.lon, easeOut(t)) }
  if (t >= 1) { state.correcting = false; state.lat = state.corrTo.lat; state.lon = state.corrTo.lon; state.updatedAt = now }
  return pos
}

export default function AnimatedAircraftMarker({
  craft, isSelected, dest, throttle, vertMode, livePosRef, onSelect, onArrival,
}) {
  const markerRef      = useRef(null)
  const onSelectRef    = useRef(onSelect)
  const craftRef       = useRef(craft)
  const destRef        = useRef(dest)
  const throttleRef    = useRef(throttle ?? 0)
  const vertModeRef    = useRef(vertMode ?? 'level')
  const livePosRefRef  = useRef(livePosRef)
  const onArrivalRef   = useRef(onArrival)

  useEffect(() => { onSelectRef.current   = onSelect  }, [onSelect])
  useEffect(() => { craftRef.current      = craft     }, [craft])
  useEffect(() => { destRef.current       = dest      }, [dest])
  useEffect(() => { throttleRef.current   = throttle  ?? 0      }, [throttle])
  useEffect(() => { vertModeRef.current   = vertMode  ?? 'level' }, [vertMode])
  useEffect(() => { livePosRefRef.current = livePosRef }, [livePosRef])
  useEffect(() => { onArrivalRef.current  = onArrival  }, [onArrival])

  const handleClick = useRef(() => onSelectRef.current?.(craftRef.current)).current

  const stateRef = useRef({
    // ADS-B state
    lat:     craft.lat, lon:      craft.lon,
    heading: craft.heading, velocity: craft.velocity,
    updatedAt: Date.now(),
    correcting: false,
    corrFrom: { lat: craft.lat, lon: craft.lon },
    corrTo:   { lat: craft.lat, lon: craft.lon },
    corrStart: 0,
    // Display
    displayHeading:  craft.heading ?? 0,
    commandedHeading: craft.heading ?? 0,
    lastTick: Date.now(),
    // Navigation mode
    navMode:          false,
    commandedLat:     craft.lat,
    commandedLon:     craft.lon,
    navBaseVelocity:  craft.velocity ?? 250,
    commandedVelocity: craft.velocity ?? 250,
    commandedAlt:     craft.baroAlt ?? 10000,
  })

  useEffect(() => {
    const state = stateRef.current, now = Date.now()
    const cur = getDisplayPosition(state, now)
    const d   = distM(cur.lat, cur.lon, craft.lat, craft.lon)
    if (d > 15) {
      state.correcting = true; state.corrFrom = cur
      state.corrTo = { lat: craft.lat, lon: craft.lon }; state.corrStart = now
    } else {
      state.correcting = false; state.lat = craft.lat; state.lon = craft.lon; state.updatedAt = now
    }
    state.heading  = craft.heading
    state.velocity = craft.velocity
    // If not in nav mode, keep commanded alt synced with real alt
    if (!state.navMode && craft.baroAlt != null) state.commandedAlt = craft.baroAlt
  }, [craft.lat, craft.lon, craft.heading, craft.velocity])

  useEffect(() => {
    const marker = markerRef.current
    if (marker) marker.setIcon(makePlaneIcon(isSelected, !!dest))
  }, [isSelected, dest])

  useEffect(() => {
    let frameId

    const tick = () => {
      const marker = markerRef.current
      if (!marker) { frameId = requestAnimationFrame(tick); return }

      const state = stateRef.current
      const now   = Date.now()
      const dt    = Math.min(0.1, (now - state.lastTick) / 1000)
      state.lastTick = now

      const destination = destRef.current
      let pos

      // ── enter / exit navigation mode ────────────────────────────
      if (destination && !state.navMode) {
        const basePos = getDisplayPosition(state, now)
        state.navMode          = true
        state.commandedLat     = basePos.lat
        state.commandedLon     = basePos.lon
        state.commandedHeading = state.displayHeading
        state.navBaseVelocity  = Math.max(MIN_VELOCITY, state.velocity ?? 250)
        if (craftRef.current?.baroAlt != null) state.commandedAlt = craftRef.current.baroAlt
      }
      if (!destination && state.navMode) {
        state.navMode = false
      }

      if (state.navMode) {
        // ── throttle → commanded velocity ─────────────────────────
        state.commandedVelocity = Math.max(
          MIN_VELOCITY,
          Math.min(MAX_VELOCITY, state.navBaseVelocity + throttleRef.current * THROTTLE_STEP_MS)
        )

        // ── vertical mode → altitude ───────────────────────────────
        const vm = vertModeRef.current
        if (vm === 'climb')   state.commandedAlt = Math.min(MAX_ALT, state.commandedAlt + CLIMB_RATE_MS * dt)
        if (vm === 'descend') state.commandedAlt = Math.max(MIN_ALT, state.commandedAlt - CLIMB_RATE_MS * dt)

        // ── turn toward destination ────────────────────────────────
        const targetBrg = calcBearing(state.commandedLat, state.commandedLon, destination.lat, destination.lon)
        const diff    = ((targetBrg - state.commandedHeading + 540) % 360) - 180
        const maxTurn = TURN_RATE_DEG_S * dt
        state.commandedHeading = (state.commandedHeading + Math.sign(diff) * Math.min(Math.abs(diff), maxTurn) + 360) % 360

        // ── advance position ───────────────────────────────────────
        const moved = movePosition(state.commandedLat, state.commandedLon, state.commandedHeading, state.commandedVelocity * dt)
        state.commandedLat = moved.lat
        state.commandedLon = moved.lon
        pos = { lat: state.commandedLat, lon: state.commandedLon }

        // ── arrival check ──────────────────────────────────────────
        const toDest = distM(state.commandedLat, state.commandedLon, destination.lat, destination.lon)
        if (toDest < ARRIVAL_DIST_M && onArrivalRef.current) {
          onArrivalRef.current()
          onArrivalRef.current = null   // fire once
        }
      } else {
        pos = getDisplayPosition(state, now)
        if (state.heading != null) state.commandedHeading = state.heading
      }

      // ── smooth display heading ─────────────────────────────────
      const heading = lerpAngle(state.displayHeading, state.commandedHeading, 0.1)
      state.displayHeading = heading

      marker.setLatLng([pos.lat, pos.lon])

      // Push live state for the info card
      if (livePosRefRef.current) {
        livePosRefRef.current.current = {
          lat:      pos.lat,
          lon:      pos.lon,
          velocity: state.navMode ? state.commandedVelocity : state.velocity,
          alt:      state.navMode ? state.commandedAlt : craftRef.current?.baroAlt,
          vertMode: state.navMode ? vertModeRef.current : null,
        }
      }

      const el = marker.getElement()
      if (el) { const svg = el.querySelector('svg'); if (svg) svg.style.transform = `rotate(${heading}deg)` }

      frameId = requestAnimationFrame(tick)
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <>
      <Marker
        ref={markerRef}
        position={[craft.lat, craft.lon]}
        icon={makePlaneIcon(isSelected, !!dest)}
        zIndexOffset={isSelected ? 1000 : 0}
        eventHandlers={{ click: handleClick }}
      />
      {dest && (
        <Polyline
          positions={[[craft.lat, craft.lon], [dest.lat, dest.lon]]}
          pathOptions={{ color: '#a78bfa', weight: 1.5, dashArray: '10 7', opacity: 0.5 }}
          interactive={false}
        />
      )}
    </>
  )
}
