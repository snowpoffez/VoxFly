// Web Speech API wrapper — push-to-talk mode
let recognition = null
let onResult    = null
let onStart     = null
let onEnd       = null

export function isSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

function createRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  const r = new SR()
  r.continuous     = false
  r.interimResults = false
  r.lang           = 'en-US'
  r.maxAlternatives = 1

  r.onresult = (ev) => {
    const transcript  = ev.results[0][0].transcript
    const confidence  = ev.results[0][0].confidence
    onResult?.({ transcript, confidence })
  }
  r.onstart  = () => onStart?.()
  r.onend    = () => onEnd?.()
  r.onerror  = (ev) => {
    console.warn('[Voice] Speech error:', ev.error)
    onEnd?.()
  }
  return r
}

export function startListening({ onTranscript, onListenStart, onListenEnd } = {}) {
  if (!isSupported()) {
    console.warn('[Voice] Web Speech API not supported')
    return
  }
  onResult = ({ transcript, confidence }) => onTranscript?.(transcript, confidence)
  onStart  = onListenStart
  onEnd    = onListenEnd

  recognition = createRecognition()
  try { recognition.start() } catch { /* already running */ }
}

export function stopListening() {
  try { recognition?.stop() } catch { /* ignore */ }
}
