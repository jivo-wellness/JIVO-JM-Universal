/**
 * Reference PollDialog (Frontend ComposerExtras.tsx): a question, at least two different options, a new empty row
 * appears when the last one is used (up to 12, like WhatsApp), and "Allow multiple answers".
 * Options can also be reordered here (the empty trailing row always stays last).
 */
export const POLL_QUESTION_MAX = 300
export const POLL_OPTION_MAX = 100
export const POLL_MAX_OPTIONS = 12

export interface PollDraft { question: string; options: string[]; multiple: boolean }
export const emptyPoll = (): PollDraft => ({ question: '', options: ['', ''], multiple: false })

/** Typing into row `index`; using the last row adds a new empty one (up to 12 rows). */
export function setPollOption(options: string[], index: number, value: string): string[] {
  const next = options.map((option, i) => (i === index ? value.slice(0, POLL_OPTION_MAX) : option))
  if (index === next.length - 1 && value.trim() && next.length < POLL_MAX_OPTIONS) next.push('')
  return next
}

/** Removing a row keeps at least two rows. */
export function removePollOption(options: string[], index: number): string[] {
  if (options.length <= 2 || index < 0 || index >= options.length) return options
  const next = options.filter((_, i) => i !== index)
  // Keep one empty row to type into, as long as there is room for it.
  if (next.every(option => option.trim()) && next.length < POLL_MAX_OPTIONS) next.push('')
  return next
}

/** Rows that hold text, in order (the empty "+ Add option" row is not movable). */
const movable = (options: string[]) => options.reduce((last, option, i) => (option.trim() ? i : last), -1)

/** Move row `index` by `delta` (-1 up, +1 down) among the filled rows. */
export function movePollOption(options: string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta
  if (!options[index]?.trim() || target < 0 || target > movable(options)) return options
  const next = [...options]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export const canMovePollOption = (options: string[], index: number, delta: -1 | 1) => movePollOption(options, index, delta) !== options

export function pollInput(draft: PollDraft): { value: { question: string; options: string[]; allow_multiple: boolean } | null; duplicate: boolean; error: string } {
  const filled = draft.options.map(option => option.trim()).filter(Boolean)
  const duplicate = new Set(filled.map(option => option.toLowerCase())).size !== filled.length
  const question = draft.question.trim()
  if (!question) return { value: null, duplicate, error: 'Ask a question.' }
  if (question.length > POLL_QUESTION_MAX || filled.some(option => option.length > POLL_OPTION_MAX)) return { value: null, duplicate, error: 'Some poll text is too long.' }
  if (filled.length < 2) return { value: null, duplicate, error: 'Add at least two options.' }
  if (filled.length > POLL_MAX_OPTIONS) return { value: null, duplicate, error: `A poll can have at most ${POLL_MAX_OPTIONS} options.` }
  if (duplicate) return { value: null, duplicate, error: 'Options must be different.' }
  return { value: { question, options: filled, allow_multiple: draft.multiple }, duplicate, error: '' }
}
