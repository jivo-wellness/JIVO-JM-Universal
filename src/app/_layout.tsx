import { NativeNotifications } from '../components/NativeNotifications'
import { IncomingShareBridge } from '../components/IncomingShareBridge'
import { AppLock } from '../components/AppLock'
import { AttachmentExportStatus } from '../components/AttachmentExportStatus'
import { ChatAppearance } from '../components/ChatAppearance'
import { VaultExportStatus } from '../components/VaultExportStatus'
import { useFonts } from 'expo-font'
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular'
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium'
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold'
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold'
import { SplashScreen, Stack } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider } from '../core/theme/ThemeProvider'
import { SessionProvider } from '../core/auth/Session'
import { StepUp } from '../components/StepUp'
import { LiveUpdates } from '../components/LiveUpdates'
import { PwaSupport } from '../components/PwaSupport'
import { StartupSplash } from '../components/StartupSplash'
import { AppCrashed } from '../components/ConnectionStatus'
import type { ErrorBoundaryProps } from 'expo-router'
import { SplashGate } from '../shared/startup'
import { theme } from '../core/theme/useTheme'
import { sessionCache } from '../core/auth/sessionCache'

// U-031: the native splash stays up while JM reads this device's theme, profile, app-lock setting and chat list (all
// local), and goes when the first frame is the screen itself; it never waits for the network (2.5 s at most).
void SplashScreen.preventAutoHideAsync().catch(() => undefined)
const splash = new SplashGate({ hide: () => SplashScreen.hide(), nextFrame: fn => { const id = requestAnimationFrame(fn); return () => cancelAnimationFrame(id) } })
splash.start()
// Start the local reads before React mounts, in parallel with the fonts.
void theme.initialize()
sessionCache.preload()
/** A render error shows a retry card instead of a blank screen (and hides the splash so it is seen). */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  splash.hide()
  return <SafeAreaProvider><AppCrashed onRetry={() => void retry()} /></SafeAreaProvider>
}
export default function Layout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold })
  // Release builds embed Inter (app.json expo-font plugin), so this is normally loaded on the first render; until then
  // the splash covers an empty frame instead of a spinner.
  if (!loaded && !error) return null
  return <SafeAreaProvider><ThemeProvider><SessionProvider><StartupSplash gate={splash} /><ChatAppearance><VaultExportStatus /><AttachmentExportStatus /><AppLock><LiveUpdates><NativeNotifications /><PwaSupport /><IncomingShareBridge /><Stack screenOptions={{ headerShown: false }} /><StepUp /></LiveUpdates></AppLock></ChatAppearance></SessionProvider></ThemeProvider></SafeAreaProvider>
}

