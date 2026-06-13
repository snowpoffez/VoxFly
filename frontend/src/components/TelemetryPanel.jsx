const STATE_COLOR = {
  IDLE: '#00ff88',
  TURBULENCE_DETECTED: '#ffaa00',
  ANNOUNCING: '#ffaa00',
  AWAITING_CONFIRMATION: '#ff8800',
  EXECUTING: '#ff4444',
  STABILIZED: '#00ff88',
  TIMEOUT: '#888888',
}

function num(v, digits = 1, fallback = '------') {
  return typeof v === 'number' && !Number.isNaN(v) ? v.toFixed(digits) : fallback
}

export default function TelemetryPanel({ flightState, connected }) {
  const { callsign, verticalRate, altitude, velocity, systemState } = flightState

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0,0,20,0.85)',
        color: '#00ffcc',
        fontFamily: 'monospace',
        padding: 16,
        borderRadius: 8,
        border: '1px solid #00ffcc44',
        minWidth: 240,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          marginBottom: 8,
          fontSize: 11,
          opacity: 0.6,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>TELEMETRY</span>
        <span style={{ color: connected ? '#00ff88' : '#ff5555' }}>
          {connected ? '● LINK' : '○ NO LINK'}
        </span>
      </div>
      <div>CALLSIGN: {callsign?.trim() || '------'}</div>
      <div>VERTICAL RATE: {num(verticalRate)} m/s</div>
      <div>ALTITUDE: {num(altitude, 0)} m</div>
      <div>VELOCITY: {num(velocity)} m/s</div>
      <div
        style={{
          marginTop: 12,
          color: STATE_COLOR[systemState] || '#ffffff',
          fontWeight: 'bold',
        }}
      >
        STATE: {systemState}
      </div>
    </div>
  )
}
