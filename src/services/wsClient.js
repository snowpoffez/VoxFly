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

// ── TTS audio management ──────────────────────────────────────────────────────
// Single-flight playback: only the most recent tts_ready ever reaches .play(),
// and at most one Audio element can exist. A monotonic token invalidates any
// handler whose async work was superseded by a newer event, so overlapping
// fetches can never double-play the same clip.
let currentAudio = null
let pttActive    = false   // when true, suppress all incoming TTS
let playToken    = 0       // bumped on every stop/new request

export function setPTTActive(active) {
  pttActive = active
  if (active) stopAudio()
}

export function stopAudio() {
  playToken++                       // invalidate any in-flight playback
  if (currentAudio) {
    currentAudio.onended = null
    currentAudio.pause()
    try { currentAudio.currentTime = 0 } catch { /* not seekable yet */ }
    currentAudio.src = ''
    currentAudio = null
  }
}

on('tts_ready', async () => {
  if (pttActive) return             // PTT held — don't start new audio
  stopAudio()                       // kill anything playing; bumps playToken
  const myToken = playToken         // claim this generation

  try {
    const res = await fetch(`http://${window.location.hostname}:3001/api/tts/latest`)
    if (myToken !== playToken) return            // superseded during fetch
    if (!res.ok || res.status === 204) return
    const blob = await res.blob()
    if (myToken !== playToken) return            // superseded during blob read

    const url   = URL.createObjectURL(blob)
    const audio = new Audio(url)
    currentAudio = audio
    audio.onended = () => { URL.revokeObjectURL(url); if (currentAudio === audio) currentAudio = null }
    await audio.play()
  } catch { /* no audio key or network issue */ }
})

connect()
