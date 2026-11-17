import { describe, expect, it, vi } from 'vitest'
import { deleteBackward, emojiSections, insertAt, parseRecents, pushRecent, RECENT_LIMIT, searchEmoji } from './emoji'

describe('emoji panel data', () => {
  it('has WhatsApp-like categories, each emoji once per category, every entry named', () => {
    const sections = emojiSections()
    expect(sections.map(s => s.key)).toEqual(['smileys', 'animals', 'food', 'activity', 'travel', 'objects', 'symbols', 'flags'])
    for (const s of sections) {
      expect(s.emojis.length).toBeGreaterThan(20)
      expect(new Set(s.emojis.map(e => e.emoji)).size).toBe(s.emojis.length)
      for (const e of s.emojis) { expect(e.emoji).not.toMatch(/\s/); expect(e.name).toMatch(/^[a-z0-9 #*().,'&-]+$/) }
    }
    expect(sections[0].emojis[0]).toEqual({ emoji: '😀', name: 'grinning face' })
  })
  it('searches names by word prefixes', () => {
    expect(searchEmoji('thumbs up').map(e => e.emoji)).toContain('👍')
    expect(searchEmoji('flag indi').map(e => e.emoji)).toEqual(['🇮🇳'])
    expect(searchEmoji('hea').length).toBeGreaterThan(5)
    expect(searchEmoji('   ')).toEqual([])
    expect(searchEmoji('zzzz-not-an-emoji')).toEqual([])
    expect(searchEmoji('face', 5)).toHaveLength(5)
  })
})

describe('recents', () => {
  it('moves a used emoji to the front without duplicates and caps the list', () => {
    expect(pushRecent(['😀', '👍'], '👍')).toEqual(['👍', '😀'])
    const many = Array.from({ length: RECENT_LIMIT }, (_, i) => String(i))
    expect(pushRecent(many, '🔥')).toHaveLength(RECENT_LIMIT)
  })
  it('accepts only known emoji from storage', () => {
    expect(parseRecents('["👍","<script>","👍",5,"😀"]')).toEqual(['👍', '😀'])
    expect(parseRecents('{"a":1}')).toEqual([])
    expect(parseRecents('not json')).toEqual([])
    expect(parseRecents(null)).toEqual([])
  })
})

describe('editing at the caret', () => {
  it('inserts at the caret or over a selection, within the limit', () => {
    expect(insertAt('ab', { start: 1, end: 1 }, '😀')).toEqual({ text: 'a😀b', caret: 3 })
    expect(insertAt('abc', { start: 1, end: 3 }, '👍')).toEqual({ text: 'a👍', caret: 3 })
    expect(insertAt('abc', { start: 9, end: 9 }, 'x')).toEqual({ text: 'abcx', caret: 4 })
    expect(insertAt('abc', { start: 3, end: 3 }, 'xy', 4)).toBeNull()
  })
  const cases: [string, string][] = [['hi👍🏽', 'hi'], ['a👨‍👩‍👧', 'a'], ['x❤️', 'x'], ['go🇮🇳', 'go'], ['n1️⃣', 'n'], ['abc', 'ab'], ['🇮🇳🇺🇸', '🇮🇳']]
  it.each(cases)('backspace removes one whole character from %s', (text, left) => {
    expect(deleteBackward(text, { start: text.length, end: text.length })).toEqual({ text: left, caret: left.length })
  })
  it.each(cases)('backspace works without Intl.Segmenter (Hermes) for %s', (text, left) => {
    const original = (Intl as { Segmenter?: unknown }).Segmenter
    vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined })
    try { expect(deleteBackward(text, { start: text.length, end: text.length })).toEqual({ text: left, caret: left.length }) }
    finally { vi.unstubAllGlobals(); expect((Intl as { Segmenter?: unknown }).Segmenter).toBe(original) }
  })
  it('deletes a selection, and nothing at the start', () => {
    expect(deleteBackward('abcd', { start: 1, end: 3 })).toEqual({ text: 'ad', caret: 1 })
    expect(deleteBackward('abc', { start: 0, end: 0 })).toEqual({ text: 'abc', caret: 0 })
  })
})
