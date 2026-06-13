import React, { useState } from 'react'
import { send } from '../services/wsClient.js'

const AIRPORTS_DATA = [
  {
    icao: 'CYYZ', name: 'Toronto Pearson',
    runways: ['05/23','06L/24R','06R/24L','15L/33R','15R/33L'],
    gates:   ['Gate A1','Gate D30','Gate F98'],
  },
  {
    icao: 'CYVR', name: 'Vancouver Intl',
    runways: ['08L/26R','08R/26L'],
    gates:   ['Gate C48','Gate D72'],
  },
  {
    icao: 'CYUL', name: 'Montréal-Trudeau',
    runways: ['06L/24R','10/28'],
    gates:   ['Gate 61'],
  },
  {
    icao: 'CYYC', name: 'Calgary Intl',
    runways: ['08/26','17L/35R'],
    gates:   ['Gate C27'],
  },
  {
    icao: 'CYEG', name: 'Edmonton Intl',
    runways: ['12/30','02/20'],
    gates:   ['Gate A11'],
  },
]

export default function GroundOpsPanel({ appState }) {
  const [airport, setAirport] = useState('CYYZ')
  const [runway, setRunway]   = useState('06L/24R')
  const [gate, setGate]       = useState('Gate D30')

  const airportData = AIRPORTS_DATA.find(a => a.icao === airport) ?? AIRPORTS_DATA[0]
  const isBlocked = ['AWAITING_CONFIRMATION','EXECUTING','TAKEOFF_ROLL','CLIMBING',
                     'ROTATE','PUSHBACK','TAXI_TO_RUNWAY','LANDING_ROLL','TOUCHDOWN',
                     'FINAL','APPROACH','DESCENDING'].includes(appState)

  const doTakeoff = () => {
    send({ type: 'ground_command', cmd: { type: 'takeoff', runway, airport } })
  }
  const doLand = () => {
    send({ type: 'ground_command', cmd: { type: 'land', runway, airport } })
  }

  return (
    <div className="ground-ops">
      <div className="ground-ops__header">Ground Ops</div>

      <div className="ground-ops__field">
        <label className="ground-ops__label">Airport</label>
        <select
          className="ground-ops__select"
          value={airport}
          onChange={e => {
            setAirport(e.target.value)
            const ap = AIRPORTS_DATA.find(a => a.icao === e.target.value)
            if (ap) { setRunway(ap.runways[0]); setGate(ap.gates[0]) }
          }}
        >
          {AIRPORTS_DATA.map(a => (
            <option key={a.icao} value={a.icao}>{a.icao} — {a.name}</option>
          ))}
        </select>
      </div>

      <div className="ground-ops__field">
        <label className="ground-ops__label">Runway</label>
        <select className="ground-ops__select" value={runway} onChange={e => setRunway(e.target.value)}>
          {airportData.runways.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="ground-ops__field">
        <label className="ground-ops__label">Gate</label>
        <select className="ground-ops__select" value={gate} onChange={e => setGate(e.target.value)}>
          {airportData.gates.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div className="ground-ops__actions">
        <button className="ground-ops__btn ground-ops__btn--takeoff" onClick={doTakeoff} disabled={isBlocked}>
          ↑ Initiate Takeoff
        </button>
        <button className="ground-ops__btn ground-ops__btn--land" onClick={doLand} disabled={isBlocked}>
          ↓ Initiate Landing
        </button>
      </div>
      <div className="ground-ops__note">Requires voice confirm</div>
    </div>
  )
}
