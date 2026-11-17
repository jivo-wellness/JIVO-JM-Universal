import { afterEach, describe, expect, it, vi } from 'vitest'
import { SplashGate, STARTUP_MAX_HOLD_MS, createStartupSignals, startupReady, type StartupFacts } from './startup'

const signedIn: StartupFacts = { theme: true, session: { status: 'ready', reading: undefined, account: 'me' }, messenger: true, lock: 'me', covered: null, chats: 'me', route: '/messenger' }
const facts = (patch: Partial<StartupFacts> & { session?: Partial<StartupFacts['session']> } = {}): StartupFacts => ({ ...signedIn, ...patch, session: { ...signedIn.session, ...patch.session } })

describe('startupReady (U-031)', () => {
  it('opens on the cached chat list once every local read is done', () => {
    expect(startupReady(facts())).toBe(true)
  })
  it('holds while the saved theme, cached profile, app-lock setting or chat cache are still being read', () => {
    expect(startupReady(facts({ theme: false }))).toBe(false)
    expect(startupReady(facts({ session: { status: 'loading', reading: true, account: null } }))).toBe(false)
    expect(startupReady(facts({ lock: null }))).toBe(false)
    expect(startupReady(facts({ lock: 'someone-else' }))).toBe(false)
    expect(startupReady(facts({ chats: null }))).toBe(false)
    expect(startupReady(facts({ chats: 'someone-else' }))).toBe(false)
  })
  it('holds on the "/" redirect so the first frame is Chats, not an empty page', () => {
    expect(startupReady(facts({ route: '/' }))).toBe(false)
  })
  it('never waits for the network', () => {
    // No cached profile: the session is asking the server. The app shows its own state (sign-in or the retry card).
    expect(startupReady(facts({ session: { status: 'loading', reading: false, account: null }, lock: null, chats: null }))).toBe(true)
    expect(startupReady(facts({ session: { status: 'unreachable', account: null }, lock: null, chats: null }))).toBe(true)
    expect(startupReady(facts({ session: { status: 'anonymous', account: null }, lock: null, chats: null, route: '/' }))).toBe(true)
  })
  it('does not wait for a chat cache the account cannot use', () => {
    expect(startupReady(facts({ messenger: false, chats: null, route: '/home' }))).toBe(true)
  })
  it('shows the lock cover at once when app lock is on', () => {
    expect(startupReady(facts({ covered: 'me', chats: null, route: '/' }))).toBe(true)
  })
})

describe('SplashGate', () => {
  afterEach(() => { vi.useRealTimers() })
  const setup = () => {
    const frames: (() => void)[] = []
    const hide = vi.fn()
    const gate = new SplashGate({ hide, nextFrame: fn => { frames.push(fn); return () => { const i = frames.indexOf(fn); if (i >= 0) frames.splice(i, 1) } } })
    return { gate, hide, frames }
  }
  it('hides one frame after ready, once', () => {
    const { gate, hide, frames } = setup()
    gate.update(false); expect(frames).toHaveLength(0)
    gate.update(true); gate.update(true); expect(frames).toHaveLength(1); expect(hide).not.toHaveBeenCalled()
    frames.shift()!(); expect(hide).toHaveBeenCalledTimes(1); expect(gate.hidden).toBe(true)
    gate.update(false); gate.update(true); expect(frames).toHaveLength(0); expect(hide).toHaveBeenCalledTimes(1)
  })
  it('cancels the pending frame when readiness is lost', () => {
    const { gate, hide, frames } = setup()
    gate.update(true); gate.update(false); expect(frames).toHaveLength(0); expect(hide).not.toHaveBeenCalled()
  })
  it('hides at the time limit when a local read never finishes', () => {
    vi.useFakeTimers()
    const { gate, hide } = setup()
    gate.start(); gate.update(false)
    vi.advanceTimersByTime(STARTUP_MAX_HOLD_MS - 1); expect(hide).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(hide).toHaveBeenCalledTimes(1)
  })
  it('survives a missing splash module', () => {
    const gate = new SplashGate({ hide: () => { throw new Error('ExpoSplashScreen missing') }, nextFrame: fn => { fn(); return () => {} } })
    expect(() => gate.update(true)).not.toThrow(); expect(gate.hidden).toBe(true)
  })
})

describe('startup signals', () => {
  it('notifies only on change', () => {
    const signals = createStartupSignals(); const fn = vi.fn(); signals.subscribe(fn)
    signals.set('chats', 'me'); signals.set('chats', 'me'); signals.set('lock', 'me')
    expect(fn).toHaveBeenCalledTimes(2); expect(signals.snapshot()).toEqual({ lock: 'me', covered: null, chats: 'me' })
  })
})
