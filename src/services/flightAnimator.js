// Flight animation engine — ground ops speed/altitude curves
// Returns current { speed_kt, alt_ft, phase, pitch_deg } for a given elapsed time

const EARTH_R = 6371000

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)) }
function cubicEase(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2 }

// Phase definitions: [speedStart_kt, speedEnd_kt, alt_ft, duration_s]
const TAKEOFF_PHASES = [
  { name: 'PUSHBACK',        sStart:   0, sEnd:   3, altStart:   500, altEnd:   500, dur: 15 },
  { name: 'TAXI_TO_RUNWAY',  sStart:   3, sEnd:  15, altStart:   500, altEnd:   500, dur: 20 },
  { name: 'HOLDING_SHORT',   sStart:  15, sEnd:   0, altStart:   500, altEnd:   500, dur:  3 },
  { name: 'LINEUP_AND_WAIT', sStart:   0, sEnd:   0, altStart:   500, altEnd:   500, dur:  4 },
  { name: 'TAKEOFF_ROLL',    sStart:   0, sEnd: 160, altStart:   500, altEnd:   500, dur: 30, ease: true },
  { name: 'ROTATE',          sStart: 160, sEnd: 180, altStart:   500, altEnd:  3000, dur:  5 },
  { name: 'CLIMBING',        sStart: 180, sEnd: 280, altStart:  3000, altEnd: 32000, dur: 60 },
  { name: 'CRUISE',          sStart: 280, sEnd: 280, altStart: 32000, altEnd: 32000, dur: Infinity },
]

const LANDING_PHASES = [
  { name: 'DESCENDING',     sStart: 280, sEnd: 200, altStart: 32000, altEnd:  5000, dur: 120 },
  { name: 'APPROACH',       sStart: 200, sEnd: 140, altStart:  5000, altEnd:  2000, dur:  60 },
  { name: 'FINAL',          sStart: 140, sEnd: 140, altStart:  2000, altEnd:   300, dur:  30 },
  { name: 'TOUCHDOWN',      sStart: 140, sEnd:  80, altStart:   300, altEnd:   500, dur:  20, ease: true },
  { name: 'LANDING_ROLL',   sStart:  80, sEnd:   0, altStart:   500, altEnd:   500, dur:  20, ease: true },
  { name: 'VACATE_RUNWAY',  sStart:   0, sEnd:  15, altStart:   500, altEnd:   500, dur:   8 },
  { name: 'TAXI_TO_GATE',   sStart:  15, sEnd:   0, altStart:   500, altEnd:   500, dur:  20 },
  { name: 'PARKED_AT_GATE', sStart:   0, sEnd:   0, altStart:   500, altEnd:   500, dur: Infinity },
]

const PITCH_BY_PHASE = {
  PARKED_AT_GATE: 0, PUSHBACK: 0, TAXI_TO_RUNWAY: 0, HOLDING_SHORT: 0,
  LINEUP_AND_WAIT: 0, TAKEOFF_ROLL: 3, ROTATE: 20, CLIMBING: 15,
  CRUISE: 2, DESCENDING: -5, APPROACH: -8, FINAL: -10,
  TOUCHDOWN: -5, LANDING_ROLL: 0, VACATE_RUNWAY: 0, TAXI_TO_GATE: 0,
}

export function getPhaseState(phases, elapsedS) {
  let t = elapsedS
  for (const p of phases) {
    if (t <= p.dur || p.dur === Infinity) {
      const ratio = p.dur === Infinity ? 0 : t / p.dur
      const ease  = p.ease ? cubicEase(ratio) : ratio
      const speed = lerp(p.sStart, p.sEnd, ease)
      const alt   = lerp(p.altStart, p.altEnd, ease)
      return {
        phase:    p.name,
        speed_kt: Math.round(speed),
        alt_ft:   Math.round(alt),
        pitch_deg: PITCH_BY_PHASE[p.name] ?? 0,
        progress: p.dur === Infinity ? 1 : ratio,
      }
    }
    t -= p.dur
  }
  const last = phases[phases.length - 1]
  return { phase: last.name, speed_kt: last.sEnd, alt_ft: last.altEnd, pitch_deg: 0, progress: 1 }
}

export function getTakeoffState(elapsedS) { return getPhaseState(TAKEOFF_PHASES, elapsedS) }
export function getLandingState(elapsedS) { return getPhaseState(LANDING_PHASES, elapsedS) }

// Move a point along a bearing by distance
export function movePoint(lat, lon, bearingDeg, distM) {
  const R = EARTH_R, d = distM / R, b = bearingDeg * Math.PI / 180
  const φ1 = lat * Math.PI / 180, λ1 = lon * Math.PI / 180
  const φ2 = Math.asin(Math.sin(φ1)*Math.cos(d) + Math.cos(φ1)*Math.sin(d)*Math.cos(b))
  const λ2 = λ1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(φ1), Math.cos(d)-Math.sin(φ1)*Math.sin(φ2))
  return [φ2 * 180/Math.PI, λ2 * 180/Math.PI]
}

export { TAKEOFF_PHASES, LANDING_PHASES }
