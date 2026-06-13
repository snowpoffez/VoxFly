import React, { useEffect, useRef, useState } from 'react'
import { Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'

const EARTH_RADIUS_M  = 6371000
const CORRECTION_MS   = 1500
const NM = 1852

const SPD_CRUISE   = 230
const SPD_APPROACH = 77
const SPD_FINAL    = 67
const SPD_FLARE    = 56
const GLIDE_SLOPE  = 0.05241

const DST_APPROACH = 92600
const DST_FINAL    = 18520
const DST_FLARE    =  5556
const DST_TOUCHDOWN=   400

const FAF_NM  = 10

const SIM_TURN_RATE_DEG_S = 1.6
const SIM_DT              = 1.0

const toRad = d => d * Math.PI / 180

const calcBearing = (la1, lo1, la2, lo2) => {
  const φ1 = toRad(la1), φ2 = toRad(la2), Δλ = toRad(lo2 - lo1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360
}

const movePos = (lat, lon, hdg, distM) => {
  const φ1 = toRad(lat), λ1 = toRad(lon), θ = toRad(hdg), d = distM / EARTH_RADIUS_M
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ))
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2))
  return { lat: φ2 * 180 / Math.PI, lon: λ2 * 180 / Math.PI }
}

const distM = (la1, lo1, la2, lo2) =>
  Math.hypot((la2 - la1) * 111320, (lo2 - lo1) * 111320 * Math.cos(toRad(la1)))

const lerpAngle = (from, to, t) => {
  const diff = ((to - from + 540) % 360) - 180
  return from + diff * t
}

const lerpSpeed = (cur, tgt, dt, rate = 8) => {
  const diff = tgt - cur
  const step = rate * dt
  return Math.abs(diff) < step ? tgt : cur + Math.sign(diff) * step
}

function pickRunway(runwaysMap, icao, planeLat, planeLon) {
  const rwys = runwaysMap?.[icao]
  if (!rwys?.length) return null

  let best = null
  let minDistance = Infinity

  for (const rwy of rwys) {
    if (!rwy.le_lat || !rwy.le_lon || !rwy.he_lat || !rwy.he_lon) continue

    const outboundLE = (calcBearing(rwy.le_lat, rwy.le_lon, rwy.he_lat, rwy.he_lon) + 180) % 360
    const fafLE = movePos(rwy.le_lat, rwy.le_lon, outboundLE, FAF_NM * NM)
    const distToFAF_LE = distM(planeLat, planeLon, fafLE.lat, fafLE.lon)

    if (distToFAF_LE < minDistance) {
      minDistance = distToFAF_LE
      const leHdg = calcBearing(rwy.le_lat, rwy.le_lon, rwy.he_lat, rwy.he_lon)
      best = { id: rwy.le_ident, hdg: leHdg, tLat: rwy.le_lat, tLon: rwy.le_lon }
    }

    const outboundHE = (calcBearing(rwy.he_lat, rwy.he_lon, rwy.le_lat, rwy.le_lon) + 180) % 360
    const fafHE = movePos(rwy.he_lat, rwy.he_lon, outboundHE, FAF_NM * NM)
    const distToFAF_HE = distM(planeLat, planeLon, fafHE.lat, fafHE.lon)

    if (distToFAF_HE < minDistance) {
      minDistance = distToFAF_HE
      const heHdg = calcBearing(rwy.he_lat, rwy.he_lon, rwy.le_lat, rwy.le_lon)
      best = { id: rwy.he_ident, hdg: heHdg, tLat: rwy.he_lat, tLon: rwy.he_lon }
    }
  }

  return best
}

function speedForDist(toThr) {
  if (toThr > DST_APPROACH) return SPD_CRUISE
  if (toThr > DST_FINAL)    return SPD_APPROACH
  if (toThr > DST_FLARE)    return SPD_FINAL
  return SPD_FLARE
}

