import type { ConnectionStatus } from '../core/realtime/client'

/**
 * Reference core/pwa/ConnectionBanner as a state machine with hysteresis, so the pill follows real outages only:
 * - trouble (socket connecting / reconnecting / offline, or a screen's "Cannot reach JM") shows after it has lasted
 *   SHOW_AFTER_MS; a blip that recovers sooner shows nothing at all;
 * - once shown, the pill stays until the socket is open again and the screen error is gone;
 * - "Connected" shows for CONNECTED_FOR_MS only after an outage that was shown.
 */
export type BannerView = 'none' | 'reconnecting' | 'offline' | 'network' | 'connected'
export interface BannerInput { status: ConnectionStatus; networkError: boolean }
export interface BannerState { since: number | null; outage: boolean; connectedUntil: number }
export const SHOW_AFTER_MS = 4_000
export const CONNECTED_FOR_MS = 2_500
export const initialBanner: BannerState = { since: null, outage: false, connectedUntil: 0 }

const waiting = (status: ConnectionStatus) => status === 'connecting' || status === 'reconnecting'

/** One step: the next state, what to show, and when to look again (null: only on the next input). */
export function stepBanner(state: BannerState, input: BannerInput, now: number): { state: BannerState; view: BannerView; wakeAt: number | null } {
  const trouble = input.status === 'offline' || waiting(input.status) || input.networkError
  if (trouble) {
    const since = state.since ?? now
    const outage = state.outage || now - since >= SHOW_AFTER_MS
    const next = { since, outage, connectedUntil: 0 }
    if (!outage) return { state: next, view: 'none', wakeAt: since + SHOW_AFTER_MS }
    return { state: next, view: input.status === 'offline' ? 'offline' : input.networkError && !waiting(input.status) ? 'network' : 'reconnecting', wakeAt: null }
  }
  // Recovered. Only a shown outage that ends with an open socket earns "Connected" (not a sign-out or a refusal).
  const connectedUntil = state.outage && input.status === 'open' ? now + CONNECTED_FOR_MS : state.connectedUntil
  const next = { since: null, outage: false, connectedUntil }
  return connectedUntil > now ? { state: next, view: 'connected', wakeAt: connectedUntil } : { state: next, view: 'none', wakeAt: null }
}

/**
 * The machine with its clock: subscribes to the realtime status while the pill is mounted and re-evaluates on every
 * status change, `setNetworkError` and the machine's own wake-up time.
 */
export class ConnectionBanner {
  private state = initialBanner
  private current: BannerView = 'none'
  private networkError = false
  private timer: unknown = null
  private off: (() => void) | null = null
  private listeners = new Set<() => void>()
  constructor(private readonly source: { snapshot: () => ConnectionStatus; subscribe: (fn: () => void) => () => void },
    private readonly clock: { now: () => number; schedule: (run: () => void, ms: number) => unknown; cancel: (timer: unknown) => void } = { now: Date.now, schedule: (run, ms) => setTimeout(run, ms), cancel: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) }) {}
  view = () => this.current
  status = () => this.source.snapshot()
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (!this.off) { this.off = this.source.subscribe(this.evaluate); this.evaluate() }
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size || !this.off) return
      this.off(); this.off = null
      if (this.timer !== null) this.clock.cancel(this.timer)
      this.timer = null
    }
  }
  setNetworkError(value: boolean) { if (this.networkError === value) return; this.networkError = value; this.evaluate() }
  evaluate = () => {
    if (this.timer !== null) this.clock.cancel(this.timer)
    this.timer = null
    const now = this.clock.now()
    const step = stepBanner(this.state, { status: this.source.snapshot(), networkError: this.networkError }, now)
    this.state = step.state
    if (step.wakeAt !== null && this.off) this.timer = this.clock.schedule(() => { this.timer = null; this.evaluate() }, Math.max(0, step.wakeAt - now))
    if (step.view !== this.current) { this.current = step.view; this.listeners.forEach(fn => fn()) }
  }
}
