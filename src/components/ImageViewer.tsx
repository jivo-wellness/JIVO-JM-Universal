import { useRef, useState } from 'react'
import { Image, PanResponder, View } from 'react-native'
import { ImageZoom, swipeOffset, swipeStep } from '../modules/images/viewer'
import { Label } from '../ui'
export function ImageViewer({ uri, name, previous, next }: { uri: string; name: string; previous?: () => void; next?: () => void }) {
  const [model] = useState(() => new ImageZoom()); const [zoom, setZoom] = useState(model.value)
  const [width, setWidth] = useState(280); const [height, setHeight] = useState(360)
  const [failed, setFailed] = useState(false)
  // Sideways drag at 1x: the picture follows the finger, and letting go past 60px moves to the next/previous item.
  const [drag, setDrag] = useState(0)
  const pinching = useRef(false)
  // U-025: the responder is recreated on every render (each move re-renders), which restarts PanResponder's
  // gestureState, so the swipe is measured from the press position kept here, not from gesture.dx.
  const start = useRef<{ x: number; y: number } | null>(null); const last = useRef({ x: 0, y: 0 })
  /* PanResponder stores these callbacks; refs and the clock are accessed only during gestures. */
 /* eslint-disable react-hooks/refs */
 const swiping = () => !pinching.current && model.value.scale === 1
 const end = () => { const from = start.current; start.current = null; setDrag(0); if (!from || !swiping()) return; const step = swipeStep(last.current.x - from.x, last.current.y - from.y); if (step > 0) next?.(); else if (step < 0) previous?.() }
 const responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.numberActiveTouches > 1 || model.value.scale > 1 || Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: event => { const { pageX, pageY, touches } = event.nativeEvent; pinching.current = touches.length > 1; start.current = { x: pageX, y: pageY }; last.current = { x: pageX, y: pageY }; model.begin(touches) },
    onPanResponderMove: event => {
      const { pageX, pageY, touches } = event.nativeEvent
      if (touches.length > 1) { pinching.current = true; setDrag(0) }
      last.current = { x: pageX, y: pageY }
      if (swiping() && start.current) { setDrag(swipeOffset(pageX - start.current.x, !!previous, !!next)); return }
      setZoom(model.move(touches, width, height))
    },
    onPanResponderRelease: end,
    onPanResponderTerminate: () => { start.current = null; setDrag(0) },
    onPanResponderTerminationRequest: () => false,
  })
 /* eslint-enable react-hooks/refs */
  return <><View accessible accessibilityLabel="Image viewer. Pinch to zoom. Swipe for the next or previous image." accessibilityActions={[{ name: 'increment', label: 'Zoom in' }, { name: 'decrement', label: 'Zoom out' }, ...(next ? [{ name: 'next', label: 'Next image' }] : []), ...(previous ? [{ name: 'previous', label: 'Previous image' }] : [])]} onAccessibilityAction={event => { const action = event.nativeEvent.actionName; if (action === 'increment' || action === 'decrement') setZoom(model.zoom(model.value.scale + (action === 'increment' ? 0.5 : -0.5), width, height)); else if (action === 'next') next?.(); else if (action === 'previous') previous?.() }} onLayout={event => { setWidth(event.nativeEvent.layout.width); setHeight(event.nativeEvent.layout.height) }} {...responder.panHandlers} style={{ width: '100%', flex: 1, overflow: 'hidden', backgroundColor: '#101510' }}>
    <Image accessibilityLabel={name} source={{ uri }} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', height: '100%', transform: [{ translateX: zoom.x + drag }, { translateY: zoom.y }, { scale: zoom.scale }] }} />
  </View>{failed && <Label>The image could not be loaded. Check your connection and reopen it.</Label>}

  </>
}
