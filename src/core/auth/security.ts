import { Platform } from 'react-native'
import { Passkey, type PasskeyCreateRequest, type PasskeyGetRequest } from 'react-native-passkey'
import { api } from '../api/client'
export type { SecondFactor, StepUpScope, StepUpMethod, PasskeyInfo, SecurityStatus, LoginResponse } from './securityTypes'

/**
 * Native passkeys (Android Credential Manager, iOS AuthenticationServices) through react-native-passkey.
 * The server's WebAuthn options are passed through unchanged and the platform's response JSON is sent back
 * unchanged, exactly like the web adapter (security.web.ts). Android signs clientDataJSON with the origin
 * `android:apk-key-hash:<sha256 of the signing certificate>`, which the server accepts only for the signing keys
 * it is configured with (JM_WEBAUTHN_ANDROID_ORIGINS) and which messenger.jivo.in/.well-known/assetlinks.json
 * vouches for. Device support: Android 9 (API 28)+ and iOS 16+.
 */
export function passkeysSupported(): boolean {
  try {
    if (Platform.OS === 'android') return Number(Platform.Version) >= 28 && Passkey.isSupported()
    if (Platform.OS === 'ios') return parseInt(String(Platform.Version), 10) >= 16 && Passkey.isSupported()
  } catch { /* module missing in an old build: no passkeys */ }
  return false
}

/** react-native-passkey rejects with `{ error, message }`. Turn it into an Error whose `name` follows WebAuthn:
 * a closed or timed-out prompt is NotAllowedError (quiet, like the browser), anything else keeps its code. */
export function nativePasskeyError(raw: unknown): Error {
  if (raw instanceof Error) return raw
  const code = String((raw as { error?: unknown } | null)?.error ?? 'UnknownError')
  const detail = String((raw as { message?: unknown } | null)?.message ?? '')
  const quiet = code === 'UserCancelled' || code === 'TimedOut' || code === 'Interrupted'
  const message = quiet ? 'The passkey prompt was closed.'
    : code === 'NoCredentials' ? 'No passkey for this account is saved on this device.'
      : code === 'CredentialAlreadyExists' ? 'This device already has a passkey for your account.'
        : code === 'NoCreateOption' ? 'This device has no passkey provider. Sign in to a Google account (or another password manager) on the phone, then try again.'
          : code === 'NotSupported' ? 'Passkeys are not supported on this device.'
            : /rp ?id|asset|associated|domain|cannot be validated/i.test(detail) || code === 'BadConfiguration'
              ? 'This app is not yet approved for passkeys on this server.'
              : 'The passkey could not be used.'
  return Object.assign(new Error(message), { name: quiet ? 'NotAllowedError' : 'PasskeyError', code, detail })
}

const abortError = () => Object.assign(new Error('Verification cancelled.'), { name: 'AbortError' })
/** The platform sheet cannot be closed from JS: on abort the caller moves on and a late credential is dropped. */
function ceremony<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortError())
    signal?.addEventListener('abort', abort, { once: true })
    run().then(resolve, error => reject(nativePasskeyError(error))).finally(() => signal?.removeEventListener('abort', abort))
  })
}

/** Passwordless sign-in or the second step after the password. Not offered on the native sign-in page yet. */
export async function signInWithPasskey(token?: string): Promise<void> {
  await api.get('/auth/csrf/')
  const { data } = await api.post<{ flow: string; options: PasskeyGetRequest }>('/auth/login/passkey/options/', token ? { mfa_token: token } : {})
  const credential = await ceremony(() => Passkey.get(data.options))
  await api.post('/auth/login/passkey/', { flow: data.flow, credential, ...(token ? { mfa_token: token } : {}) })
}

export const isPasskeyCancel = (error: unknown) => ['NotAllowedError', 'AbortError'].includes((error as { name?: string })?.name ?? '')

/** "Confirm it's you" with a passkey: the same /auth/step-up/options/ + /auth/step-up/ contract as the web. */
export async function confirmPasskey(scope: string, signal?: AbortSignal): Promise<void> {
  const check = () => { if (signal?.aborted) throw abortError() }
  check()
  const { data } = await api.post<{ methods: string[]; passkey: { flow: string; options: PasskeyGetRequest } | null }>('/auth/step-up/options/', { scope }, { signal })
  check()
  if (!data.methods.includes('passkey') || !data.passkey) throw new Error('The server did not offer passkey verification.')
  const options = data.passkey.options
  const credential = await ceremony(() => Passkey.get(options), signal)
  check()
  await api.post('/auth/step-up/', { scope, method: 'passkey', flow: data.passkey.flow, credential }, { signal })
  check()
}

/** Profile → Security → Add a passkey (the server asks for a security_settings step-up first). */
export async function addPasskey(name: string): Promise<{ recovery_codes?: string[] }> {
  const { data } = await api.post<{ flow: string; options: PasskeyCreateRequest }>('/auth/passkeys/options/')
  const credential = await ceremony(() => Passkey.create(data.options))
  return (await api.post<{ recovery_codes?: string[] }>('/auth/passkeys/', { flow: data.flow, credential, name })).data
}

export async function confirmPassword(scope: string, password: string, signal?: AbortSignal) { await api.post('/auth/step-up/', { scope, method: 'password', password }, { signal }) }
