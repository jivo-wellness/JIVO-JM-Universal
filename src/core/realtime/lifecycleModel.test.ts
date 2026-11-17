import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { watchLifecycle } from './lifecycleModel'
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })
function setup(initialNetwork: Promise<boolean> = new Promise(() => {})) {
  let app: (value: boolean) => void = () => {}; let net: (value: boolean) => void = () => {}
  const handler = vi.fn()
  const stop = watchLifecycle({ foreground: true, onForeground: fn => { app = fn; return () => {} }, onNetwork: fn => { net = fn; return () => {} }, initialNetwork: () => initialNetwork }, handler)
  return { handler, stop, app: (v: boolean) => app(v), net: (v: boolean) => net(v) }
}
it('reports once at once and ignores repeated network reports (Android capability changes)', () => {
  const s = setup()
  expect(s.handler.mock.calls).toEqual([[true]])
  for (let i = 0; i < 20; i++) s.net(true)
  s.app(true)
  expect(s.handler).toHaveBeenCalledTimes(1)
})
it('ignores a network hand-over shorter than the grace period', () => {
  const s = setup()
  s.net(false); vi.advanceTimersByTime(2_000); s.net(true); vi.advanceTimersByTime(10_000)
  expect(s.handler.mock.calls).toEqual([[true]])
})
it('reports a lasting network loss after the grace period and the return at once', () => {
  const s = setup()
  s.net(false); s.net(false); vi.advanceTimersByTime(3_000)
  expect(s.handler.mock.calls).toEqual([[true], [false]])
  s.net(true); expect(s.handler.mock.calls).toEqual([[true], [false], [true]])
})
it('reports leaving and returning to the foreground at once', () => {
  const s = setup()
  s.app(false); s.app(true)
  expect(s.handler.mock.calls).toEqual([[true], [false], [true]])
})
it('applies an offline first reading at once and stops after unsubscribe', async () => {
  const s = setup(Promise.resolve(false))
  await Promise.resolve(); await Promise.resolve()
  expect(s.handler.mock.calls).toEqual([[true], [false]])
  s.stop(); s.net(true); expect(s.handler).toHaveBeenCalledTimes(2)
})
