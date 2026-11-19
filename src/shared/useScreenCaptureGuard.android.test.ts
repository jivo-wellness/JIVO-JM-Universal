import { expect, it, vi } from 'vitest'

vi.mock('expo-screen-capture', () => {
  throw new Error('Android must not initialize the screenshot observer')
})

it('can load Android startup and change guard levels without the screenshot module', async () => {
  const { useScreenCaptureGuard } = await import('./useScreenCaptureGuard.android')
  for (const level of [false, 'capture', 'switcher'] as const) {
    expect(() => useScreenCaptureGuard(level)).not.toThrow()
  }
})
