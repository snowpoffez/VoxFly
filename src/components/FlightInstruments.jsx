import React, { useEffect, useRef, useState } from 'react'

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)) }

const PHASE_LABELS = {
  IDLE: 'Standby', LISTENING: 'Listening', COMMAND_RECEIVED: 'Processing',
  ANALYZING: 'Analyzing', RECOMMENDING: 'Recommending',
  AWAITING_CONFIRMATION: 'Awaiting Confirm', EXECUTING: 'Executing',
  STABILIZED: 'Stabilized',
  PARKED_AT_GATE: 'At Gate', PUSHBACK: 'Pushback', TAXI_TO_RUNWAY: 'Taxi',
  HOLDING_SHORT: 'Holding Short', LINEUP_AND_WAIT: 'Line Up Wait',
  TAKEOFF_ROLL: 'T/O Roll', ROTATE: 'Rotate', CLIMBING: 'Climb',
  CRUISE: 'Cruise', DESCENDING: 'Descend', APPROACH: 'Approach',
  FINAL: 'Final', TOUCHDOWN: 'Touchdown', LANDING_ROLL: 'Braking',
  VACATE_RUNWAY: 'Vacating', TAXI_TO_GATE: 'Taxi to Gate',
}

export default function FlightInstruments({ appState, groundState }) {
  const targetRef = useRef({ speed: 0, alt: 500, hdg: 0, vspd: 0 })
  const displayRef = useRef({ speed: 0, alt: 500, hdg: 0, vspd: 0 })
  const [display, setDisplay] = useState({ speed: 0, alt: 500, hdg: 0, vspd: 0 })
  const rafRef = useRef(null)
  const [rotateFlash, setRotateFlash] = useState(false)

  // Update targets from groundState
  useEffect(() => {
    if (!groundState) return
    targetRef.current.speed = groundState.speed_kt ?? 0
    targetRef.current.alt   = groundState.alt_ft   ?? 500
  }, [groundState])

  // Flash ROTATE
  useEffect(() => {
    if (appState === 'ROTATE') {
      setRotateFlash(true)
      const t = setTimeout(() => setRotateFlash(false), 3000)
      return () => clearTimeout(t)
    }
  }, [appState])

  useEffect(() => {
    const tick = () => {
      const d = displayRef.current, tgt = targetRef.current
      const prevAlt = d.alt
      d.speed = lerp(d.speed, tgt.speed, 0.04)
      d.alt   = lerp(d.alt,   tgt.alt,   0.03)
      d.hdg   = lerp(d.hdg,   tgt.hdg,   0.08)
      d.vspd  = (d.alt - prevAlt) * 60  // ft/min
      setDisplay({ speed: d.speed, alt: d.alt, hdg: d.hdg, vspd: d.vspd })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const phase = PHASE_LABELS[appState] ?? appState
  const isRoll = appState === 'TAKEOFF_ROLL'
  const isBraking = appState === 'LANDING_ROLL' || appState === 'TOUCHDOWN'

  return (
    <div className="instruments">
      <div className="instruments__row">
        <div className="instruments__cell">
          <div className="instruments__label">ALT</div>
          <div className="instruments__value">
            {Math.round(display.alt).toLocaleString()}
            <span className="instruments__unit"> ft</span>
          </div>
          <div className={`instruments__sub ${display.vspd > 50 ? 'amber' : display.vspd < -50 ? 'amber' : ''}`}>
            {display.vspd > 10 ? '↑' : display.vspd < -10 ? '↓' : '—'}
            {' '}{Math.abs(Math.round(display.vspd)).toLocaleString()} fpm
          </div>
        </div>

        <div className="instruments__cell">
          <div className="instruments__label">SPD</div>
          <div className="instruments__value">
            {Math.round(display.speed)}
            <span className="instruments__unit"> kt</span>
          </div>
          <div className={`instruments__sub ${isRoll ? 'amber' : isBraking ? 'amber' : ''}`}>
            {isRoll ? 'T/O ROLL' : isBraking ? 'BRAKING' : '—'}
          </div>
        </div>

        <div className="instruments__cell">
          <div className="instruments__label">HDG</div>
          <div className="instruments__value">
            {Math.round(display.hdg)}
            <span className="instruments__unit">°</span>
          </div>
          <div className="instruments__sub">—</div>
        </div>

        <div className="instruments__cell instruments__cell--phase">
          <div className="instruments__label">PHASE</div>
          <div className={`instruments__value instruments__value--phase ${rotateFlash ? 'flash-white' : ''}`}>
            {rotateFlash ? 'ROTATE' : phase}
          </div>
        </div>
      </div>
    </div>
  )
}
