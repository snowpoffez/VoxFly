import { EventEmitter } from 'events'
import type { AppState } from './types.js'

export class StateMachine extends EventEmitter {
  private _state: AppState = 'IDLE'
  private confirmTimer: ReturnType<typeof setTimeout> | null = null
  private readonly CONFIRM_TIMEOUT = parseInt(process.env.CONFIRMATION_TIMEOUT_SECONDS ?? '8') * 1000

  get state(): AppState { return this._state }

  transition(next: AppState) {
    const prev = this._state
    if (prev === next) return
    this._state = next
    console.log(`[SM] ${prev} → ${next}`)
    this.emit('state', next)

    // Auto-manage confirmation timeout
    if (next === 'AWAITING_CONFIRMATION') {
      this.confirmTimer = setTimeout(() => {
        if (this._state === 'AWAITING_CONFIRMATION') {
          this.emit('confirmation_timeout')
          this.transition('IDLE')
        }
      }, this.CONFIRM_TIMEOUT)
    } else {
      if (this.confirmTimer) { clearTimeout(this.confirmTimer); this.confirmTimer = null }
    }
  }

  isGroundPhase(): boolean {
    return ['PARKED_AT_GATE','PUSHBACK','TAXI_TO_RUNWAY','HOLDING_SHORT',
            'LINEUP_AND_WAIT','TAKEOFF_ROLL','ROTATE','CLIMBING',
            'CRUISE','DESCENDING','APPROACH','FINAL','TOUCHDOWN',
            'LANDING_ROLL','VACATE_RUNWAY','TAXI_TO_GATE'].includes(this._state)
  }
}