function buildApproachWaypoints(planeLat, planeLon, planeHdg, runway) {
  const outbound  = (runway.hdg + 180) % 360
  const faf       = movePos(runway.tLat, runway.tLon, outbound, FAF_NM * NM)
  const threshold = { lat: runway.tLat, lon: runway.tLon }

  const estToThr = distM(planeLat, planeLon, threshold.lat, threshold.lon)
  const speed = speedForDist(estToThr)
  const stepM = speed * SIM_DT
  const maxSteps = 1000

  // --- PART 1: TRACE BACKWARD FROM THE FAF JOINT ---
  // Determine which side the plane is on relative to the runway centerline to curve outward correctly
  const bearingToFAF = calcBearing(planeLat, planeLon, faf.lat, faf.lon)
  const centerlineAngleDiff = ((runway.hdg - bearingToFAF + 540) % 360) - 180
  const backTurnDir = centerlineAngleDiff >= 0 ? 1 : -1

  const backwardPts = [{ lat: faf.lat, lon: faf.lon, hdg: runway.hdg }]
  let bLat = faf.lat
  let bLon = faf.lon
  let bHdg = runway.hdg

  // Generate a standard smooth procedural base curve stretching backward from the FAF joint
  for (let s = 0; s < 180; s++) {
    const hdgChange = SIM_TURN_RATE_DEG_S * SIM_DT * backTurnDir
    bHdg = (bHdg - hdgChange + 360) % 360
    const backMoveHdg = (bHdg + 180) % 360
    const nextPos = movePos(bLat, bLon, backMoveHdg, stepM)
    bLat = nextPos.lat
    bLon = nextPos.lon
    backwardPts.push({ lat: bLat, lon: bLon, hdg: bHdg })
  }

  // --- PART 2: SIMULATE FORWARD FROM CURRENT PLANE POSITION & HEADING ---
  let fLat = planeLat
  let fLon = planeLon
  let fHdg = planeHdg
  const forwardPts = [{ lat: fLat, lon: fLon, hdg: fHdg }]

  let bestForwardIdx = 0
  let bestBackwardIdx = 0
  let interceptFound = false

  for (let f = 0; f < maxSteps; f++) {
    // Look ahead to find if any point along our current forward flight line path 
    // cleanly intersects or aligns with a position on the backward-traced arrival track
    let closestBackIdx = -1
    let minDiff = Infinity

    for (let b = 0; b < backwardPts.length; b++) {
      const bPt = backwardPts[b]
      const brgToTarget = calcBearing(fLat, fLon, bPt.lat, bPt.lon)
      
      // Look for a perfect vector convergence: current heading matches direction to target,
      // and target's expected entry heading matches that exact tracking trajectory line
      const headingDiff = Math.abs(((fHdg - brgToTarget + 540) % 360) - 180)
      const targetArrivalDiff = Math.abs(((bPt.hdg - brgToTarget + 540) % 360) - 180)
      const totalMisalignment = headingDiff + targetArrivalDiff

      if (totalMisalignment < minDiff) {
        minDiff = totalMisalignment
        closestBackIdx = b
      }
    }

    // Capture the exact moment where tracking fields smoothly cross/unify within tolerances
    if (closestBackIdx !== -1 && minDiff < 4.0) {
      bestForwardIdx = f
      bestBackwardIdx = closestBackIdx
      interceptFound = true
      break
    }

    // Determine the direction the plane needs to steer to capture the backward track
    const targetPt = backwardPts[0] // Aim generally toward the arrival base structure
    const brgToTrack = calcBearing(fLat, fLon, targetPt.lat, targetPt.lon)
    const steerDiff = ((brgToTrack - fHdg + 540) % 360) - 180
    const steerDir = steerDiff >= 0 ? 1 : -1

    // Apply strict turn physics limit constraints
    const maxTurn = SIM_TURN_RATE_DEG_S * SIM_DT
    const hdgApply = Math.sign(steerDiff) * Math.min(Math.abs(steerDiff), maxTurn)
    fHdg = (fHdg + hdgApply + 360) % 360

    const nextPos = movePos(fLat, fLon, fHdg, stepM)
    fLat = nextPos.lat
    fLon = nextPos.lon
    forwardPts.push({ lat: fLat, lon: fLon, hdg: fHdg })
  }

  // --- PART 3: CONNECTING THE DISCOVERY LINES ---
  const dynamicTrack = []

  if (interceptFound) {
    // 1. Add the smooth forward turn points up to the intercept point
    for (let i = 0; i <= bestForwardIdx; i++) {
      dynamicTrack.push({ lat: forwardPts[i].lat, lon: forwardPts[i].lon })
    }

    // 2. Add an intermediate closing line segment between the two paths if a minor gap remains
    const interceptStart = forwardPts[bestForwardIdx]
    const interceptEnd = backwardPts[bestBackwardIdx]
    const gapDist = distM(interceptStart.lat, interceptStart.lon, interceptEnd.lat, interceptEnd.lon)
    
    if (gapDist > stepM) {
      let cLat = interceptStart.lat
      let cLon = interceptStart.lon
      const gapBrg = calcBearing(cLat, cLon, interceptEnd.lat, interceptEnd.lon)
      let dCount = 0
      while (distM(cLat, cLon, interceptEnd.lat, interceptEnd.lon) > stepM && dCount < 100) {
        const nPos = movePos(cLat, cLon, gapBrg, stepM)
        cLat = nPos.lat
        cLon = nPos.lon
        dynamicTrack.push({ lat: cLat, lon: cLon })
        dCount++
      }
    }

    // 3. Follow the backward track curve points down into the FAF joint entry point
    for (let i = bestBackwardIdx; i >= 0; i--) {
      dynamicTrack.push({ lat: backwardPts[i].lat, lon: backwardPts[i].lon })
    }
  } else {
    // Complete seamless mathematical fallback safety line to FAF joint if angles are completely broken
    dynamicTrack.push({ lat: planeLat, lon: planeLon })
    dynamicTrack.push({ lat: faf.lat, lon: faf.lon })
  }

  // --- PART 4: SOLID APPROACH CENTERLINE TO RUNWAY ---
  const finalWaypoints = [...dynamicTrack]
  let centerlineLat = faf.lat
  let centerlineLon = faf.lon
  const rwyBrg = runway.hdg
  const totalCenterlineDist = distM(faf.lat, faf.lon, threshold.lat, threshold.lon)
  
  let clTravelled = 0
  while (clTravelled < totalCenterlineDist) {
    const nextCl = movePos(centerlineLat, centerlineLon, rwyBrg, stepM)
    centerlineLat = nextCl.lat
    centerlineLon = nextCl.lon
    finalWaypoints.push({ lat: centerlineLat, lon: centerlineLon })
    clTravelled += stepM
  }
  finalWaypoints.push({ ...threshold })

  return { 
    allWPs: finalWaypoints, 
    curveLine: dynamicTrack.map(p => [p.lat, p.lon]), 
    centerlineLine: [[faf.lat, faf.lon], [runway.tLat, runway.tLon]] 
  }
}

