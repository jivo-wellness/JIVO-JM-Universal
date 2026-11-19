import { useEffect, useState, type ReactNode } from 'react'
import { Animated, Easing, Platform, Pressable, Text, View, type ViewStyle } from 'react-native'
import { useDeviceOffline } from '../shared/useDeviceOffline'
import { Button, Card, glass, useColors } from '../ui'
import { Icon } from './Icon'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const NETWORK = 'Cannot reach JM'

/** Reference animate-spin: one turn per second. */
function Spinning({ children }: { children: ReactNode }) {
  const [turn] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }))
    loop.start(); return () => loop.stop()
  }, [turn])
  return <Animated.View style={{ transform: [{ rotate: turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>{children}</Animated.View>
}

/** Only device connectivity controls the offline notice; action errors stay beside their screen. */
export function ConnectionStatus({ error, onRetry, retrying = false, placement = 'top' }: { error?: string | null; onRetry?: () => void; retrying?: boolean; reconnecting?: boolean; placement?: 'top' | 'inline' }) {
  if (placement === 'inline') return error && !isNetworkError(error) ? <ErrorBar error={error} onRetry={onRetry} retrying={retrying} /> : null
  return <TopPill error={error} onRetry={onRetry} retrying={retrying} />
}

const isNetworkError = (error: string) => error.startsWith(NETWORK) || error.startsWith('Offline')

function ErrorBar({ error, onRetry, retrying }: { error: string; onRetry?: () => void; retrying: boolean }) {
  const c = useColors()
  return <View style={{ minHeight: 44, paddingLeft: 12, paddingRight: onRetry ? 4 : 12, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.panel, borderBottomWidth: 1, borderBottomColor: c.border }}>
    <Icon name="triangleAlert" size={16} color={c.danger} />
    <Text accessibilityRole={Platform.OS === 'web' ? 'alert' : undefined} accessibilityLiveRegion="polite" style={{ flex: 1, color: c.danger, fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' }}>{error}</Text>
    {onRetry && <Button size="sm" variant="ghost" title="Try again" disabled={retrying} onPress={onRetry} />}
  </View>
}

function TopPill({ error: own, onRetry: ownRetry, retrying: ownRetrying }: { error?: string | null; onRetry?: () => void; retrying: boolean }) {
  const offline = useDeviceOffline()
  if (own && !isNetworkError(own)) return <ErrorBar error={own} onRetry={ownRetry} retrying={ownRetrying} />
  return offline ? <Pill tone="danger" icon="cloudOff" text="No internet" /> : null
}

function Pill({ tone, icon, text, spin = false, onPress }: { tone: 'brand' | 'danger' | 'success'; icon: 'refreshCw' | 'cloudOff' | 'wifi' | 'alert'; text: string; spin?: boolean; onPress?: () => void }) {
  const c = useColors()
  // Reference `top-[env(safe-area-inset-top)] pt-2`: below the status bar, over the page header.
  const inset = useSafeAreaInsets()
  const color = tone === 'brand' ? c.brand : tone === 'danger' ? c.danger : c.success
  const glyph = <Icon name={icon} size={16} color={color} />
  const pill: ViewStyle = { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)', ...glass(c, 4) }
  const body = <><View>{spin ? <Spinning>{glyph}</Spinning> : glyph}</View><Text style={{ flexShrink: 1, color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{text}</Text></>
  return <View pointerEvents="box-none" accessibilityRole={Platform.OS === 'web' ? 'status' : undefined} accessibilityLiveRegion="polite" style={{ position: 'absolute', top: inset.top, left: 0, right: 0, zIndex: 40, alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 }}>
    {onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${text} Try again`} onPress={onPress} style={pill}>{body}</Pressable> : <View style={pill}>{body}</View>}
  </View>
}

/** Reference core/auth/guards RequireSession "unreachable": a centred card, Try again and Sign out. */
export function SessionUnreachable({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  const c = useColors()
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
    <Card style={{ width: '100%', maxWidth: 448, padding: 24, gap: 0 }}>
      <Icon name="wifiOff" size={32} color={c.muted} />
      <Text accessibilityRole="header" style={{ marginTop: 12, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 18, lineHeight: 28 }}>Cannot reach JM</Text>
      <Text style={{ marginTop: 4, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>Check your connection. You are still signed in; this page retries when you are back online.</Text>
      <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
        {/* Reference h-10 (40px) buttons; the touch area reaches 44px through hitSlop. */}
        <Button title="Try again" onPress={onRetry} style={{ minHeight: 40 }} hitSlop={2} />
        <Button title="Sign out" variant="secondary" onPress={onSignOut} style={{ minHeight: 40 }} hitSlop={2} />
      </View>
    </Card>
  </View>
}

/**
 * Root error boundary (expo-router `ErrorBoundary`). The reference has none (a render error leaves a blank page), so
 * this is the RequireSession card with the DataState error mark: a TriangleAlert in danger, a title, one sentence,
 * and Try again (re-renders the app).
 */
export function AppCrashed({ onRetry }: { onRetry: () => void }) {
  const c = useColors()
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: c.bg }}>
    <Card style={{ width: '100%', maxWidth: 448, padding: 24, gap: 0 }}>
      <Icon name="triangleAlert" size={32} color={c.danger} />
      <Text accessibilityRole="header" style={{ marginTop: 12, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 18, lineHeight: 28 }}>Something went wrong</Text>
      <Text style={{ marginTop: 4, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>JM hit an unexpected problem on this screen. Try again.</Text>
      <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
        <Button title="Try again" onPress={onRetry} style={{ minHeight: 40 }} hitSlop={2} />
      </View>
    </Card>
  </View>
}
