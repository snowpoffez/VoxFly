import { useGlobeStore } from '../store/useFlightStore'

export function HUD() {
  const planes = useGlobeStore((s) => s.planes)

  return (
    <div style={styles.container}>
      <div style={styles.title}>VoxFly</div>
      <div style={styles.subtitle}>Global Flight Tracker</div>
      <div style={styles.count}>{planes.length} flights tracked</div>
      <div style={styles.list}>
        {planes.map((p) => (
          <div key={p.id} style={styles.row}>
            <span style={{ ...styles.dot, background: p.color }} />
            <span style={styles.flight}>{p.flightNumber}</span>
            <span style={styles.route}>{p.origin} &rarr; {p.destination}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 16,
    left: 16,
    color: '#c0d0ff',
    fontFamily: 'monospace',
    fontSize: 13,
    userSelect: 'none',
    pointerEvents: 'none',
    zIndex: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 12,
  },
  count: {
    fontSize: 11,
    opacity: 0.6,
    marginBottom: 8,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  flight: {
    fontWeight: 'bold',
    color: '#ffffff',
    width: 50,
    flexShrink: 0,
  },
  route: {
    opacity: 0.7,
    fontSize: 11,
  },
}
