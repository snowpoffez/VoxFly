import { EventEmitter } from 'events'

const WARN_MS    = parseInt(process.env.FATIGUE_TIMEOUT_MINUTES ?? '2') * 60 * 1000
const ESCALATE_S = 60 * 1000   // 60s after warning for escalation

export type FatigueLevel = 'warning' | 'escalate'

export class FatigueMonitor extends EventEmitter {
  private warnTimer:     ReturnType<typeof setTimeout> | null = null
  private escalateTimer: ReturnType<typeof setTimeout> | null = null
  private running = false

  start() {
    this.running = true
    this.reset()
  }

  stop() {
    this.running = false
    this.clearTimers()
  }

  reset() {
    if (!this.running) return
    this.clearTimers()
    this.warnTimer = setTimeout(() => {
      this.emit('fatigue', 'warning' as FatigueLevel)
      this.escalateTimer = setTimeout(() => {
        this.emit('fatigue', 'escalate' as FatigueLevel)
      }, ESCALATE_S)
    }, WARN_MS)
  }

  private clearTimers() {
    if (this.warnTimer)    { clearTimeout(this.warnTimer);    this.warnTimer    = null }
    if (this.escalateTimer){ clearTimeout(this.escalateTimer); this.escalateTimer = null }
  }
}
