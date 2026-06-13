// Arduino Stepper Controller Service
let port: import('serialport').SerialPort | null = null;
let sendRaw: ((data: string) => void) | null = null;

const STEPS_PER_REV = 2048;

async function tryPort(path: string): Promise<boolean> {
  try {
    const { SerialPort } = await import('serialport');
    const p = new SerialPort({ path, baudRate: 9600, autoOpen: false });
    
    await new Promise<void>((res, rej) => {
      p.open(err => err ? rej(err) : res());
    });
    
    port = p;
    sendRaw = (data: string) => p.write(data, (e) => { 
      if (e) console.error('[Stepper] Write error:', e); 
    });

    // Read incoming console data back from the Arduino hardware
    p.on('data', (data) => {
      const line = data.toString().trim();
      if (line.startsWith('CONSOLE_BEARING:')) {
        console.log(`[Hardware] ${line}°`);
      }
    });

    console.log(`[Stepper] Connected on ${path}`);
    return true;
  } catch {
    return false;
  }
}

export async function initServo(): Promise<void> {
  // FIXED: Stripped fallback paths so it exclusively targets COM5
  const TargetPort = 'COM5';
  
  if (await tryPort(TargetPort)) {
    return;
  }
  
  if (!sendRaw) {
    console.warn('[Stepper] Target COM5 Arduino not detected — running in simulation mode');
  }
}

export function sendBearing(bearing: number): void {
  if (!sendRaw) return;
  
  // Ensure normalized 0 - 360 compass format
  const normalizedBearing = ((bearing % 360) + 360) % 360;
  
  // Map 0-360 degrees directly to 0-2048 step range
  const targetSteps = Math.round((normalizedBearing / 360) * STEPS_PER_REV);
  
  sendRaw(`STEPS:${targetSteps}\n`);
}

// Keep exported interface compatible with your existing index.ts routing system
export function testServo(): { connected: boolean; port: string | null } {
  if (!sendRaw) return { connected: false, port: null };
  sendBearing(90); // Turn to 90 degrees as a testing state
  return { connected: true, port: (port as any)?.path ?? null };
}