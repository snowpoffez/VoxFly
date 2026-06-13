import { useState } from 'react'
import FlightMap from './components/FlightMap'
import TelemetryPanel from './components/TelemetryPanel'
import { useFlightSocket } from './hooks/useFlightSocket'

export default function App() {
  const { flightState, connected } = useFlightSocket()
  const [windOn, setWindOn] = useState(true)

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000010',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Base map + Three.js aircraft overlay + wind */}
      <FlightMap flightState={flightState} windOn={windOn} />

      {/* HUD: live telemetry */}
      <TelemetryPanel flightState={flightState} connected={connected} />

      {/* Wind toggle */}
      <button
        onClick={() => setWindOn((v) => !v)}
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          background: 'rgba(0,0,20,0.85)',
          color: windOn ? '#00ffcc' : '#667',
          border: `1px solid ${windOn ? '#00ffcc44' : '#445'}`,
          padding: '8px 14px',
          borderRadius: 6,
          fontFamily: 'monospace',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        WIND: {windOn ? 'ON' : 'OFF'}
      </button>
    </div>
  )
}
