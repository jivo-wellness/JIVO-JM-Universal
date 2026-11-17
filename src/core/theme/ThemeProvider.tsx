import { useEffect, type ReactNode } from 'react'
import { Platform, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { applyPlatformTheme } from './platform'
import { theme, useTheme } from './useTheme'

/**
 * The app mounts at once: the saved theme is a local read that the start-up splash covers (U-031), so the session and
 * chat cache are read in parallel with it instead of after it. The browser has no splash, so there the page waits for
 * the (synchronous localStorage) choice on a plain background rather than flashing the other theme.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { ready, choice, dark } = useTheme()
  useEffect(() => { void theme.initialize(); return theme.listen() }, [])
  useEffect(() => { if (ready) applyPlatformTheme(choice, dark) }, [ready, choice, dark])
  return <><StatusBar style={dark ? 'light' : 'dark'} />{Platform.OS === 'web' && !ready ? <View style={{ flex: 1, backgroundColor: dark ? '#0c1210' : '#f6f8f6' }} /> : children}</>
}
