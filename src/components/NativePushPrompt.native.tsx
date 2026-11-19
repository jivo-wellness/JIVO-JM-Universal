import { useEffect, useRef, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { Button, useColors } from '../ui'
import { Sheet } from './Sheet'
import { nativePushState, registerNativePush } from '../modules/notifications/nativePush'
import { errorMessage } from '../core/api/client'

/** Mounted inside the signed-in, unlocked account boundary. Never asks on every launch. */
export function NativePushPrompt({ owner }: { owner: string }) {
  const c = useColors()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(false)
  const key = `jm.push.prompt.${owner.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  useEffect(() => {
    alive.current = true
    void Promise.all([SecureStore.getItemAsync(key), nativePushState()]).then(([seen, state]) => {
      if (alive.current && !seen && state.enabled && !(state.subscribed && state.granted)) setVisible(true)
    }).catch(() => {})
    return () => { alive.current = false }
  }, [key])
  const remember = () => SecureStore.setItemAsync(key, '1', { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
  const dismiss = () => { if (busy) return; void remember().catch(() => {}); setVisible(false) }
  const enable = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      await registerNativePush(true, owner, () => alive.current)
      if (!alive.current) return
      await remember()
      setVisible(false)
    } catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  return <Sheet visible={visible} closeDisabled={busy} onClose={dismiss} title="Enable notifications?">
    <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>Get new messages and important JM alerts when the app is in the background. You can change this in Notifications settings.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
    <View style={{ gap: 10 }}>
      <Button title="Enable notifications" loading={busy} disabled={busy} onPress={() => void enable()} />
      {!!error && <Button title="Open device notification settings" variant="secondary" disabled={busy} onPress={() => void Linking.openSettings()} />}
      <Button title="Not now" variant="ghost" disabled={busy} onPress={dismiss} />
    </View>
  </Sheet>
}
