// Arduino two-servo controller
// Servo 1 (pin 9):  yaw   — 0-360° bearing mapped to 0-180° servo
// Servo 2 (pin 10): pitch — -15° to +20° mapped to 60-130° servo

let port: import('serialport').SerialPort | null = null
let sendRaw: ((data: string) => void) | null = null
let heartbeatInterval: ReturnType<typeof setInterval> | null = null

async function tryPort(path: string): Promise<boolean> {
  try {
    const { SerialPort } = await import('serialport')
    const p = new SerialPort({ path, baudRate: 9600, autoOpen: false })
    await new Promise<void>((res, rej) => {
      p.open(err => err ? rej(err) : res())
    })
    port = p
    sendRaw = (data: string) => p.write(data, (e) => { if (e) console.error('[Servo] write error:', e) })
    console.log(`[Servo] Connected on ${path}`)
    return true
  } catch {
    return false
  }
}

export async function initServo(): Promise<void> {
  const portPaths = [
    process.env.ARDUINO_PORT ?? 'COM3',
    '/dev/ttyUSB0',
    '/dev/ttyACM0',
    'COM4',
  ]
  for (const p of portPaths) {
    if (await tryPort(p)) break
  }
  if (!sendRaw) {
    console.warn('[Servo] No Arduino detected — running in simulation mode')
  }

  // Start heartbeat in idle state
  heartbeatInterval = setInterval(() => {
    sendBearing(0, 0)
  }, 2000)
}

export function mapYaw(bearing: number): number {
  return Math.round(((bearing % 360) / 360) * 180)
}

export function mapPitch(pitchDeg: number): number {
  // -15° → 60, 0° → 90, +20° → 130
  const clamped = Math.max(-15, Math.min(20, pitchDeg))
  return Math.round(90 + (clamped / 20) * 40)
}

export function sendBearing(bearing: number, pitchDeg = 0): void {
  if (!sendRaw) return
  const yaw   = mapYaw(bearing)
  const pitch = mapPitch(pitchDeg)
  sendRaw(`YAW:${yaw},PITCH:${pitch}\n`)
}

export function testServo(): { connected: boolean; port: string | null } {
  if (!sendRaw) return { connected: false, port: null }
  sendBearing(90, 0)  // 180° bearing, level
  return { connected: true, port: (port as any)?.path ?? null }
}
