import { describe, expect, it } from 'vitest'

import { allows, CAPABILITIES, LEGACY_CAPABILITIES, withOversightAvailability } from './capabilities'

describe('capability rules', () => {
  const held = ['JM_ACCESS', 'ADMIN_AUDIT']
  it('single capability', () => {
    expect(allows(held, 'JM_ACCESS')).toBe(true)
    expect(allows(held, 'JP_ACCESS')).toBe(false)
  })
  it('any of a list', () => {
    expect(allows(held, ['ADMIN_USERS', 'ADMIN_AUDIT'])).toBe(true)
    expect(allows(held, ['ADMIN_USERS', 'JP_ACCESS'])).toBe(false)
  })
  it('no rule means anyone signed in', () => {
    expect(allows([], undefined)).toBe(true)
  })
})

// A user can hold one action without every action in its old alias bundle.
describe('per-action web permissions', () => {
  it('keeps the web catalogue separate from legacy aliases', () => {
    expect(CAPABILITIES).toHaveLength(96)
    expect(new Set(CAPABILITIES).size).toBe(CAPABILITIES.length)
    expect(CAPABILITIES.some(key => (LEGACY_CAPABILITIES as readonly string[]).includes(key))).toBe(false)
  })
  it('allows group creation without the old alias', () => {
    expect(allows(['JM_GROUP_CREATE'], 'JM_GROUP_CREATE')).toBe(true)
    expect(allows(['JM_ACCESS'], 'JM_GROUP_CREATE')).toBe(false)
  })
  it('does not grant alert management to an alert sender', () => {
    expect(allows(['JM_ALERT_SEND'], 'JM_ALERT_MANAGE')).toBe(false)
    expect(allows(['JM_ALERT_MANAGE'], 'JM_ALERT_SEND')).toBe(false)
    expect(allows(['JM_SEND_ALERT'], 'JM_ALERT_MANAGE')).toBe(false)
  })
})

it('hides Oversight when the server switch is off, preserving ordinary access', () => {
  expect(withOversightAvailability({capabilities:['JM_ACCESS','JM_OVERSIGHT_READ','JP_OVERSIGHT_VIEW'],oversight_enabled:false}).capabilities).toEqual(['JM_ACCESS'])
  expect(withOversightAvailability({capabilities:['JM_OVERSIGHT_READ'],oversight_enabled:true}).capabilities).toEqual(['JM_OVERSIGHT_READ'])
})
