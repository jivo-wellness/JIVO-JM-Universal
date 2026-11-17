import type { PersonCard } from '../modules/messenger/api'

interface Self { id: string; name: string; email?: string; avatar_url?: string | null; employee_code?: string | null }

/** Reference PeoplePicker row subtitle: "email · company". */
export function personSubtitle(person: PersonCard) {
  return [person.email, person.company].filter(Boolean).join(' · ')
}

/**
 * The new-chat page's rows: "Message yourself" (direct chats only, when the search matches you) above the directory,
 * and the directory without yourself or repeats (cursor pages can overlap while someone is renamed).
 */
export function pickerRows(items: PersonCard[], me: Self | null | undefined, query: string, group: boolean): { self: PersonCard | null; people: PersonCard[] } {
  const term = query.trim().toLowerCase()
  const matches = !!me && (!term || `${me.name} ${me.email ?? ''} ${me.employee_code ?? ''} you`.toLowerCase().includes(term))
  const self = me && !group && matches ? { id: me.id, name: me.name, email: me.email, avatar_url: me.avatar_url ?? null, company: null, is_active: true } : null
  const seen = new Set<string>()
  const people = items.filter(person => { if (person.id === me?.id || seen.has(person.id)) return false; seen.add(person.id); return true })
  return { self, people }
}
