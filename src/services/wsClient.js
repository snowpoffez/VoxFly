// WebSocket client — singleton, auto-reconnects
const LISTENERS = new Map()
let ws = null
let reconnectTimer = null

function connect() {
  const url = `ws://${window.location.hostname}:3001`
  try {
    ws = new WebSocket(url)
  } catch {
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    console.log('[WS] Connected to AeroVox backend')
    clearTimeout(reconnectTimer)
    emit('_connected', null)
  }

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data)
      emit(msg.type, msg)
    } catch { /* ignore */ }
  }

  ws.onclose = () => {
    emit('_disconnected', null)
    scheduleReconnect()
  }

  ws.onerror = () => {
    ws?.close()
  }
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(connect, 3000)
}

function emit(type, data) {
  const handlers = LISTENERS.get(type) ?? []
  handlers.forEach(fn => fn(data))
}

export function on(type, fn) {
  if (!LISTENERS.has(type)) LISTENERS.set(type, [])
  LISTENERS.get(type).push(fn)
  return () => {
    const arr = LISTENERS.get(type) ?? []
    const idx = arr.indexOf(fn)
    if (idx >= 0) arr.splice(idx, 1)
  }
}

export function send(msg) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

export function isConnected() {
  return ws?.readyState === WebSocket.OPEN
}

// Auto-play TTS audio when server signals it's ready
on('tts_ready', async () => {
  try {
    const res = await fetch(`http://${window.location.hostname}:3001/api/tts/latest`)
    if (!res.ok || res.status === 204) return
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    await audio.play()
  } catch { /* no audio key or network issue */ }
})

connect()
