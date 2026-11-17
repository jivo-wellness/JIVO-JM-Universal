import { useEffect, useRef, useState } from 'react'
import { AppState, Linking } from 'react-native'
import { router, usePathname } from 'expo-router'
import { useSession } from '../core/auth/Session'
import { incomingStorage, onIncomingShareChange } from '../modules/sharing/incoming'
import { shareStep } from '../modules/sharing/model'

/**
 * Takes in what another app shared with JM and opens the "Send to…" page. Native: the share intent (cold start, or a
 * new intent while JM is open, which also arrives as the `jivo-jm://expo-sharing` link) is copied into JM's storage at
 * once, also before sign-in; the page opens when someone is signed in. It is mounted inside AppLock, so a locked app
 * is unlocked first. PWA: the service worker has already stashed the share and redirected to /share.
 */
export function IncomingShareBridge() {
  const { me, status } = useSession()
  const path = usePathname()
  const [pending, setPending] = useState(false)
  // Open the page once per pending share (the page clears it on Send/Cancel, which resets this).
  const opened = useRef(false)
  const here = useRef(path)
  useEffect(() => { here.current = path }, [path])
  useEffect(() => {
    let active = true
    const check = () => {
      void incomingStorage.capture().catch(() => false)
        .then(() => incomingStorage.hasPending())
        .then(value => { if (active) { if (!value) opened.current = false; setPending(value) } })
        .catch(() => undefined)
    }
    check()
    const app = AppState.addEventListener('change', value => { if (value === 'active') check() })
    const link = Linking.addEventListener('url', check)
    const changed = onIncomingShareChange(check)
    return () => { active = false; app.remove(); link.remove(); changed() }
  }, [])
  useEffect(() => {
    const onShare = (value: string) => value === '/share' || value.startsWith('/share/')
    if (onShare(path)) opened.current = true
    if (shareStep({ pending, status, signedIn: !!me, path, opened: opened.current }) !== 'open') return
    // A share link (+native-intent) navigates to /share by itself right after the intent arrives: give it a moment,
    // so the page is not pushed twice, and open it only if JM is still elsewhere.
    const timer = setTimeout(() => { if (onShare(here.current) || opened.current) return; opened.current = true; router.push('/share') }, 800)
    return () => clearTimeout(timer)
  }, [pending, status, me, path])
  return null
}
