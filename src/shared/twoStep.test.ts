import { describe, expect, it } from 'vitest'

import { shellLinks } from './shellLayout'
import { homeTiles } from './homeTiles'
import { passwordsAccess, twoStepUnlocked, withTwoStepRule } from './twoStep'

const security = (s: { enrolled: boolean; verified: boolean; locked?: string[]; reasons?: Record<string, 'two_step_required' | 'session_not_verified' | 'recovery_hold'> }) => ({
  mfa_enrolled: s.enrolled, two_step_enabled: s.enrolled, session_verified: s.verified,
  locked_capabilities: s.locked ?? [], ...(s.reasons ? { locked_reasons: s.reasons } : {}),
})

describe('Passwords needs two-step verification (BE-110)', () => {
  it('no second factor: the server leaves JP out and says why; the app explains instead of the vaults', () => {
    const me = { capabilities: ['JM_ACCESS'], security: security({ enrolled: false, verified: false, locked: ['JP_ACCESS', 'JP_SHARED_VIEW'], reasons: { JP_ACCESS: 'two_step_required', JP_SHARED_VIEW: 'two_step_required' } }) }
    expect(passwordsAccess(me)).toEqual({ kind: 'two_step', reason: 'two_step_required' })
    const m = withTwoStepRule(me)
    expect(shellLinks(m.capabilities).tabs.map(l => l.tabTitle)).not.toContain('Passwords')
    expect(homeTiles(m.capabilities).map(t => t.title)).not.toContain('Passwords')
  })

  it('a second factor but a password-only session: sign in again', () => {
    const me = { capabilities: ['JM_ACCESS'], security: security({ enrolled: true, verified: false, locked: ['JP_ACCESS'], reasons: { JP_ACCESS: 'session_not_verified' } }) }
    expect(passwordsAccess(me)).toEqual({ kind: 'two_step', reason: 'session_not_verified' })
  })

  it('verified session with a second factor: Passwords opens and is in the tabs', () => {
    const me = { capabilities: ['JM_ACCESS', 'JP_ACCESS'], security: security({ enrolled: true, verified: true }) }
    expect(twoStepUnlocked(me)).toBe(true)
    expect(passwordsAccess(me)).toEqual({ kind: 'open' })
    expect(withTwoStepRule(me)).toBe(me)
    expect(shellLinks(withTwoStepRule(me).capabilities).tabs.map(l => l.tabTitle)).toContain('Passwords')
  })

  it('an older server still listing JP keys without two-step verification: hidden and explained anyway', () => {
    const me = { capabilities: ['JM_ACCESS', 'JP_ACCESS', 'JM_OVERSIGHT_READ'], security: security({ enrolled: false, verified: false }) }
    const m = withTwoStepRule(me)
    expect(m.capabilities).toEqual(['JM_ACCESS'])
    expect(m.security.locked_capabilities).toEqual(['JM_OVERSIGHT_READ', 'JP_ACCESS'])
    expect(m.security.locked_reasons).toEqual({ JP_ACCESS: 'two_step_required', JM_OVERSIGHT_READ: 'two_step_required' })
    expect(passwordsAccess(me)).toEqual({ kind: 'two_step', reason: 'two_step_required' })
  })

  it('without the permission: "not enabled", nothing about two-step verification', () => {
    const me = { capabilities: ['JM_ACCESS'], security: security({ enrolled: false, verified: false, locked: ['ADMIN_USER_VIEW'], reasons: { ADMIN_USER_VIEW: 'two_step_required' } }) }
    expect(passwordsAccess(me)).toEqual({ kind: 'none' })
    expect(passwordsAccess(null)).toEqual({ kind: 'none' })
  })

  it('a recovery hold is not a two-step lock', () => {
    const me = { capabilities: ['JM_ACCESS'], security: security({ enrolled: true, verified: true, locked: ['JP_ACCESS'], reasons: { JP_ACCESS: 'recovery_hold' } }) }
    expect(passwordsAccess(me)).toEqual({ kind: 'none' })
  })

  it('Messenger and administration keys are untouched', () => {
    const me = { capabilities: ['JM_ACCESS', 'ADMIN_USERS'], security: security({ enrolled: false, verified: false }) }
    expect(withTwoStepRule(me)).toBe(me)
  })
})
