import React, { useEffect, useRef, useState } from 'react'

const M_TO_FT     = 3.28084
const MS_TO_KMH   = 3.6
const MS_TO_KNOTS = 1.94384

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
const compassPoint = (deg) => COMPASS[Math.round((deg % 360) / 22.5) % 16]

const fmtAlt   = (m)   => m  == null ? '—' : `${Math.round(m).toLocaleString()} m / ${Math.round(m * M_TO_FT).toLocaleString()} ft`
const fmtSpeed = (ms)  => ms == null ? '—' : `${Math.round(ms * MS_TO_KMH)} km/h · ${Math.round(ms * MS_TO_KNOTS)} kt`
const fmtHead  = (deg) => deg == null ? '—' : `${Math.round(deg)}° ${compassPoint(deg)}`
const fmtCoord = (v, pos, neg) => v == null ? '—' : `${Math.abs(v).toFixed(5)}° ${v >= 0 ? pos : neg}`

const DEST_KEYS = [
  { key: '1', name: 'CYYZ', city: 'Toronto' },
  { key: '2', name: 'KJFK', city: 'New York' },
  { key: '3', name: 'KORD', city: 'Chicago' },
]

const Row = ({ label, value, highlight }) => (
  <div className="aircraft-card__row">
    <span className="aircraft-card__label">{label}</span>
    <span className={`aircraft-card__value${highlight ? ' aircraft-card__value--nav' : ''}`}>{value}</span>
  </div>
)

const vertIcon  = (vm) => vm === 'climb' ? '↑' : vm === 'descend' ? '↓' : '—'
const vertLabel = (vm) => vm === 'climb' ? 'Climbing' : vm === 'descend' ? 'Descending' : 'Level'
const vertClass = (vm) => vm === 'climb' ? 'climb' : vm === 'descend' ? 'descend' : 'level'

export default function AircraftInfoCard({ craft, dest, throttle, vertMode, livePosRef, onClose }) {
  if (!craft) return null

  const [liveState, setLiveState] = useState({
    lat: craft.lat, lon: craft.lon,
    velocity: null, alt: null, vertMode: null,
  })

  useEffect(() => {
    setLiveState({ lat: craft.lat, lon: craft.lon, velocity: null, alt: null, vertMode: null })
    let frameId
    const tick = () => {
      if (livePosRef?.current) {
        const p = livePosRef.current
        setLiveState(prev => {
          if (prev.lat === p.lat && prev.lon === p.lon &&
              prev.velocity === p.velocity && prev.alt === p.alt &&
              prev.vertMode === p.vertMode) return prev
          return { lat: p.lat, lon: p.lon, velocity: p.velocity ?? null, alt: p.alt ?? null, vertMode: p.vertMode ?? null }
        })
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [craft.icao24])

  const { icao24, callsign, country, velocity, heading, vertRate, squawk } = craft

  // In nav mode, show commanded values; otherwise show ADS-B values
  const navMode        = !!dest
  const displayVelocity = navMode ? liveState.velocity : velocity
  const displayAlt     = navMode ? liveState.alt : craft.baroAlt
  const displayVertMode = navMode ? (liveState.vertMode ?? vertMode) : null

  const throttleLabel = throttle === 0 ? 'Baseline' : throttle > 0 ? `+${throttle} steps` : `${throttle} steps`

  return (
    <div className="aircraft-card">
      <button className="aircraft-card__close" onClick={onClose} aria-label="Close">×</button>

      <div className="aircraft-card__header">
        <span className="aircraft-card__plane" style={{ display: 'inline-block', transform: `rotate(${heading ?? 0}deg)` }}>✈</span>
        <div>
          <div className="aircraft-card__title">{callsign}</div>
          <div className="aircraft-card__subtitle">{icao24?.toUpperCase()}</div>
        </div>
      </div>

      {/* ── destination shortcuts ──────────────────────────────── */}
      <div className="aircraft-card__dest-row">
        {DEST_KEYS.map(({ key, name, city }) => {
          const active = dest?.name === name
          return (
            <div key={key} className={`aircraft-card__dest-btn${active ? ' aircraft-card__dest-btn--active' : ''}`}>
              <span className="aircraft-card__dest-key">[{key}]</span>
              <span className="aircraft-card__dest-name">{name}</span>
              <span className="aircraft-card__dest-city">{city}</span>
            </div>
          )
        })}
      </div>

      {/* ── nav controls (visible when destination set) ─────────── */}
      {navMode && (
        <div className="aircraft-card__nav">
          <div className="aircraft-card__nav-title">
            <span className="aircraft-card__nav-arrow">→</span>
            {dest.name} · {dest.city}
          </div>

          {/* throttle */}
          <div className="aircraft-card__ctrl-row">
            <div className="aircraft-card__ctrl-keys">
              <span className="aircraft-card__ctrl-key aircraft-card__ctrl-key--up">5 ↓</span>
              <span className="aircraft-card__ctrl-key aircraft-card__ctrl-key--up">4 ↑</span>
            </div>
            <div className="aircraft-card__ctrl-body">
              <div className="aircraft-card__ctrl-label">THROTTLE</div>
              <div className="aircraft-card__ctrl-value">
                {fmtSpeed(displayVelocity)}
                <span className={`aircraft-card__throttle-badge${throttle > 0 ? ' pos' : throttle < 0 ? ' neg' : ''}`}>
                  {throttleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* vertical */}
          <div className="aircraft-card__ctrl-row">
            <div className="aircraft-card__ctrl-keys">
              <span className="aircraft-card__ctrl-key">7 ↓</span>
              <span className="aircraft-card__ctrl-key">6 ↑</span>
            </div>
            <div className="aircraft-card__ctrl-body">
              <div className="aircraft-card__ctrl-label">ALTITUDE</div>
              <div className="aircraft-card__ctrl-value">
                {fmtAlt(displayAlt)}
                <span className={`aircraft-card__vert-badge aircraft-card__vert-badge--${vertClass(displayVertMode)}`}>
                  {vertIcon(displayVertMode)} {vertLabel(displayVertMode)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── telemetry ────────────────────────────────────────────── */}
      <div className="aircraft-card__section">
        <Row label="Speed"   value={fmtSpeed(displayVelocity)} highlight={navMode} />
        <Row label="Bearing" value={fmtHead(heading)} />
      </div>

      <div className="aircraft-card__section">
        <Row label="Latitude"  value={fmtCoord(liveState.lat, 'N', 'S')} />
        <Row label="Longitude" value={fmtCoord(liveState.lon, 'E', 'W')} />
        <Row label="Altitude"  value={fmtAlt(displayAlt)} highlight={navMode} />
      </div>

      <div className="aircraft-card__section">
        <Row label="Origin" value={country || '—'} />
        <Row label="Squawk" value={squawk  || '—'} />
      </div>
    </div>
  )
}