const makePlaneIcon = (isSelected, landing) => {
  const color = landing ? '#22c55e' : isSelected ? '#fff' : '#666'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24">
    <path fill="${color}" d="M12,2A1.5,1.5,0,0,0,10.5,3.5V8.5L2,14v2l8.5-2.5V19L8,21v1l4-1,4,1V21l-2.5-2V13.5L22,16V14L13.5,8.5V3.5A1.5,1.5,0,0,0,12,2Z"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [28, 28], iconAnchor: [14, 14] })
}

const extrapolate = (state, now) => {
  const elapsed = Math.max(0, (now - state.updatedAt) / 1000)
  if (!state.velocity || !state.heading || elapsed === 0) return { lat: state.lat, lon: state.lon }
  return movePos(state.lat, state.lon, state.heading, state.velocity * elapsed)
}

const getDisplayPos = (state, now) => {
  if (!state.correcting) return extrapolate(state, now)
  const t = Math.min(1, (now - state.corrStart) / CORRECTION_MS)
  const pos = {
    lat: state.corrFrom.lat + (state.corrTo.lat - state.corrFrom.lat) * (1 - (1 - t) ** 2),
    lon: state.corrFrom.lon + (state.corrTo.lon - state.corrFrom.lon) * (1 - (1 - t) ** 2),
  }
  if (t >= 1) { state.correcting = false; state.lat = state.corrTo.lat; state.lon = state.corrTo.lon; state.updatedAt = now }
  return pos
}

