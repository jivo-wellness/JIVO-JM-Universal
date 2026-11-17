/**
 * Passwords and Oversight need two-step verification (BE-110): a second factor enrolled (a passkey) and a
 * session verified with it, whatever the organisation-wide switch says, superusers included. The server is the
 * real gate (it leaves locked keys out of `me.capabilities` and answers 403 `two_step_required` /
 * `session_not_verified`); the app hides Passwords and explains how to unlock it.
 */

export type LockReason = 'two_step_required' | 'session_not_verified' | 'recovery_hold'
export type TwoStepLockReason = Exclude<LockReason, 'recovery_hold'>

const OVERSIGHT_KEYS = ['JM_OVERSIGHT_READ', 'JM_OVERSIGHT_SEARCH', 'JM_OVERSIGHT_MODERATE', 'JP_OVERSIGHT_VIEW']
const OPENS_PASSWORDS = ['JP_ACCESS', 'JP_MANAGE_VAULT', 'JP_BREAK_GLASS', 'JP_REQUEST_EMERGENCY']

interface SecurityLike {
  mfa_enrolled?: boolean
  two_step_enabled?: boolean
  session_verified?: boolean
  locked_capabilities?: string[]
  locked_reasons?: Record<string, LockReason>
}
interface MeLike { capabilities: readonly string[]; security?: SecurityLike | null }

export function isStrictTwoStepKey(key: string): boolean {
  return key.startsWith('JP_') || OVERSIGHT_KEYS.includes(key)
}

/** Two-step verification is on for this person and this session was verified with it (no `security`: trusted). */
export function twoStepUnlocked(me: MeLike | null | undefined): boolean {
  const s = me?.security
  if (!s) return true
  return Boolean((s.two_step_enabled ?? s.mfa_enrolled) && s.session_verified)
}

/**
 * `me` as the app uses it: Passwords and Oversight keys only in a verified session with a second factor. Keys an
 * older server still lists without that move to `security.locked_capabilities` with their reason, so the app
 * can still explain how to unlock them.
 */
export function withTwoStepRule<T extends MeLike>(me: T): T {
  const s = me.security
  if (!s || twoStepUnlocked(me)) return me
  const removed = me.capabilities.filter(isStrictTwoStepKey)
  if (removed.length === 0) return me
  const reason: TwoStepLockReason = (s.two_step_enabled ?? s.mfa_enrolled) ? 'session_not_verified' : 'two_step_required'
  const lockedCapabilities = [...new Set([...(s.locked_capabilities ?? []), ...removed])].sort()
  const lockedReasons = { ...Object.fromEntries(removed.map(k => [k, reason])), ...(s.locked_reasons ?? {}) }
  return {
    ...me,
    capabilities: me.capabilities.filter(k => !isStrictTwoStepKey(k)),
    security: { ...s, locked_capabilities: lockedCapabilities, locked_reasons: lockedReasons },
  } as T
}

/** Why a held capability is not usable in this session (null: usable or not held). */
export function lockReason(me: MeLike | null | undefined, key: string): LockReason | null {
  const s = me?.security
  if (!s || !(s.locked_capabilities ?? []).includes(key) && !(key in (s.locked_reasons ?? {}))) return null
  return s.locked_reasons?.[key] ?? ((s.two_step_enabled ?? s.mfa_enrolled) ? 'session_not_verified' : 'two_step_required')
}

/** What the Passwords screens show: the vaults, the two-step explanation, or "not enabled" (no permission). */
export type PasswordsAccess = { kind: 'open' } | { kind: 'two_step'; reason: TwoStepLockReason } | { kind: 'none' }

export function passwordsAccess(me: MeLike | null | undefined): PasswordsAccess {
  if (!me) return { kind: 'none' }
  const m = withTwoStepRule(me)
  if (m.capabilities.some(k => OPENS_PASSWORDS.includes(k))) return { kind: 'open' }
  const lockedJp = (m.security?.locked_capabilities ?? []).filter(k => OPENS_PASSWORDS.includes(k))
  const reasons = lockedJp.map(k => lockReason(m, k))
  if (reasons.includes('two_step_required')) return { kind: 'two_step', reason: 'two_step_required' }
  if (reasons.includes('session_not_verified')) return { kind: 'two_step', reason: 'session_not_verified' }
  return { kind: 'none' }
}
