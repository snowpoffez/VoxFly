import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import Airports from '../components/Airports.jsx'
import Aircraft from '../components/Aircraft.jsx'
import AircraftInfoCard from '../components/AircraftInfoCard.jsx'
import AirportInfoCard from '../components/AirportInfoCard.jsx'
import WindLayer, { WIND_LEVELS } from '../components/WindLayer.jsx'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const DEFAULT_CENTER = [43.677, -79.6305]

const DESTINATIONS = {
  '1': { name: 'CYYZ', city: 'Toronto Pearson', lat: 43.6777, lon: -79.6248 },
  '2': { name: 'KJFK', city: 'New York JFK',    lat: 40.6413, lon: -73.7781 },
  '3': { name: 'KORD', city: "Chicago O'Hare",  lat: 41.9742, lon: -87.9073 },
}

const clearNavState = (setAircraftDest, setThrottle, setVertMode) => {
  setAircraftDest(null)
  setThrottle(0)
  setVertMode('level')
}

export default function App() {
  const [loading, setLoading]                   = useState(true)
  const [selectedAirport, setSelectedAirport]   = useState(null)
  const [selectedAircraft, setSelectedAircraft] = useState(null)
  const [aircraftDest, setAircraftDest]         = useState(null)
  const [throttle, setThrottle]                 = useState(0)
  const [vertMode, setVertMode]                 = useState('level')
  const [windVisible, setWindVisible]           = useState(false)
  const [runwaysMap, setRunwaysMap]             = useState({})
  const livePosRef = useRef(null)

  // Key bindings active whenever a plane is selected
  useEffect(() => {
    if (!selectedAircraft) return
    const onKey = (e) => {
      // 1/2/3 — destination
      const dest = DESTINATIONS[e.key]
      if (dest) { setAircraftDest(dest); setThrottle(0); setVertMode('level'); return }
      // 4/5 — throttle
      if (e.key === '4') setThrottle(t => Math.min(t + 1,  8))
      if (e.key === '5') setThrottle(t => Math.max(t - 1, -4))
      // 6/7 — vertical (toggle: press again to level off)
      if (e.key === '6') setVertMode(m => m === 'climb'   ? 'level' : 'climb')
      if (e.key === '7') setVertMode(m => m === 'descend' ? 'level' : 'descend')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedAircraft])

  const handleAirportsLoaded = (airportList) => {
    setLoading(false)
  }

  const center = selectedAirport ? [selectedAirport.lat, selectedAirport.lon] : DEFAULT_CENTER

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {loading && <div className="loading-pill">Loading airport data…</div>}

      <MapContainer
        center={center} zoom={10} minZoom={2}
        scrollWheelZoom dragging doubleClickZoom touchZoom
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        <Airports
          onLoad={handleAirportsLoaded}
          onRunwaysLoaded={setRunwaysMap}
          selectedIdent={selectedAirport?.ident}
          onSelectAirport={(airport) => {
            setSelectedAirport(prev => prev?.ident === airport.ident ? null : airport)
          }}
        />

        <Aircraft
          selectedCallsign={selectedAircraft?.callsign}
          dest={aircraftDest}
          throttle={throttle}
          vertMode={vertMode}
          livePosRef={livePosRef}
          onSelectAircraft={(craft) => {
            setSelectedAircraft(craft)
            clearNavState(setAircraftDest, setThrottle, setVertMode)
          }}
          onArrival={() => clearNavState(setAircraftDest, setThrottle, setVertMode)}
        />

        <WindLayer visible={windVisible} />
      </MapContainer>

      {/* ── wind toggle + legend ─────────────────────────────────── */}
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

      <AirportInfoCard
        airport={selectedAirport}
        runwaysMap={runwaysMap}
        onClose={() => setSelectedAirport(null)}
      />

      <AircraftInfoCard
        craft={selectedAircraft}
        dest={aircraftDest}
        throttle={throttle}
        vertMode={vertMode}
        livePosRef={livePosRef}
        onClose={() => {
          setSelectedAircraft(null)
          clearNavState(setAircraftDest, setThrottle, setVertMode)
        }}
      />
    </div>
  )
}
