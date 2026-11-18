import { useEffect, useRef, useState } from 'react'
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
  const latest = useRef({ previous, next, width, height })
  useEffect(() => { latest.current = { previous, next, width, height } }, [previous, next, width, height])
  // Keep one responder for the lifetime of this image, including live chat updates.
  // PanResponder stores callbacks; refs are read only when a touch event fires.
  /* eslint-disable react-hooks/refs */
  const [responder] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => { pinching.current = event.nativeEvent.touches.length > 1; model.begin(event.nativeEvent.touches) },
    onPanResponderMove: (event, gesture) => {
      const { touches } = event.nativeEvent
      if (touches.length > 1) { pinching.current = true; setDrag(0) }
      const current = latest.current
      if (!pinching.current && model.value.scale === 1) { setDrag(swipeOffset(gesture.dx, !!current.previous, !!current.next)); return }
      setZoom(model.move(touches, current.width, current.height))
    },
    onPanResponderRelease: (_event, gesture) => {
      setDrag(0)
      if (pinching.current || model.value.scale !== 1) return
      const step = swipeStep(gesture.dx, gesture.dy)
      if (step > 0) latest.current.next?.(); else if (step < 0) latest.current.previous?.()
    },
    onPanResponderTerminate: () => setDrag(0),
    onPanResponderTerminationRequest: () => false,
  }))
  /* eslint-enable react-hooks/refs */
  return <><View accessible accessibilityLabel="Image viewer. Pinch to zoom. Swipe for the next or previous image." accessibilityActions={[{ name: 'increment', label: 'Zoom in' }, { name: 'decrement', label: 'Zoom out' }, ...(next ? [{ name: 'next', label: 'Next image' }] : []), ...(previous ? [{ name: 'previous', label: 'Previous image' }] : [])]} onAccessibilityAction={event => { const action = event.nativeEvent.actionName; if (action === 'increment' || action === 'decrement') setZoom(model.zoom(model.value.scale + (action === 'increment' ? 0.5 : -0.5), width, height)); else if (action === 'next') next?.(); else if (action === 'previous') previous?.() }} onLayout={event => { setWidth(event.nativeEvent.layout.width); setHeight(event.nativeEvent.layout.height) }} {...responder.panHandlers} style={{ width: '100%', flex: 1, overflow: 'hidden', backgroundColor: '#101510' }}>
    <Image pointerEvents="none" accessibilityLabel={name} source={{ uri }} onError={() => setFailed(true)} resizeMode="contain" style={{ width: '100%', height: '100%', transform: [{ translateX: zoom.x + drag }, { translateY: zoom.y }, { scale: zoom.scale }] }} />
  </View>{failed && <Label>The image could not be loaded. Check your connection and reopen it.</Label>}

  </>
}
