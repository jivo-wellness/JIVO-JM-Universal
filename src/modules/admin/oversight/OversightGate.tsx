import { OversightHeading, OversightHint } from './OversightUi'
import { Icon } from '../../../components/Icon'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AppState, Platform, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSession } from '../../../core/auth/Session'
import { errorMessage } from '../../../core/api/client'
import { allows, OVERSIGHT_ACCESS } from '../../../config/capabilities'
import { twoStepUnlocked } from '../../../shared/twoStep'
import { useResource } from '../../../shared/useResource'
import { useScreenCaptureGuard } from '../../../shared/useScreenCaptureGuard'
import { Button, ListSection as Card, ErrorState, Field, Label, Spinner, useColors } from '../../../ui'
import { Sheet } from '../../../components/Sheet'
import * as api from './api'

const Context = createContext(<T,>(request: () => Promise<T>): Promise<T> => request())
export const useOversightRequest = () => useContext(Context)
export function OversightGate({ children }: { children: ReactNode }) {
  const { me, stale } = useSession(); const router = useRouter()
  if (!me?.oversight_enabled) return <Label>Oversight is not available.</Label>
  const held = [...me.capabilities, ...(me.security?.locked_capabilities ?? [])]
  if (!allows(held, OVERSIGHT_ACCESS)) return <Label>Oversight access is not enabled for your account.</Label>
  if (!twoStepUnlocked(me)) return <Card><Label large>Two-step verification required</Label><Label>Set up a passkey and sign in with it to use Oversight.</Label><Button title="Open Profile & security" onPress={() => router.push('/profile-settings?section=security&title=Two-step%20verification')} /></Card>
  if (stale) return <Label>Connect to JM to verify your Oversight access.</Label>
  return <SessionGate key={`${me.id}:${me.session?.id}`}>{children}</SessionGate>
}
function SessionGate({ children }: { children: ReactNode }) {
  const c = useColors(); const session = useResource(api.getSession); const refreshSession = session.refresh
  const [current, setCurrent] = useState<api.OversightSession | null>(null)
  const [starting, setStarting] = useState(false); const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [now, setNow] = useState(() => Date.now())
  const [foreground, setForeground] = useState(true)
  const invalidate = useCallback(() => { setCurrent(null); refreshSession() }, [refreshSession])
  // Synchronize the server-owned session when the authenticated session request finishes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrent(session.value ?? null) }, [session.value])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id) }, [])
  useEffect(() => {
    const update = (visible: boolean) => { setForeground(visible); if (visible) invalidate() }
    const sub = AppState.addEventListener('change', state => update(state === 'active'))
    const web = () => update(document.visibilityState === 'visible')
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', web)
    return () => { sub.remove(); if (Platform.OS === 'web') document.removeEventListener('visibilitychange', web) }
  }, [invalidate])
  const live = current && Date.parse(current.expires_at) > now && foreground
  useScreenCaptureGuard(live ? 'capture' : false)
  const request = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    try { return await run() } catch (e) {
      const response = (e as { response?: { status?: number; data?: { code?: string } } }).response
      if (response?.status === 403 && !['oversight_session_required', 'two_step_required', 'session_not_verified'].includes(response.data?.code ?? '')) { setCurrent(null); setError('Oversight access changed. Refresh your account permissions before continuing.') }
      if (response?.status === 401 || ['oversight_session_required', 'two_step_required', 'session_not_verified'].includes(response?.data?.code ?? '')) invalidate()
      throw e
    }
  }, [invalidate])
  async function start() {
    if (busy || reason.trim().length < 3) return
    setBusy(true); setError('')
    try { const value = await api.startSession(reason.trim()); setCurrent(value); setNow(Date.now()); setStarting(false); setReason('') } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function end() {
    setBusy(true); setCurrent(null)
    try { await api.endSession(); session.refresh() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  if (!foreground) return null
  const left = current ? Math.max(0, Math.min(1800, Math.ceil((Date.parse(current.expires_at) - now) / 1000))) : 0
  return <View style={{ gap: 16 }}>
    {!!error && <ErrorState message={error} onRetry={() => { setError(''); invalidate() }} />}
    {session.loading && !current ? <Spinner label="Checking oversight session" /> : session.error ? <ErrorState message={errorMessage(session.error)} onRetry={session.refresh} /> : live ? <>
      <View accessibilityRole="alert" style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 12, backgroundColor: c.warningSoft, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="shieldCheck" size={22} color={c.warning} /><View style={{ flex: 1, minWidth: 0, gap: 3 }}><Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 19 }}>Oversight session - {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</Text><Text numberOfLines={2} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>Reason: {current.reason}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Every view is recorded.</Text></View>
        <Button title="End" size="sm" variant="secondary" disabled={busy} onPress={() => void end()} />
      </View><Context.Provider value={request}>{children}</Context.Provider>
    </> : <View style={{ gap: 24, paddingVertical: 16 }}><View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="shieldCheck" size={28} color={c.brand} /></View><OversightHeading title="Review with oversight" detail="Authorized access to conversations and vaults." /><View style={{ gap: 16 }}><OversightHint>Start a 30-minute session with a reason and your passkey.</OversightHint><OversightHint>Each view is recorded and the other Super Administrators are notified. Reading a chat does not mark its messages as read.</OversightHint><OversightHint>Vault owners are notified when you reveal one of their passwords.</OversightHint></View><View style={{ alignSelf: 'flex-start' }}><Button title="Start oversight session" disabled={busy} onPress={() => setStarting(true)} /></View></View>}
    <Sheet visible={starting} onClose={() => { if (!busy) setStarting(false) }} title="Start an oversight session" description="Say why. The reason, and everything you open, is recorded in the oversight audit log and shown to the other Super Administrators." footer={<View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}><Button title="Cancel" variant="secondary" disabled={busy} onPress={() => setStarting(false)} /><Button title="Start with passkey" variant="danger" disabled={busy || reason.trim().length < 3} onPress={() => void start()} /></View>}>
      <Field label="Reason" value={reason} onChangeText={setReason} multiline maxLength={300} /><Label>At least 3 characters. The session lasts 30 minutes. Nothing is marked as read.</Label>{!!error && <Label>{error}</Label>}
    </Sheet>
  </View>
}
