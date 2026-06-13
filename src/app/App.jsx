import React, { useEffect, useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import Airports        from '../components/Airports.jsx'
import Aircraft        from '../components/Aircraft.jsx'
import AirportInfoCard from '../components/AirportInfoCard.jsx'
import WindLayer, { WIND_LEVELS } from '../components/WindLayer.jsx'
import CommandLog      from '../components/CommandLog.jsx'
import RoutePreview    from '../components/RoutePreview.jsx'
import { on, send, setPTTActive } from '../services/wsClient.js'
import { startListening, stopListening, isSupported } from '../services/voiceInput.js'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const DEFAULT_CENTER = [43.677, -79.6305]

const CONFIRM_RE = /\b(confirm|confirmed|yes|yeah|affirm|affirmative|approved|approve|wilco|roger|correct|proceed|go ahead)\b/i
const CANCEL_RE  = /\b(cancel|negative|no|abort|stop|nope|nah|disregard)\b/i
const LAND_RE    = /\b(land|approach|cleared to land)\b/i

const AIRPORT_COORDS = {
  CYYZ: { lat: 43.6777, lon: -79.6248 },
  KJFK: { lat: 40.6413, lon: -73.7781 },
  KORD: { lat: 41.9742, lon: -87.9073 },
  CYUL: { lat: 45.4706, lon: -73.7408 },
  CYVR: { lat: 49.1967, lon: -123.1815 },
  CYYC: { lat: 51.1315, lon: -114.0106 },
  CYEG: { lat: 53.3097, lon: -113.5797 },
}
const AIRPORT_ALIASES = {
  toronto: 'CYYZ', pearson: 'CYYZ', yyz: 'CYYZ',
  jfk: 'KJFK', 'new york': 'KJFK', kennedy: 'KJFK',
  chicago: 'KORD', ohare: 'KORD', ord: 'KORD',
  montreal: 'CYUL', yul: 'CYUL',
  vancouver: 'CYVR', yvr: 'CYVR',
  calgary: 'CYYC', yyc: 'CYYC',
  edmonton: 'CYEG', yeg: 'CYEG',
}
function parseLandTarget(text) {
  const t = text.toLowerCase()
  for (const [alias, icao] of Object.entries(AIRPORT_ALIASES)) {
    if (t.includes(alias)) return { airport: icao, runway: '06L', ...AIRPORT_COORDS[icao] }
  }
  return null
}

const LANGUAGES = [
  { code: 'fr', label: 'Français'  },
  { code: 'en', label: 'English'   },
  { code: 'es', label: 'Español'   },
  { code: 'pt', label: 'Português' },
  { code: 'zh', label: '中文'      },
  { code: 'ar', label: 'العربية'  },
]

export default function App() {
  const [loading,          setLoading]          = useState(true)
  const [selectedAirport,  setSelectedAirport]  = useState(null)
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [windVisible,      setWindVisible]      = useState(false)
  const [runwaysMap,       setRunwaysMap]       = useState({})
  const livePosRef = useRef(null)

  const [wsConnected, setWsConnected] = useState(false)
  const [appState,    setAppState]    = useState('IDLE')
  const [lang,        setLang]        = useState('fr')
  const [transcript,  setTranscript]  = useState('')
  const [readback,    setReadback]    = useState(null)
  const [routes,      setRoutes]      = useState([])
  const [commandLog,  setCommandLog]  = useState([])
  const [isListening,    setIsListening]    = useState(false)
  const [pttHeld,        setPttHeld]        = useState(false)
  const [landingTarget,  setLandingTarget]  = useState(null)
  const [approved,       setApproved]       = useState(false)
  const pendingLandMeta = useRef(null)

  // ── WebSocket events ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      on('_connected',    () => setWsConnected(true)),
      on('_disconnected', () => setWsConnected(false)),
      on('state', (msg) => {
        setAppState(msg.state)
        // Voice "confirm" path: server transitions to EXECUTING — apply pending land target
        if (msg.state === 'EXECUTING' && pendingLandMeta.current) {
          setLandingTarget(pendingLandMeta.current)
          pendingLandMeta.current = null
          setApproved(true)
          setTimeout(() => setApproved(false), 3000)
        }
      }),
      on('readback', (msg) => {
        setReadback({ english: msg.english, translated: msg.translated })
        if (msg.meta?.command === 'land') {
          pendingLandMeta.current = { lat: msg.meta.lat, lon: msg.meta.lon, airport: msg.meta.airport, runway: msg.meta.runway }
        } else {
          pendingLandMeta.current = null
        }
      }),
      on('routes',  (msg) => setRoutes(msg.routes ?? [])),
      on('land_execute', (msg) => {
        setLandingTarget({ lat: msg.lat, lon: msg.lon, airport: msg.airport, runway: msg.runway })
        setApproved(true)
        setTimeout(() => setApproved(false), 3000)
      }),
      on('log', (msg) => {
        setCommandLog(prev => {
          const idx = prev.findIndex(e => e.id === msg.entry.id)
          if (idx >= 0) { const n = [...prev]; n[idx] = msg.entry; return n }
          return [msg.entry, ...prev].slice(0, 20)
        })
      }),
    ]
    return () => unsubs.forEach(fn => fn())
  }, [])

  // ── Space bar PTT ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !e.target.matches('input,select,textarea') && !pttHeld) {
        e.preventDefault(); setPttHeld(true); handlePTTStart()
      }
    }
    const up = (e) => { if (e.code === 'Space') { setPttHeld(false); handlePTTEnd() } }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [pttHeld])

  const handlePTTStart = useCallback(() => {
    if (!isSupported()) return
    setPTTActive(true)
    setIsListening(true)
    setTranscript('')
    startListening({
      onListenStart: () => setIsListening(true),
      onTranscript:  (text) => {
        setTranscript(text)
        setPTTActive(false)

        if (LAND_RE.test(text)) {
          // Store land target client-side immediately so confirm doesn't need server
          const target = parseLandTarget(text)
          if (target) pendingLandMeta.current = target
        } else if (CONFIRM_RE.test(text) && pendingLandMeta.current) {
          // Confirm locally — don't wait for server round-trip
          setLandingTarget(pendingLandMeta.current)
          pendingLandMeta.current = null
          setApproved(true)
          setTimeout(() => setApproved(false), 3000)
        } else if (CANCEL_RE.test(text)) {
          pendingLandMeta.current = null
          setLandingTarget(null)
        }

        send({ type: 'transcript', text })
        setIsListening(false)
      },
      onListenEnd: () => { setPTTActive(false); setIsListening(false) },
    })
  }, [])

  const handlePTTEnd = useCallback(() => {
    stopListening()
    setPTTActive(false)
    setIsListening(false)
  }, [])

  const handleLangChange = (newLang) => { setLang(newLang); send({ type: 'language', lang: newLang }) }

  const handleConfirm = () => {
    send({ type: 'confirm' })
    if (pendingLandMeta.current) {
      setLandingTarget(pendingLandMeta.current)
      pendingLandMeta.current = null
      setApproved(true)
      setTimeout(() => setApproved(false), 3000)
    }
  }

  const handleCancel = () => {
    send({ type: 'cancel' })
    pendingLandMeta.current = null
    setLandingTarget(null)
  }

  return (
    <div className="cockpit">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="topbar">
        <div className="topbar__left">
          <span className="topbar__logo">AeroVox</span>
{!wsConnected && <span className="topbar__offline">⚡ offline</span>}
        </div>

        <div className="topbar__center">
          {transcript && (
            <div className="topbar__transcript">
              <span className="topbar__transcript-label">HEARD</span>
              <span className="topbar__transcript-text">"{transcript}"</span>
            </div>
          )}
          {readback && (
            <div className="topbar__readback">
              <span className="topbar__readback-fr">{readback.translated}</span>
            </div>
          )}
          {approved && (
            <div className="topbar__approved">✓ APPROVED</div>
          )}
        </div>

        <div className="topbar__right">
          <select className="topbar__lang" value={lang} onChange={e => handleLangChange(e.target.value)}>
            {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          {appState === 'AWAITING_CONFIRMATION' && !approved && (
            <div className="topbar__awaiting">Say "confirm" or "cancel"</div>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="cockpit__body">
        <div className="cockpit__map">
          {loading && <div className="loading-pill">Loading airport data…</div>}

          <MapContainer
            center={DEFAULT_CENTER} zoom={10} minZoom={2}
            scrollWheelZoom dragging doubleClickZoom touchZoom
            style={{ width: '100%', height: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; OpenStreetMap contributors &copy; CARTO'
              maxZoom={19}
            />
            <Airports
              onLoad={() => setLoading(false)}
              onRunwaysLoaded={setRunwaysMap}
              selectedIdent={selectedAirport?.ident}
              onSelectAirport={(airport) =>
                setSelectedAirport(prev => prev?.ident === airport.ident ? null : airport)
              }
            />
            <Aircraft
              selectedCallsign={selectedAircraft?.callsign}
              landingTarget={landingTarget}
              runwaysMap={runwaysMap}
              livePosRef={livePosRef}
              onSelectAircraft={setSelectedAircraft}
              onLandingComplete={() => setLandingTarget(null)}
            />
            <WindLayer visible={windVisible} />
            <RoutePreview routes={routes} appState={appState} />
          </MapContainer>

          <AirportInfoCard
            airport={selectedAirport}
            runwaysMap={runwaysMap}
            onClose={() => setSelectedAirport(null)}
          />

          <div className="wind-controls">
            <button
              className={`wind-toggle${windVisible ? ' wind-toggle--active' : ''}`}
              onClick={() => setWindVisible(v => !v)}
            >
              <span className="wind-toggle__icon">〜</span>
              Wind {windVisible ? 'On' : 'Off'}
            </button>
            {windVisible && (
              <div className="wind-legend">
                <div className="wind-legend__title">Wind Speed</div>
                {WIND_LEVELS.map(({ label, max, rgb }) => (
                  <div key={label} className="wind-legend__row">
                    <span className="wind-legend__swatch" style={{ background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})` }} />
                    <span className="wind-legend__label">{label}</span>
                    <span className="wind-legend__range">
                      {max === Infinity ? '> 79 km/h' : `< ${Math.round(max * 3.6)} km/h`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────────── */}
        <div className="cockpit__sidebar">
          <CommandLog
            entries={commandLog}
            craft={selectedAircraft}
            livePosRef={livePosRef}
            onCloseAircraft={() => setSelectedAircraft(null)}
          />
        </div>
      </div>

      {/* ── Bottom bar ──────────────────────────────────────────────────────── */}
      <div className="bottombar">
        <button
          className={`ptt-btn${isListening ? ' ptt-btn--active' : ''}`}
          onMouseDown={handlePTTStart} onMouseUp={handlePTTEnd}
          onTouchStart={handlePTTStart} onTouchEnd={handlePTTEnd}
        >
          <span className="ptt-btn__icon">{isListening ? '🎙' : '🎤'}</span>
          {isListening ? 'Listening…' : 'Push to Talk'}
          <span className="ptt-btn__hint">[Space]</span>
        </button>
      </div>
    </div>
  )
}
