import { Workspace } from '../components/Workspace'
import { ShareFlow } from '../components/ShareFlow'

/**
 * Share into JM (U-036): Android/iOS share intents (`+native-intent.ts` maps the `expo-sharing` link here) and the
 * PWA Web Share Target (the service worker redirects here). Workspace sends a signed-out person to sign in first and
 * back here afterwards; AppLock covers the page until the app is unlocked.
 */
export default function SharePage() {
  return <Workspace><ShareFlow /></Workspace>
}
