import { afterEach, expect, it, vi } from 'vitest'
import { reconnectWatch } from './reconnectWatch'
afterEach(() => { vi.useRealTimers() })
it('regression: a flapping connection cannot reload a failed screen in a loop (at most one retry per gap)', () => {
  vi.useFakeTimers(); vi.setSystemTime(100_000)
  let status = 'open'; const statusFns = new Set<() => void>(); const retry = vi.fn()
  let last = 0; let stop: () => void = () => {}
  // useReconnectRetry: every retry fails again at once, so the screen starts a new watch with the last retry time.
  const watch = () => { stop = reconnectWatch({ status: () => status, subscribeStatus: fn => { statusFns.add(fn); return () => statusFns.delete(fn) }, subscribeLifecycle: fn => { fn(true); return () => {} },
    lastRetryAt: last, minGapMs: 10_000, retry: () => { last = Date.now(); retry(); watch() } }) }
  watch()
  // The socket reopens every second for a minute.
  for (let i = 0; i < 60; i++) { status = 'reconnecting'; statusFns.forEach(fn => fn()); status = 'open'; statusFns.forEach(fn => fn()); vi.advanceTimersByTime(1_000) }
  expect(retry.mock.calls.length).toBeLessThanOrEqual(7)
  expect(retry.mock.calls.length).toBeGreaterThanOrEqual(5)
  stop()
})
it('a retry delayed by the gap is cancelled when the watch stops', () => {
  vi.useFakeTimers(); vi.setSystemTime(50_000)
  let status = 'reconnecting'; const statusFns = new Set<() => void>(); const retry = vi.fn()
  const stop = reconnectWatch({ status: () => status, subscribeStatus: fn => { statusFns.add(fn); return () => statusFns.delete(fn) }, subscribeLifecycle: () => () => {}, lastRetryAt: 45_000, minGapMs: 10_000, retry })
  status = 'open'; statusFns.forEach(fn => fn()); expect(retry).not.toHaveBeenCalled()
  stop(); vi.advanceTimersByTime(10_000); expect(retry).not.toHaveBeenCalled()
})
function setup(initial = 'reconnecting') {
  let status = initial; const statusFns = new Set<() => void>(); const lifeFns = new Set<(active: boolean) => void>()
  const retry = vi.fn()
  const stop = reconnectWatch({ status: () => status, subscribeStatus: fn => { statusFns.add(fn); return () => statusFns.delete(fn) }, subscribeLifecycle: fn => { lifeFns.add(fn); fn(true); return () => lifeFns.delete(fn) }, retry })
  return { retry, stop, setStatus: (next: string) => { status = next; statusFns.forEach(fn => fn()) }, life: (active: boolean) => lifeFns.forEach(fn => fn(active)), counts: () => statusFns.size + lifeFns.size }
}
it('retries once when the live connection reopens', () => {
  const s = setup(); s.setStatus('connecting'); expect(s.retry).not.toHaveBeenCalled()
  s.setStatus('open'); s.setStatus('reconnecting'); s.setStatus('open')
  expect(s.retry).toHaveBeenCalledOnce(); expect(s.counts()).toBe(0)
})
it('retries when the app comes back to the foreground or online, not on the first report', () => {
  const s = setup('open'); expect(s.retry).not.toHaveBeenCalled()
  s.life(false); s.life(true); expect(s.retry).toHaveBeenCalledOnce()
})
it('stops without retrying', () => {
  const s = setup(); s.stop(); s.setStatus('open'); expect(s.retry).not.toHaveBeenCalled(); expect(s.counts()).toBe(0)
})
