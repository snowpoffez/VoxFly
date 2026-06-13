import 'dotenv/config'

const ELEVENLABS_KEY   = process.env.ELEVENLABS_API_KEY ?? ''
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID ?? 'pNInz6obpgDQGcFmaJgB'
const ELEVENLABS_MODEL = 'eleven_multilingual_v2'

// Latest audio buffer — served at GET /api/tts/latest
let latestAudio: Buffer | null = null

export function getLatestAudio(): Buffer | null { return latestAudio }

// ── Google Translate (free undocumented endpoint, good for demos) ──────────────
async function translate(text: string, targetLang: string): Promise<string> {
  if (targetLang === 'en') return text
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
    const res  = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return text
    const data = await res.json() as unknown[][]
    // Result structure: [[[translated, original, ...], ...], ...]
    const parts = (data[0] as [string, string][]).map(p => p[0]).join('')
    return parts || text
  } catch {
    return text
  }
}

// ── ElevenLabs TTS ────────────────────────────────────────────────────────────
async function synthesize(text: string): Promise<Buffer | null> {
  if (!ELEVENLABS_KEY) {
    console.warn('[TTS] No ElevenLabs API key — skipping synthesis')
    return null
  }
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}`, {
      method:  'POST',
      headers: {
        'xi-api-key':   ELEVENLABS_KEY,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: { stability: 0.55, similarity_boost: 0.80, style: 0.1, use_speaker_boost: true },
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      console.error('[TTS] ElevenLabs error:', res.status, await res.text())
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    latestAudio = buf
    return buf
  } catch (e) {
    console.error('[TTS] fetch failed:', e)
    return null
  }
}

export async function speak(
  englishText: string,
  lang: string
): Promise<{ english: string; translated: string; hasAudio: boolean }> {
  const translated = await translate(englishText, lang)
  const audio      = await synthesize(translated)
  return { english: englishText, translated, hasAudio: audio !== null }
}
