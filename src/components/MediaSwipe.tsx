import { useRef, type ReactNode } from 'react'
import { View, type GestureResponderEvent } from 'react-native'

/** Observe horizontal gestures without taking playback controls away from the video player. */
export function MediaSwipe({ children, previous, next }: { children: ReactNode; previous?: () => void; next?: () => void }) {
  const height = useRef(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const begin = (e: GestureResponderEvent) => { const t = e.nativeEvent; start.current = t.touches.length === 1 && t.locationY < height.current * 0.8 ? { x: t.pageX, y: t.pageY } : null }
  return <View style={{ flex: 1, width: '100%' }} onLayout={e => { height.current = e.nativeEvent.layout.height }} onTouchStart={begin} onTouchCancel={() => { start.current = null }} onTouchEnd={e => {
    const point = start.current; start.current = null; if (!point) return
    const dx = e.nativeEvent.pageX - point.x; const dy = e.nativeEvent.pageY - point.y
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) { if (dx < 0) next?.(); else previous?.() }
  }}>{children}</View>
}
