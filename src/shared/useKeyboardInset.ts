import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react'
import { Dimensions, Keyboard, LayoutAnimation, Platform, type KeyboardEvent, type View } from 'react-native'
import { keyboardOverlap } from './keyboardInset'

/** Last keyboard overlap seen on this device, so the emoji panel can open at the same height. */
let lastKeyboard = 0
export const lastKeyboardHeight = () => lastKeyboard

/**
 * Bottom space a view needs so its content sits directly above the on-screen keyboard (WhatsApp-style), measured
 * against the view's own window frame. Used instead of KeyboardAvoidingView, whose parent-relative frame is wrong
 * when the view is nested under headers and safe-area padding, and instead of `adjustResize`, which edge-to-edge
 * Android (SDK 54+) no longer applies. iOS follows the keyboard's own animation; Android reports after it opens.
 * Web: the browser resizes the visual viewport itself, so this stays 0.
 */
export function useKeyboardInset(ref: RefObject<ComponentRef<typeof View> | null>): number {
  const [inset, setInset] = useState(0)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    if (Platform.OS === 'web') return
    const ios = Platform.OS === 'ios'
    const show = (event: KeyboardEvent) => {
      const { screenY, height } = event.endCoordinates
      const apply = (value: number) => {
        if (!live.current) return
        if (value > 0) lastKeyboard = value
        if (ios && event.duration) LayoutAnimation.configureNext({ duration: Math.max(event.duration, 10), update: { duration: Math.max(event.duration, 10), type: LayoutAnimation.Types[event.easing] ?? 'keyboard' } })
        setInset(value)
      }
      const node = ref.current
      if (!node) { apply(Math.max(0, height)); return }
      node.measureInWindow((_x: number, y: number, _width: number, viewHeight: number) => apply(keyboardOverlap({ viewBottom: y + viewHeight, keyboardTop: screenY, keyboardHeight: height, windowHeight: Dimensions.get('window').height })))
    }
    const hide = (event?: KeyboardEvent) => {
      if (ios && event?.duration) LayoutAnimation.configureNext({ duration: Math.max(event.duration, 10), update: { duration: Math.max(event.duration, 10), type: LayoutAnimation.Types[event.easing] ?? 'keyboard' } })
      setInset(0)
    }
    const subscriptions = ios
      ? [Keyboard.addListener('keyboardWillShow', show), Keyboard.addListener('keyboardWillChangeFrame', event => { if (event.endCoordinates.height > 0 && Keyboard.isVisible()) show(event) }), Keyboard.addListener('keyboardWillHide', hide)]
      : [Keyboard.addListener('keyboardDidShow', show), Keyboard.addListener('keyboardDidHide', hide)]
    // Opened with the keyboard already up (e.g. returning to the chat): measure once.
    const metrics = Keyboard.metrics()
    if (Keyboard.isVisible() && metrics) show({ endCoordinates: metrics, startCoordinates: metrics, duration: 0, easing: 'keyboard', isEventFromThisApp: true } as KeyboardEvent)
    return () => { live.current = false; subscriptions.forEach(s => s.remove()) }
  }, [ref])
  return inset
}
