import type { SessionState } from '../core/auth/controller'

/**
 * Start-up gate (U-031). The native splash stays up only while JM reads what is already on this device (saved theme,
 * cached profile, app-lock setting, cached chat list); it never waits for the network. When it goes, the first frame
 * is the screen the person will use: the cached chat list for a signed-in account with Chats.
 */
export interface StartupFacts {
  /** The saved light/dark choice has been read. */
  theme: boolean
  session: Pick<SessionState, 'status' | 'reading'> & { account: string | null }
  /** The account opens on Chats (JM_ACCESS), so its cached chat list is worth waiting for. */
  messenger: boolean
  /** Account whose app-lock setting has been read. */
  lock: string | null
  /** Account whose app lock is on: its lock cover is the first frame (the screens mount only after unlocking). */
  covered?: string | null
  /** Account whose chat-list cache file has been read. */
  chats: string | null
  /** Current route: `/` is only the redirect to the landing page (Chats), never a screen to show. */
  route: string
}

/** Longest the splash may stay up, whatever is still pending (a stuck file read must not hide the app). */
export const STARTUP_MAX_HOLD_MS = 2500

export function startupReady(f: StartupFacts): boolean {
  if (!f.theme) return false
  const { status, reading, account } = f.session
  // Reading the cached profile is local; a `loading` session without it waits for the server: show the app's own state.
  if (status === 'loading') return !reading
  if (status !== 'ready' || !account) return true
  if (f.lock !== account) return false
  if (f.covered === account) return true
  if (f.route === '/') return false
  return !f.messenger || f.chats === account
}

/** Hides the splash once: when the facts say ready (after the next frame is drawn) or at the time limit. */
export class SplashGate {
  private done = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private frame: (() => void) | null = null
  constructor(private readonly deps: { hide: () => void; nextFrame: (fn: () => void) => () => void; maxHoldMs?: number }) {}
  get hidden() { return this.done }
  start() {
    if (this.done || this.timer !== null) return
    this.timer = setTimeout(() => this.hide(), this.deps.maxHoldMs ?? STARTUP_MAX_HOLD_MS)
  }
  update(ready: boolean) {
    if (this.done) return
    if (!ready) { this.frame?.(); this.frame = null; return }
    // Wait one frame so the screen behind the splash has been drawn with the cached rows.
    if (!this.frame) this.frame = this.deps.nextFrame(() => this.hide())
  }
  hide() {
    if (this.done) return
    this.done = true
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null; this.frame?.(); this.frame = null
    try { this.deps.hide() } catch { /* The splash module may be missing (web, older builds). */ }
  }
}

type Signal = 'lock' | 'covered' | 'chats'
/** What the providers have finished reading, for the splash gate (which sits outside the app-lock subtree). */
export function createStartupSignals() {
  const values: Record<Signal, string | null> = { lock: null, covered: null, chats: null }
  let snapshot = { ...values }
  const listeners = new Set<() => void>()
  return {
    set(key: Signal, account: string | null) {
      if (values[key] === account) return
      values[key] = account; snapshot = { ...values }
      listeners.forEach(fn => fn())
    },
    snapshot: () => snapshot,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
  }
}
export const startupSignals = createStartupSignals()
