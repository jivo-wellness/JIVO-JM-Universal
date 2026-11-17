/**
 * How far the on-screen keyboard reaches over a view, from the keyboard event and the view's window frame.
 *
 * Android 15+ apps are edge-to-edge (Expo SDK 54+), so `adjustResize` no longer shrinks the window: the keyboard
 * draws over the bottom of the layout and the app must lift its own content. React Native reports the keyboard's
 * top edge (`screenY`) in window coordinates on both platforms; when that is missing (0), fall back to its height
 * measured from the window's bottom. A view that already ends above the keyboard (an older Android that still
 * resizes, a floating keyboard) needs nothing.
 */
export function keyboardOverlap({ viewBottom, keyboardTop, keyboardHeight, windowHeight }: { viewBottom: number; keyboardTop: number; keyboardHeight: number; windowHeight: number }): number {
  if (!(keyboardHeight > 0) || !(viewBottom > 0)) return 0
  const overlap = keyboardTop > 0 ? viewBottom - keyboardTop : keyboardHeight - Math.max(0, windowHeight - viewBottom)
  return Math.max(0, Math.min(Math.round(overlap), Math.round(viewBottom)))
}

/** The emoji panel takes the keyboard's place at the keyboard's height; before any keyboard was seen, a typical one. */
export function panelHeight(lastKeyboard: number, windowHeight: number): number {
  if (lastKeyboard >= 160) return Math.round(Math.min(lastKeyboard, windowHeight * 0.6))
  return Math.round(Math.max(220, Math.min(320, windowHeight * 0.38)))
}
