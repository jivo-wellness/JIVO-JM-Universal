export type SecondFactor = 'passkey' | 'recovery_code'
export type StepUpScope = 'security_settings' | 'admin' | 'jp' | 'app_unlock'
export type StepUpMethod = 'passkey' | 'password'

export interface PasskeyInfo {
  id: string
  name: string
  created_at: string
  last_used_at: string | null
  synced: boolean
}

export interface SecurityStatus {
  mfa_enrolled: boolean
  mfa_required: boolean
  /** Organisation-wide switch (Admin → Security). */
  two_step_enforced: boolean
  session_verified: boolean
  /** Two-step verification is on for this person: a second factor is enrolled (BE-110; older servers: absent). */
  two_step_enabled?: boolean
  passkeys: PasskeyInfo[]
  recovery_codes_left: number
  locked_capabilities: string[]
  /** Why each locked capability is locked (BE-110). Passwords and Oversight need two-step verification always. */
  locked_reasons?: Record<string, 'two_step_required' | 'session_not_verified' | 'recovery_hold'>
  locked_out: boolean
  /** After administrators recovered this account: Passwords and administration paused until then, and until a
   * passkey sign-in. */
  recovery_hold_until?: string | null
}

export type LoginResponse = { status: 'ok' } | { status: 'mfa_required'; mfa_token: string; methods: SecondFactor[] }


