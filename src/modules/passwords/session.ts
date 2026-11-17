import { StepUpFlow } from '../../core/auth/stepUpFlow'
import { confirmPassword, confirmPasskey, isPasskeyCancel, passkeysSupported } from '../../core/auth/security'
import { errorMessage } from '../../core/api/client'
import { unlock } from './api'
import { VaultLock } from './lock'

function createGate() {
  const fallback = new StepUpFlow({ supported: passkeysSupported, password: confirmPassword, passkey: confirmPasskey, message: errorMessage, cancelled: isPasskeyCancel })
  const aborted = (signal: AbortSignal) => { if (signal.aborted) throw Object.assign(Error('Verification cancelled.'), { name: 'AbortError' }) }
  const refused = () => ({ response: { data: { code: 'step_up_required' } } })
  type Refusal = { response?: { data?: { code?: string; methods?: unknown } } }
  const stepUpRequired = (error: unknown) => (error as Refusal)?.response?.data?.code === 'step_up_required'
  const serverMethods = (error: unknown) => {
    const methods = (error as Refusal)?.response?.data?.methods
    const offered = Array.isArray(methods) ? methods.filter((m): m is string => m === 'passkey' || m === 'password') : []
    return offered.length ? offered : ['password']
  }
  // Same as the web: the server's step-up is the only gate. When it needs one, the "Confirm it's you" sheet asks
  // passkey first (Android's own fingerprint/face/PIN prompt) and the password only if the passkey fails or is
  // declined. While the server's step-up is still fresh, Passwords opens without asking again.
  const lock = new VaultLock({ unlock: async signal => {
    let fresh: Awaited<ReturnType<typeof unlock>> | null = null
    let methods: string[] = ['password']
    try { fresh = await unlock(signal, { stepUpPrompt: false }) } catch (error) { if (!stepUpRequired(error)) throw error; methods = serverMethods(error) }
    aborted(signal)
    if (fresh === null) {
      if (!await fallback.request('jp', methods, signal)) throw refused()
      aborted(signal)
      return unlock(signal, { stepUpPrompt: false })
    }
    return fresh
  }, message: errorMessage, cancelled: error => (error as { response?: { data?: { code?: string } } })?.response?.data?.code === 'step_up_required' })
  return { lock, fallback }
}
let cached: { owner: string; gate: ReturnType<typeof createGate> } | null = null
/** Memory only; verification survives navigation, never an authentication boundary. */
export function clearVaultSession() {
  if (!cached) return
  cached.gate.lock.stop()
  cached.gate.lock.lock()
  cached.gate.fallback.clear()
  cached = null
}
export function vaultSession(owner: string) {
  if (cached?.owner !== owner) {
    clearVaultSession()
    cached = { owner, gate: createGate() }
  }
  cached!.gate.lock.check()
  return cached!.gate
}
