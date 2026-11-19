import { describe, expect, it } from 'vitest'
import { isAtlasConversation } from './routing'

describe('Atlas conversation identity', () => {
  it('uses the verified direct-conversation flag', () => {
    expect(isAtlasConversation({ kind: 'direct', is_atlas: true })).toBe(true)
  })
  it.each([undefined, null, {}, { kind: 'direct' }, { kind: 'direct', is_atlas: false }, { kind: 'group', is_atlas: true }])('keeps unverified accounts and groups in ordinary chat: %j', value => {
    expect(isAtlasConversation(value)).toBe(false)
  })
  it('does not guess from a matching display name or email', () => {
    const person = { kind: 'direct', title: 'Atlas', peer: { name: 'Atlas', email: 'atlas@jivo.in' } }
    expect(isAtlasConversation(person)).toBe(false)
  })
})
