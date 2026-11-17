import { vaultSession } from '../modules/passwords/session'
import { StepUpPrompt } from './StepUp'
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { watchVaultActivity } from '../modules/passwords/activity'
import { Button, Surface, useColors } from '../ui'
import { Icon, type IconName } from './Icon'
import { useRouter } from 'expo-router'
import { passwordsAccess, type TwoStepLockReason } from '../shared/twoStep'
import { font } from './InboxVaultKit'

/** Reference LockGate: centred max-w-md surface, 40px brand lock, "Passwords are locked", Unlock. */
function Locked({ title, body, error, action, icon = 'lockKeyhole' }: { title: string; body: string; error?: string; action?: ReactNode; icon?: IconName }) {
  const c = useColors()
  return <View style={{ paddingHorizontal: 16, paddingTop: 32 }}><Surface style={{ width: '100%', maxWidth: 448, alignSelf: 'center', padding: 32, alignItems: 'center' }}>
    <Icon name={icon} size={40} color={c.brand} />
    <Text accessibilityRole="header" style={{ marginTop: 16, fontFamily: font.s, fontWeight: '600', fontSize: 18, lineHeight: 28, color: c.text, textAlign: 'center' }}>{title}</Text>
    <Text style={{ marginTop: 8, fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.muted, textAlign: 'center' }}>{body}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ marginTop: 12, fontFamily: font.r, fontSize: 14, lineHeight: 20, color: c.danger, textAlign: 'center' }}>{error}</Text>}
    {action && <View style={{ marginTop: 24 }}>{action}</View>}
  </Surface></View>
}
function Gate({ children, owner }: { children: ReactNode; owner: string }) {
  const [{ lock, fallback }] = useState(() => vaultSession(owner))
  const state = useSyncExternalStore(lock.subscribe, lock.snapshot, lock.snapshot)
  useEffect(() => { lock.start(); const off = watchVaultActivity(lock.touch, lock.check); return () => { off(); lock.stop(); fallback.clear() } }, [lock, fallback])
  return <><StepUpPrompt flow={fallback}/>{state.unlocked ? <View style={{ flex: 1 }} onTouchStart={lock.touch}>
    {children}
  </View> : <Locked title="Passwords are locked" body="Confirm your identity to open Passwords. It locks after 10 minutes of inactivity." error={state.error || undefined} action={<Button title="Unlock" loading={state.busy} disabled={state.busy} onPress={() => void lock.open()} />} />}</>
}
/** Passwords is held but needs two-step verification (BE-110): turn it on in Profile → Security, or sign in again
 * with the passkey when this session was signed in without it. */
export function TwoStepRequired({ reason }: { reason: TwoStepLockReason }) {
  const router = useRouter()
  const { logout } = useSession()
  const [busy, setBusy] = useState(false)
  if (reason === 'session_not_verified') return <Locked icon="lockKeyhole" title="Sign in again with your passkey to use Passwords"
    body="Passwords needs two-step verification. Your two-step verification is on, but this session was signed in without it. Sign out, then sign in again with your passkey (fingerprint, face or screen lock)."
    action={<Button title="Sign out and sign in again" loading={busy} disabled={busy} onPress={() => { setBusy(true); void logout().finally(() => setBusy(false)) }} />} />
  return <Locked icon="shieldCheck" title="Turn on two-step verification to use Passwords"
    body="You have permission to use Passwords, but it is available only to people who turned on two-step verification: a passkey (your device's fingerprint, face or screen lock) asked for at every sign-in. Turn it on in Profile → Security; Passwords opens right after."
    action={<Button title="Open Profile → Security" onPress={() => router.push('/profile')} />} />
}
export function VaultGate({ children }: { children: ReactNode }) {
  const { me } = useSession()
  const access = passwordsAccess(me)
  if (access.kind === 'two_step') return <TwoStepRequired reason={access.reason} />
  return access.kind === 'open' ? <Gate owner={me!.id + ':' + (me!.session?.id ?? 'none')} key={me!.id + ':' + (me!.session?.id ?? 'none')}>{children}</Gate> : <Locked title="Passwords" body="Passwords access is not enabled for your account." />
}
