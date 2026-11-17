import { expect, it } from 'vitest'
import { keyboardOverlap, panelHeight } from './keyboardInset'

it('lifts a view by the part the keyboard covers (Android edge-to-edge, composer above the gesture bar)', () => {
  // 800dp window, 24dp navigation inset under the composer, 300dp IME including that inset: 276dp to lift.
  expect(keyboardOverlap({ viewBottom: 776, keyboardTop: 500, keyboardHeight: 276, windowHeight: 800 })).toBe(276)
})
it('lifts by the whole keyboard when the view reaches the window bottom (iOS)', () => {
  expect(keyboardOverlap({ viewBottom: 844, keyboardTop: 508, keyboardHeight: 336, windowHeight: 844 })).toBe(336)
})
it('needs nothing when the window already resized or the keyboard floats above nothing', () => {
  expect(keyboardOverlap({ viewBottom: 500, keyboardTop: 500, keyboardHeight: 276, windowHeight: 800 })).toBe(0)
  expect(keyboardOverlap({ viewBottom: 400, keyboardTop: 500, keyboardHeight: 276, windowHeight: 800 })).toBe(0)
  expect(keyboardOverlap({ viewBottom: 776, keyboardTop: 500, keyboardHeight: 0, windowHeight: 800 })).toBe(0)
  expect(keyboardOverlap({ viewBottom: 0, keyboardTop: 500, keyboardHeight: 276, windowHeight: 800 })).toBe(0)
})
it('falls back to the height when the keyboard top is not reported', () => {
  expect(keyboardOverlap({ viewBottom: 776, keyboardTop: 0, keyboardHeight: 300, windowHeight: 800 })).toBe(276)
})
it('sizes the emoji panel like the last keyboard, or a typical one', () => {
  expect(panelHeight(290, 800)).toBe(290)
  expect(panelHeight(700, 800)).toBe(480)
  expect(panelHeight(0, 720)).toBe(274)
  expect(panelHeight(0, 400)).toBe(220)
  expect(panelHeight(0, 1200)).toBe(320)
})
