import { EMOJI_CATEGORIES, type EmojiCategoryKey } from './emojiData'

export type Emoji = { emoji: string; name: string }
export type EmojiSection = { key: EmojiCategoryKey | 'recent'; label: string; emojis: Emoji[] }

const parse = (entries: string): Emoji[] => entries.split('\n').map(line => { const space = line.indexOf(' '); return { emoji: line.slice(0, space), name: line.slice(space + 1) } })
let sections: EmojiSection[] | null = null
/** The composer emoji panel's categories, in WhatsApp's order (parsed once, on first open). */
export function emojiSections(): EmojiSection[] {
  sections ??= EMOJI_CATEGORIES.map(c => ({ key: c.key, label: c.label, emojis: parse(c.entries) }))
  return sections
}

/** Search by Unicode name: every typed word must start a word of the name ("thumbs up", "hea" -> hearts). */
export function searchEmoji(query: string, limit = 64): Emoji[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const seen = new Set<string>(); const hits: Emoji[] = []
  for (const section of emojiSections()) for (const item of section.emojis) {
    if (seen.has(item.emoji)) continue
    const parts = item.name.split(/[\s-]+/)
    if (words.every(w => parts.some(p => p.startsWith(w)))) { seen.add(item.emoji); hits.push(item); if (hits.length >= limit) return hits }
  }
  return hits
}

export const RECENT_LIMIT = 32
/** Most recent first, no duplicates, capped. */
export function pushRecent(recent: readonly string[], emoji: string, limit = RECENT_LIMIT): string[] {
  return [emoji, ...recent.filter(e => e !== emoji)].slice(0, limit)
}
/** Stored recents are untrusted text: keep only short strings that are in the panel's set. */
export function parseRecents(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const known = new Set(emojiSections().flatMap(s => s.emojis.map(e => e.emoji)))
    return [...new Set(value.filter((e): e is string => typeof e === 'string' && e.length <= 16 && known.has(e)))].slice(0, RECENT_LIMIT)
  } catch { return [] }
}

/** Removes the last character the way a keyboard backspace does: one whole emoji (flags, ZWJ sequences, keycaps) or one code point. */
export function deleteBackward(text: string, caret: { start: number; end: number }): { text: string; caret: number } {
  const start = Math.max(0, Math.min(caret.start, text.length)); const end = Math.max(start, Math.min(caret.end, text.length))
  if (end > start) return { text: text.slice(0, start) + text.slice(end), caret: start }
  if (!start) return { text, caret: 0 }
  const before = text.slice(0, start)
  const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (t: string) => Iterable<{ segment: string }> } }).Segmenter
  let last: string
  if (Segmenter) { last = ''; for (const part of new Segmenter(undefined, { granularity: 'grapheme' }).segment(before)) last = part.segment }
  else {
    // Hermes without Intl.Segmenter: take one code point, then any joiners, variation selectors, keycap or tone marks and the pieces they join.
    const points = Array.from(before); let i = points.length - 1
    const glue = (p: string) => /[‍️⃣]/.test(p) || /\p{Emoji_Modifier}/u.test(p)
    while (i > 0 && (glue(points[i]) || points[i - 1] === '‍')) i--
    if (i > 0 && /\p{Regional_Indicator}/u.test(points[i]) && /\p{Regional_Indicator}/u.test(points[i - 1])) {
      let run = 0; for (let j = i; j >= 0 && /\p{Regional_Indicator}/u.test(points[j]); j--) run++
      if (run % 2 === 0) i--
    }
    last = points.slice(i).join('')
  }
  const cut = start - last.length
  return { text: text.slice(0, cut) + text.slice(end), caret: cut }
}

/** Inserts at the caret (replacing a selection); null when it would pass the length limit. */
export function insertAt(text: string, caret: { start: number; end: number }, insert: string, max = 4000): { text: string; caret: number } | null {
  const start = Math.max(0, Math.min(caret.start, text.length)); const end = Math.max(start, Math.min(caret.end, text.length))
  const next = text.slice(0, start) + insert + text.slice(end)
  return next.length > max ? null : { text: next, caret: start + insert.length }
}
