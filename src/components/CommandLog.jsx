import React, { useEffect, useRef, useState } from 'react'

// ── Aircraft telemetry helpers ────────────────────────────────────────────────
const M_TO_FT     = 3.28084
const MS_TO_KNOTS = 1.94384
const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
const compassPoint = (deg) => COMPASS[Math.round((deg % 360) / 22.5) % 16]
const fmtAlt   = (m)   => m   == null ? '—' : `${Math.round(m * M_TO_FT).toLocaleString()} ft`
const fmtSpeed = (ms)  => ms  == null ? '—' : `${Math.round(ms * MS_TO_KNOTS)} kt`
const fmtHead  = (deg) => deg == null ? '—' : `${Math.round(deg)}° ${compassPoint(deg)}`
const fmtCoord = (v, pos, neg) => v == null ? '—' : `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`

function AircraftPanel({ craft, livePosRef, onClose }) {
  const [liveState, setLiveState] = useState({
    lat: craft.lat, lon: craft.lon, velocity: null, alt: null, phase: null, runway: null,
  })

  useEffect(() => {
    setLiveState({ lat: craft.lat, lon: craft.lon, velocity: null, alt: null, phase: null, runway: null })
    let frameId
    const tick = () => {
      if (livePosRef?.current) {
        const p = livePosRef.current
        setLiveState(prev => {
          if (prev.lat === p.lat && prev.lon === p.lon &&
              prev.velocity === p.velocity && prev.alt === p.alt &&
              prev.phase === p.phase && prev.runway === p.runway) return prev
          return { lat: p.lat, lon: p.lon, velocity: p.velocity ?? null, alt: p.alt ?? null, phase: p.phase ?? null, runway: p.runway ?? null }
        })
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [craft.icao24])

  const { icao24, callsign, country, velocity, heading, squawk, baroAlt } = craft

  return (
    <div className="ac-panel">
      <div className="ac-panel__header">
        <span
          className="ac-panel__icon"
          style={{ display: 'inline-block', transform: `rotate(${heading ?? 0}deg)` }}
        >✈</span>
        <div className="ac-panel__titles">
          <span className="ac-panel__callsign">{callsign}</span>
          <span className="ac-panel__icao">{icao24?.toUpperCase()}</span>
        </div>
        <button className="ac-panel__close" onClick={onClose}>×</button>
      </div>

      <div className="ac-panel__telem">
        <div className="ac-panel__telem-row">
          <span className="ac-panel__telem-label">SPD</span>
          <span className="ac-panel__telem-value">{fmtSpeed(liveState.velocity ?? velocity)}</span>
          <span className="ac-panel__telem-label">HDG</span>
          <span className="ac-panel__telem-value">{fmtHead(heading)}</span>
        </div>
        <div className="ac-panel__telem-row">
          <span className="ac-panel__telem-label">LAT</span>
          <span className="ac-panel__telem-value">{fmtCoord(liveState.lat, 'N', 'S')}</span>
          <span className="ac-panel__telem-label">LON</span>
          <span className="ac-panel__telem-value">{fmtCoord(liveState.lon, 'E', 'W')}</span>
        </div>
        <div className="ac-panel__telem-row">
          <span className="ac-panel__telem-label">ALT</span>
          <span className="ac-panel__telem-value">{fmtAlt(liveState.alt ?? baroAlt)}</span>
          <span className="ac-panel__telem-label">SQK</span>
          <span className="ac-panel__telem-value">{squawk || '—'}</span>
        </div>
        {liveState.phase && (
          <div className="ac-panel__telem-row">
            <span className="ac-panel__telem-label">PHASE</span>
            <span className="ac-panel__telem-value" style={{ gridColumn: 'span 3', color: '#22c55e' }}>
              {liveState.phase.toUpperCase()}
            </span>
          </div>
        )}
        {liveState.runway && (
          <div className="ac-panel__telem-row">
            <span className="ac-panel__telem-label">RWY</span>
            <span className="ac-panel__telem-value" style={{ gridColumn: 'span 3', color: '#22c55e' }}>
              {liveState.runway}
            </span>
          </div>
        )}
        {country && (
          <div className="ac-panel__telem-row">
            <span className="ac-panel__telem-label">ORG</span>
            <span className="ac-panel__telem-value" style={{ gridColumn: 'span 3' }}>{country}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Log status helpers ────────────────────────────────────────────────────────
const STATUS_ICON = {
  confirmed: '✓', cancelled: '✗', timeout: '⏱', pending: '…', responded: '✓',
}
const STATUS_CLASS = {
  confirmed: 'log-entry--ok', cancelled: 'log-entry--err', timeout: 'log-entry--err',
  pending: 'log-entry--pending', responded: 'log-entry--ok',
}

export default function CommandLog({ entries = [], craft, livePosRef, onCloseAircraft }) {
  return (
    <div className="cmd-log">

      {craft && (
        <AircraftPanel
          craft={craft}
          livePosRef={livePosRef}
          onClose={onCloseAircraft}
        />
      )}

      <div className="cmd-log__section-header">Command Log</div>
      <div className="cmd-log__entries">
        {entries.length === 0 && (
          <div className="cmd-log__empty">No commands yet</div>
        )}
        {entries.slice(0, 20).map(entry => (
          <div key={entry.id} className={`log-entry ${STATUS_CLASS[entry.status] ?? ''}`}>
            <span className="log-entry__time">{entry.timestamp}</span>
            <span className="log-entry__type">{entry.display}</span>
            <span className="log-entry__right">
              <span className="log-entry__icon">{STATUS_ICON[entry.status] ?? '?'}</span>
              {entry.confidence != null && (
                <span className="log-entry__conf">{Math.round(entry.confidence * 100)}%</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
