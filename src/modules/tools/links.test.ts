import { describe, expect, it } from 'vitest'
import { safeToolLink, toolInitials } from './links'
describe('software links', () => {
  it('opens HTTPS websites and native app links', () => {
    expect(safeToolLink('https://messenger.jivo.in')).toBe(true)
    expect(safeToolLink('jivo-ho://home', true)).toBe(true)
    expect(safeToolLink('jivo-ho://home')).toBe(false)
  })
  it('rejects executable, local, credential-bearing and malformed links', () => {
    for (const value of ['javascript:alert(1)', 'file://private/data', 'intent://home', 'http://example.com', 'https://user:secret@example.com', 'https://bad host', '']) {
      expect(safeToolLink(value, true)).toBe(false)
    }
  })
})

it('matches web tool initials for padded and blank names', () => {
  expect(toolInitials(' HO ')).toBe('HO')
  expect(toolInitials('ji')).toBe('JI')
  expect(toolInitials('  ')).toBe('?')
})