export default function AnimatedAircraftMarker({
  craft, isSelected, landingTarget, runwaysMap, livePosRef, onSelect, onLandingComplete,
}) {
  const markerRef        = useRef(null)
  const onSelectRef      = useRef(onSelect)
  const craftRef         = useRef(craft)
  const landingRef       = useRef(landingTarget)
  const runwaysRef       = useRef(runwaysMap)
  const livePosRefRef    = useRef(livePosRef)
  const onLandingRef     = useRef(onLandingComplete)

  useEffect(() => { onSelectRef.current   = onSelect         }, [onSelect])
  useEffect(() => { craftRef.current      = craft            }, [craft])
  useEffect(() => { landingRef.current    = landingTarget    }, [landingTarget])
  useEffect(() => { runwaysRef.current    = runwaysMap       }, [runwaysMap])
  useEffect(() => { livePosRefRef.current = livePosRef       }, [livePosRef])
  useEffect(() => { onLandingRef.current  = onLandingComplete }, [onLandingComplete])

  const handleClick = useRef(() => onSelectRef.current?.(craftRef.current)).current

  const [pathVis, setPathVis] = useState(null)

  const stateRef = useRef({
    lat: craft.lat, lon: craft.lon,
    heading: craft.heading, velocity: craft.velocity,
    updatedAt: Date.now(),
    correcting: false,
    corrFrom: { lat: craft.lat, lon: craft.lon },
    corrTo:   { lat: craft.lat, lon: craft.lon },
    corrStart: 0,
    displayHeading:   craft.heading ?? 0,
    commandedHeading: craft.heading ?? 0,
    lastTick: Date.now(),
    landing:     false,
    runway:      null,
    waypoints:   [],
    wpIdx:       0,
    landSpeed:   craft.velocity ?? SPD_CRUISE,
    landAlt:     craft.baroAlt  ?? 10000,
    landPhase:   'cruise',
    cLat:        craft.lat,
    cLon:        craft.lon,
  })

  useEffect(() => {
    const state = stateRef.current, now = Date.now()
    const cur = getDisplayPos(state, now)
    const d   = distM(cur.lat, cur.lon, craft.lat, craft.lon)
    if (d > 15) {
      state.correcting = true; state.corrFrom = cur
      state.corrTo = { lat: craft.lat, lon: craft.lon }; state.corrStart = now
    } else {
      state.correcting = false; state.lat = craft.lat; state.lon = craft.lon; state.updatedAt = now
    }
    state.heading  = craft.heading
    state.velocity = craft.velocity
    if (!state.landing && craft.baroAlt != null) state.landAlt = craft.baroAlt
  }, [craft.lat, craft.lon, craft.heading, craft.velocity])

  useEffect(() => {
    const state = stateRef.current
    if (!landingTarget) {
      state.landing = false; state.runway = null; state.waypoints = []; state.wpIdx = 0
      setPathVis(null)
      return
    }

    const now = Date.now()
    const cur = getDisplayPos(state, now)

    const runway = pickRunway(runwaysMap, landingTarget.airport, cur.lat, cur.lon)
    if (!runway) return

    // Pass the actual real-time current display heading to guarantee smooth turn initialization
    const { allWPs, curveLine, centerlineLine } = buildApproachWaypoints(cur.lat, cur.lon, state.displayHeading, runway)

    state.landing          = true
    state.runway           = runway
    state.waypoints        = allWPs
    state.wpIdx            = 0
    state.commandedHeading = state.displayHeading
    state.cLat             = cur.lat
    state.cLon             = cur.lon
    state.landSpeed        = Math.max(state.velocity ?? SPD_CRUISE, SPD_APPROACH)
    state.landAlt          = craftRef.current?.baroAlt ?? 10000
    state.landPhase        = 'cruise'

    setPathVis({ curveLine, centerlineLine })
  }, [landingTarget, runwaysMap])

  useEffect(() => {
    const marker = markerRef.current
    if (marker) marker.setIcon(makePlaneIcon(isSelected, !!landingTarget))
  }, [isSelected, landingTarget])

  useEffect(() => {
    let frameId

    const tick = () => {
      const marker = markerRef.current
      if (!marker) { frameId = requestAnimationFrame(tick); return }

      const state = stateRef.current
      const now   = Date.now()
      const dt    = Math.min(0.1, (now - state.lastTick) / 1000)
      state.lastTick = now

      let pos

      if (state.landing && state.waypoints.length > 0) {
        const runway = state.runway
        const threshold = runway ? { lat: runway.tLat, lon: runway.tLon } : null
        const toThreshold = threshold ? distM(state.cLat, state.cLon, threshold.lat, threshold.lon) : 0

        if (state.landPhase === 'cruise'   && toThreshold < DST_APPROACH) state.landPhase = 'approach'
        if (state.landPhase === 'approach' && toThreshold < DST_FINAL)    state.landPhase = 'final'
        if (state.landPhase === 'final'    && toThreshold < DST_FLARE)    state.landPhase = 'flare'
        if (state.landPhase === 'flare'    && toThreshold < DST_TOUCHDOWN) {
          state.landPhase = 'roll'; state.landAlt = 0
        }

        if (state.landPhase === 'done') {
          pos = { lat: state.cLat, lon: state.cLon }
        } else if (state.landPhase === 'roll') {
          state.landSpeed = lerpSpeed(state.landSpeed, 0, dt, 4)
          if (state.landSpeed < 0.5) {
            state.landSpeed = 0; state.landPhase = 'done'
            if (onLandingRef.current) { onLandingRef.current(); onLandingRef.current = null }
          }
          const moved = movePos(state.cLat, state.cLon, state.commandedHeading, state.landSpeed * dt)
          state.cLat = moved.lat; state.cLon = moved.lon; state.landAlt = 0
          pos = { lat: state.cLat, lon: state.cLon }
        } else {
          const targetSpeed =
            state.landPhase === 'cruise'   ? SPD_CRUISE :
            state.landPhase === 'approach' ? SPD_APPROACH :
            state.landPhase === 'final'    ? SPD_FINAL : SPD_FLARE
          state.landSpeed = lerpSpeed(state.landSpeed, targetSpeed, dt, 5)

          let budget = state.landSpeed * dt
          while (budget > 0 && state.wpIdx < state.waypoints.length) {
            const tgt     = state.waypoints[state.wpIdx]
            const segDist = distM(state.cLat, state.cLon, tgt.lat, tgt.lon)
            const segBrg  = calcBearing(state.cLat, state.cLon, tgt.lat, tgt.lon)
            state.commandedHeading = segBrg
            if (segDist <= budget) {
              state.cLat = tgt.lat; state.cLon = tgt.lon
              budget -= segDist
              state.wpIdx++
            } else {
              const moved = movePos(state.cLat, state.cLon, segBrg, budget)
              state.cLat = moved.lat; state.cLon = moved.lon
              budget = 0
            }
          }
          pos = { lat: state.cLat, lon: state.cLon }

          const toThr = distM(state.cLat, state.cLon, threshold.lat, threshold.lon)
          const glideAlt = Math.max(0, toThr * GLIDE_SLOPE)
          if (state.landPhase !== 'cruise') {
            state.landAlt = lerpSpeed(state.landAlt, glideAlt, dt, 12)
          }
        }

      } else {
        pos = getDisplayPos(state, now)
        if (state.heading != null) state.commandedHeading = state.heading
      }

      state.displayHeading = lerpAngle(state.displayHeading, state.commandedHeading, 0.12)
      marker.setLatLng([pos.lat, pos.lon])

      if (livePosRefRef.current) {
        livePosRefRef.current.current = {
          lat:      pos.lat,
          lon:      pos.lon,
          velocity: state.landing ? state.landSpeed : state.velocity,
          alt:      state.landing ? state.landAlt   : craftRef.current?.baroAlt,
          phase:    state.landing ? state.landPhase : null,
        }
      }

      const el = marker.getElement()
      if (el) { 
        const svg = el.querySelector('svg')
        if (svg) svg.style.transform = `rotate(${state.displayHeading}deg)` 
      }

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
        icon={makePlaneIcon(isSelected, !!landingTarget)}
        zIndexOffset={isSelected ? 1000 : 0}
        eventHandlers={{ click: handleClick }}
      />

      {/* Intercept line: Curves smoothly away from the plane's real heading, locks flatly to the FAF joint */}
      {pathVis?.curveLine?.length > 1 && (
        <Polyline
          positions={pathVis.curveLine}
          pathOptions={{ color: '#22c55e', weight: 1.5, dashArray: '8 6', opacity: 0.65 }}
          interactive={false}
        />
      )}

      {/* Untouched solid approach final line */}
      {pathVis?.centerlineLine && (
        <Polyline
          positions={pathVis.centerlineLine}
          pathOptions={{ color: '#22c55e', weight: 2.5, opacity: 0.9 }}
          interactive={false}
        />
      )}
    </>
  )
}