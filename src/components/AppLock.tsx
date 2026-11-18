import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ActivityIndicator, AppState, Platform, View } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import * as SecureStore from 'expo-secure-store'
import { useSession } from '../core/auth/Session'
import { NativeAppLock } from '../core/auth/nativeAppLock'
import { useScreenCaptureGuard } from '../shared/useScreenCaptureGuard'
import { startupSignals } from '../shared/startup'
import { SettingRow } from './ProfileSection'
import { Button, Label, useColors } from '../ui'

const Context = createContext<NativeAppLock | null>(null)
export function AppLock({ children }: { children: ReactNode }) {
  const { me, status } = useSession()
  return status === 'ready' && me ? <AccountLock key={me.id} account={me.id}>{children}</AccountLock> : <>{children}</>
}
function AccountLock({ account, children }: { account: string; children: ReactNode }) {
  const { logout } = useSession(); const colors = useColors()
  const [model] = useState(() => new NativeAppLock({
    read: async () => (await SecureStore.getItemAsync(`jm.lock.${account}`)) === '1',
    write: enabled => SecureStore.setItemAsync(`jm.lock.${account}`, enabled ? '1' : '0', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    authenticate: async () => (await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock JIVO JM', cancelLabel: 'Cancel', biometricsSecurityLevel: 'strong' })).success,
    cancel: () => { if (Platform.OS === 'android') void LocalAuthentication.cancelAuthenticate().catch(() => {}) },
  }))
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot)
  const [foreground, setForeground] = useState(AppState.currentState === 'active')
  useEffect(() => {
    // The start-up splash waits for this local read (U-031), so the lock cover or the app is its first frame.
    void model.restore().finally(() => { startupSignals.set('covered', model.snapshot().enabled ? account : null); startupSignals.set('lock', account); if (AppState.currentState === 'active') void model.foreground() })
    const sub = AppState.addEventListener('change', next => { setForeground(next === 'active'); if (next === 'background') model.background(); else if (next === 'active') void model.foreground() })
    return () => { sub.remove(); model.dispose() }
  }, [model, account])
  const cover = !state.ready || (state.enabled && (state.locked || !foreground))
  // Cover shown: block capture (Android FLAG_SECURE also blanks recents). Lock on: blur the iOS app-switcher snapshot.
  useScreenCaptureGuard(cover ? 'capture' : state.enabled ? 'switcher' : false)
  // Preserve an already-open screen beneath the privacy cover. Native system
  // pickers temporarily background JM; unmounting loses their reviewed result.
  return <Context.Provider value={model}>{(state.opened || !cover) && <View style={{ flex: 1, display: cover ? 'none' : 'flex' }} accessibilityElementsHidden={cover} importantForAccessibility={cover ? 'no-hide-descendants' : 'auto'}>{children}</View>}{cover && !state.ready && !state.error && <View style={{ flex: 1, backgroundColor: colors.bg }} />}{cover && (state.ready || !!state.error) && <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.bg }}>
    {!state.busy && <Label large>JIVO JM is locked</Label>}
    {!!state.error && <Label>{state.error}</Label>}
    {state.busy && <ActivityIndicator />}
    {!state.busy && <Button title={state.ready ? 'Unlock with device security' : 'Retry lock settings'} disabled={state.busy} onPress={() => { void (state.ready ? model.verify() : model.restore()) }} />}
    {!state.busy && <Button title="Sign out" disabled={state.busy} onPress={() => void logout().catch(() => {})} />}
  </View>}</Context.Provider>
}
export function AppLockSetting() {
  const model = useContext(Context)
  return model ? <LockSetting model={model} /> : null
}
function LockSetting({ model }: { model: NativeAppLock }) {
  const state = useSyncExternalStore(model.subscribe, model.snapshot, model.snapshot)
  // Reference: a row inside the profile's 'This device' section.
  return <SettingRow icon="lockKeyhole" title="Device app lock" detail={state.error || 'Require device verification when opening JM or after 5 minutes in the background. This privacy screen does not replace server sign-in or two-step verification.'}>
    <Button size="sm" variant="secondary" title={state.enabled ? 'Turn off' : 'Turn on'} accessibilityLabel={state.enabled ? 'Turn off app lock' : 'Turn on app lock'} disabled={!state.ready || state.busy} onPress={() => void model.verify(!state.enabled)} />
  </SettingRow>
}
