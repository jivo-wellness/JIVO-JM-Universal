import { useEffect, useSyncExternalStore } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { useTheme } from '../core/theme/useTheme'
import { startupReady, startupSignals, type SplashGate } from '../shared/startup'

/** Hides the native splash when the first useful frame is ready (U-031). Renders nothing. */
export function StartupSplash({ gate }: { gate: SplashGate }) {
  const { status, reading, me } = useSession()
  const { ready: theme } = useTheme()
  const route = usePathname()
  const signals = useSyncExternalStore(startupSignals.subscribe, startupSignals.snapshot, startupSignals.snapshot)
  const account = me?.id ?? null
  // The browser build has no splash and reads its lock preference synchronously.
  const lock = Platform.OS === 'web' ? account : signals.lock
  const ready = startupReady({ theme, session: { status, reading, account }, messenger: !!me?.capabilities.includes('JM_ACCESS'), lock, covered: Platform.OS === 'web' ? null : signals.covered, chats: signals.chats, route })
  useEffect(() => { gate.update(ready) }, [gate, ready])
  return null
}
