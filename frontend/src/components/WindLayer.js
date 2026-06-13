// Animated gray wind lines on a screen-space canvas overlaid on the map.
// Particles flow along the live wind field (Open-Meteo) and leave short fading
// trails, so the wind reads as moving. Each particle is unprojected to lat/lon
// every step, so the flow stays geographically correct as the map pans/zooms.

import { sampleWind, loadWindField } from '../utils/windData'

const PARTICLE_COUNT = 650
const MAX_AGE = 90 // frames before a particle respawns
const FADE = 0.12 // how quickly trails fade out (higher = shorter trails)
const REFRESH_MS = 15 * 60 * 1000 // re-fetch the wind field every 15 minutes
// Map wind speed (m/s) → screen pixels/frame, clamped so it's always visible
// but stronger wind visibly moves faster.
const PX_PER_MS = 0.22
const MIN_SPEED = 0.35
const MAX_SPEED = 3.0

export function createWindOverlay(map) {
  const container = map.getContainer()

  // Kick off the live wind fetch and keep it fresh.
  loadWindField()
  const refresh = setInterval(loadWindField, REFRESH_MS)

  const canvas = document.createElement('canvas')
  Object.assign(canvas.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '1',
  })
  container.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1

  let width = 0
  let height = 0

  function resize() {
    const r = container.getBoundingClientRect()
    width = r.width
    height = r.height
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  map.on('resize', resize)

  function spawn(p) {
    p.x = Math.random() * width
    p.y = Math.random() * height
    p.age = Math.random() * MAX_AGE
    return p
  }
  const particles = Array.from({ length: PARTICLE_COUNT }, () => spawn({}))

  let raf = null

  function frame() {
    // Fade existing trails toward transparent (no darkening of the map).
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = `rgba(0,0,0,${FADE})`
    ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'source-over'

    // Dim blue-gray so it reads as background, not in-your-face white.
    ctx.strokeStyle = 'rgba(120,128,140,0.32)'
    ctx.lineWidth = 1
    ctx.lineCap = 'round'

    for (const p of particles) {
      const ll = map.unproject([p.x, p.y])
      const [u, v] = sampleWind(ll.lat, ll.lng)
      const mag = Math.hypot(u, v) || 1e-6
      const speed = Math.min(Math.max(mag * PX_PER_MS, MIN_SPEED), MAX_SPEED)
      const dx = (u / mag) * speed
      const dy = (-v / mag) * speed // screen Y is inverted (north = up)

      const nx = p.x + dx
      const ny = p.y + dy

      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(nx, ny)
      ctx.stroke()

      p.x = nx
      p.y = ny
      p.age -= 1
      if (p.age <= 0 || nx < 0 || nx > width || ny < 0 || ny > height) {
        spawn(p)
      }
    }

    raf = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (!raf) frame()
    },
    // Toggle on/off without tearing the overlay down. Clears trails when off.
    setEnabled(on) {
      if (on) {
        if (!raf) frame()
      } else {
        if (raf) cancelAnimationFrame(raf)
        raf = null
        ctx.clearRect(0, 0, width, height)
      }
    },
    stop() {
      if (raf) cancelAnimationFrame(raf)
      raf = null
      clearInterval(refresh)
      map.off('resize', resize)
      canvas.remove()
    },
  }
}
