import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionStatus } from '../core/realtime/client'
import { ConnectionBanner, initialBanner, stepBanner } from './connectionBanner'

describe('stepBanner', () => {
  it('shows nothing for a blip shorter than 4 s and no Connected afterwards', () => {
    let s = initialBanner
    let r = stepBanner(s, { status: 'reconnecting', networkError: false }, 0); s = r.state
    expect(r.view).toBe('none'); expect(r.wakeAt).toBe(4_000)
    r = stepBanner(s, { status: 'open', networkError: false }, 3_000)
    expect(r.view).toBe('none'); expect(r.wakeAt).toBeNull()
  })
  it('shows Reconnecting after 4 s, keeps it through connecting attempts, then Connected for 2.5 s', () => {
    let s = stepBanner(initialBanner, { status: 'reconnecting', networkError: false }, 0).state
    let r = stepBanner(s, { status: 'reconnecting', networkError: false }, 4_000); s = r.state
    expect(r.view).toBe('reconnecting')
    r = stepBanner(s, { status: 'connecting', networkError: false }, 6_000); s = r.state
    expect(r.view).toBe('reconnecting')
    r = stepBanner(s, { status: 'open', networkError: false }, 8_000); s = r.state
    expect(r.view).toBe('connected'); expect(r.wakeAt).toBe(10_500)
    expect(stepBanner(s, { status: 'open', networkError: false }, 10_500).view).toBe('none')
  })
  it('shows the offline sentence and a screen network error only once they last', () => {
    expect(stepBanner(initialBanner, { status: 'offline', networkError: false }, 0).view).toBe('none')
    const s = stepBanner(initialBanner, { status: 'open', networkError: true }, 0).state
    expect(stepBanner(s, { status: 'open', networkError: true }, 4_000).view).toBe('network')
    expect(stepBanner({ since: 0, outage: false, connectedUntil: 0 }, { status: 'offline', networkError: false }, 5_000).view).toBe('offline')
  })
  it('does not say Connected when an outage ends with sign-out', () => {
    const s = stepBanner({ since: 0, outage: false, connectedUntil: 0 }, { status: 'reconnecting', networkError: false }, 5_000).state
    expect(stepBanner(s, { status: 'stopped', networkError: false }, 6_000).view).toBe('none')
  })
})

describe('ConnectionBanner', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  function setup(initial: ConnectionStatus = 'open') {
    let status = initial; const fns = new Set<() => void>()
    const banner = new ConnectionBanner({ snapshot: () => status, subscribe: fn => { fns.add(fn); return () => fns.delete(fn) } })
    const seen: string[] = []; const off = banner.subscribe(() => seen.push(banner.view()))
    return { banner, seen, off, set: (next: ConnectionStatus) => { status = next; fns.forEach(fn => fn()) }, listeners: () => fns.size }
  }
  it('a flapping socket (open/reconnecting every 2 s) never shows the pill', () => {
    const s = setup()
    for (let i = 0; i < 10; i++) { s.set('reconnecting'); vi.advanceTimersByTime(2_000); s.set('open'); vi.advanceTimersByTime(2_000) }
    expect(s.seen).toEqual([])
  })
  it('a real outage shows Reconnecting on its own timer, then Connected, then nothing', () => {
    const s = setup()
    s.set('reconnecting'); vi.advanceTimersByTime(3_999); expect(s.banner.view()).toBe('none')
    vi.advanceTimersByTime(1); expect(s.banner.view()).toBe('reconnecting')
    s.set('open'); expect(s.banner.view()).toBe('connected')
    vi.advanceTimersByTime(2_500); expect(s.seen).toEqual(['reconnecting', 'connected', 'none'])
  })
  it('a screen error that clears before 4 s shows nothing; unsubscribing releases the socket listener', () => {
    const s = setup()
    s.banner.setNetworkError(true); vi.advanceTimersByTime(1_000); s.banner.setNetworkError(false); vi.advanceTimersByTime(10_000)
    expect(s.seen).toEqual([])
    s.off(); expect(s.listeners()).toBe(0)
  })
})
