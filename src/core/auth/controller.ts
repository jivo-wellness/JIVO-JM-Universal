import type { Me } from './types'
import type { LoginResponse } from './security'
/**
 * `stale`: `me` is this device's last confirmed profile (U-022), shown while the server is asked; `error` then says why it is not confirmed yet.
 * `reading`: still `loading` the profile cached on this device (local and fast: the start-up splash covers it, U-031);
 * a `loading` state without it is waiting for the server.
 */
export type SessionState = { status: 'loading' | 'signing-out' | 'anonymous' | 'ready' | 'unreachable'; me: Me | null; error?: string; stale?: boolean; reading?: boolean }
/** The last confirmed profile, kept on this device so start-up does not wait for the network. */
export interface SessionCache { read(): Promise<Me | null>; write(me: Me): Promise<void>; clear(): Promise<void> }
export interface SessionDependencies {
  enabled: boolean; csrf: () => Promise<unknown>; me: () => Promise<Me>
  login: (email: string, password: string) => Promise<LoginResponse>
  logout: () => Promise<unknown>; clear: () => Promise<unknown>
  unauthorized: (error: unknown) => boolean; message: (error: unknown) => string
  boundary?: (preserveOutbox: boolean) => void
  now?: () => number
  cache?: SessionCache
}
export class SessionController {
  private state: SessionState = { status: 'loading', me: null }
  private listeners = new Set<() => void>()
  private generation = 0
  private signingOut: Promise<void> | null = null
  private cleanup: Promise<unknown> = Promise.resolve()
  private expiryTimer: ReturnType<typeof setTimeout> | null = null
  constructor(private readonly deps: SessionDependencies) {}
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private now() { return this.deps.now?.() ?? Date.now() }
  private expiry(me: Me | null): number | null { return me?.session ? Date.parse(me.session.expires_at) : null }
  private cancelExpiry() { if (this.expiryTimer !== null) clearTimeout(this.expiryTimer); this.expiryTimer = null }
  private scheduleExpiry() {
    this.cancelExpiry()
    const expiry = this.expiry(this.state.me)
    if (this.state.status !== 'ready' || expiry === null) return
    // Recheck wall-clock changes, and never exceed the platform timeout range.
    this.expiryTimer = setTimeout(() => { this.expiryTimer = null; this.checkExpiry() }, Math.max(0, Math.min(60_000, expiry - this.now())))
    // Node-based tests/tooling must not be kept alive by a UI lifecycle timer.
    const timer = this.expiryTimer as ReturnType<typeof setTimeout> & { unref?: () => void }
    timer.unref?.()
  }
  private publish(state: SessionState) { this.cancelExpiry(); this.state = state; this.scheduleExpiry(); this.listeners.forEach(fn => fn()) }
  private expired(me: Me) { const expiry = this.expiry(me); return expiry !== null && (!Number.isFinite(expiry) || expiry <= this.now()) }
  private accept(me: Me) {
    if (this.expired(me)) { this.lose(); return }
    // The server answered for a different account than the cached one: end everything bound to the cached account first.
    if (this.state.stale && this.state.me && this.state.me.id !== me.id) this.advance()
    this.publish({ status: 'ready', me })
    void this.deps.cache?.write(me).catch(() => undefined)
  }
  private forget() { void this.deps.cache?.clear().catch(() => undefined) }
  /** Call on foreground too: mobile/hidden-tab timers may have been suspended. */
  checkExpiry = (): boolean => {
    if (this.state.status !== 'ready') return false
    const expiry = this.expiry(this.state.me)
    if (expiry !== null && (!Number.isFinite(expiry) || expiry <= this.now())) { this.lose(); return false }
    this.scheduleExpiry()
    return true
  }
  /** Provider cleanup; a subsequent restore can reuse the controller in StrictMode. */
  dispose = () => { this.generation++; this.cancelExpiry() }
  private advance(preserveOutbox = false) { this.cancelExpiry(); this.deps.boundary?.(preserveOutbox); return ++this.generation }
  lose = () => {
    if (this.signingOut) return
    this.forget()
    this.advance(); this.publish({ status: 'anonymous', me: null })
    this.cleanup = this.cleanup.catch(() => undefined).then(() => this.deps.clear())
    void this.cleanup.catch(() => undefined)
  }
  /**
   * Start-up and Retry. With a cached profile the app opens at once (`ready`, `stale`) and the server is asked in the
   * background: 401 signs out and wipes the device caches, unreachable keeps the cached screens with `error` set.
   */
  async restore() {
    if (this.signingOut) return
    // Already showing the cached account: only ask the server again, keep everything bound to it.
    if (this.state.status === 'ready' && this.state.stale) return this.confirm(this.generation)
    const generation = this.advance(true)
    if (!this.deps.enabled) { this.publish({ status: 'anonymous', me: null }); return }
    this.publish(this.deps.cache ? { status: 'loading', me: null, reading: true } : { status: 'loading', me: null })
    let cached: Me | null = null
    try { cached = await this.deps.cache?.read() ?? null } catch { cached = null }
    if (generation !== this.generation) return
    if (cached && !this.expired(cached)) this.publish({ status: 'ready', me: cached, stale: true })
    else {
      if (cached) this.forget()
      if (this.deps.cache) this.publish({ status: 'loading', me: null })
    }
    return this.confirm(generation)
  }
  private async confirm(generation: number) {
    // Clearing the previous failure lets the provider's reconnect watch start again after the next one.
    if (this.state.stale && this.state.error) { const next = { ...this.state }; delete next.error; this.publish(next) }
    try {
      await this.cleanup
      await this.deps.csrf()
      const me = await this.deps.me()
      if (generation === this.generation) this.accept(me)
    } catch (error) {
      if (generation !== this.generation) return
      if (this.deps.unauthorized(error)) this.lose()
      else if (this.state.status === 'ready' && this.state.stale) this.publish({ ...this.state, error: this.deps.message(error) })
      else this.publish({ status: 'unreachable', me: null, error: this.deps.message(error) })
    }
  }
  async adopt() {
    const generation = this.generation
    const me = await this.deps.me()
    if (generation === this.generation && !this.signingOut) this.accept(me)
  }
  async login(email: string, password: string) {
    // New authentication must not race a previous session's cookie cleanup.
    await this.signingOut?.catch(() => undefined)
    await this.cleanup
    const generation = this.advance()
    await this.deps.csrf()
    if (generation !== this.generation) throw new Error('Sign-in was cancelled.')
    const result = await this.deps.login(email, password)
    if (generation !== this.generation) throw new Error('Sign-in was cancelled.')
    if (result.status === 'ok') await this.adopt()
    return result
  }
  logout(): Promise<void> {
    if (this.signingOut) return this.signingOut
    const generation = this.advance()
    this.forget()
    this.publish({ status: 'signing-out', me: null })
    const pending = (async () => {
      let failure: unknown
      try { await this.deps.logout() } catch (error) { failure = error }
      this.cleanup = this.cleanup.catch(() => undefined).then(() => this.deps.clear())
      try { await this.cleanup } catch (error) { failure ??= error }
      if (generation === this.generation) this.publish({ status: 'anonymous', me: null, ...(failure ? { error: 'Signed out locally. Server revocation or device-cookie cleanup could not be confirmed. Retry when connected.' } : {}) })
      if (failure) throw failure
    })()
    this.signingOut = pending
    void pending.finally(() => { if (this.signingOut === pending) this.signingOut = null }).catch(() => undefined)
    return pending
  }
}
