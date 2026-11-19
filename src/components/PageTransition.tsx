import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native'
import { useGlobalSearchParams, usePathname } from 'expo-router'

/** Animate only the route outlet, never the shell. No delayed swaps or snapshots of private pages. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  const route = pathname + JSON.stringify([params.tab, params.view, params.section, params.user])
  const previous = useRef(route)
  const [progress] = useState(() => new Animated.Value(1))
  // Start without motion until the device preference is known.
  const [reduced, setReduced] = useState(true)
  useEffect(() => {
    let alive = true
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value) }).catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => { alive = false; subscription.remove() }
  }, [])
  useLayoutEffect(() => {
    progress.stopAnimation()
    const changed = previous.current !== route
    previous.current = route
    if (reduced || !changed) { progress.setValue(1); return }
    progress.setValue(0)
    const animation = Animated.timing(progress, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false })
    animation.start()
    return () => animation.stop()
  }, [route, reduced, progress])
  return <Animated.View testID="workspace-content" style={{ flex: 1, minHeight: 0, minWidth: 0, opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>{children}</Animated.View>
}
