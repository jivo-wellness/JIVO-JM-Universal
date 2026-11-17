import { expect, it } from 'vitest'
import { micMove, micRelease } from './voiceGesture'

it('slides left to cancel and up to lock', () => {
  expect(micMove(-20, -10)).toBeNull()
  expect(micMove(-91, 0)).toBe('cancel')
  expect(micMove(0, -71)).toBe('lock')
  expect(micMove(-120, -120)).toBe('cancel')
  expect(micMove(40, 30)).toBeNull()
})
it('release stops for review after a hold, keeps recording after a tap, a lock or a permission prompt', () => {
  expect(micRelease(1200, 'recording', false)).toBe('review')
  expect(micRelease(150, 'recording', false)).toBe('keep')
  expect(micRelease(3000, 'recording', true)).toBe('keep')
  expect(micRelease(3000, 'preparing', false)).toBe('keep')
  expect(micRelease(3000, 'idle', false)).toBe('none')
  expect(micRelease(3000, 'review', false)).toBe('none')
})
