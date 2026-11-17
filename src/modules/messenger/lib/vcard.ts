/** Phone contacts shared in a chat travel as a small vCard (.vcf) file through the normal, virus-scanned upload. */

export interface PhoneContact {
  name: string
  phones: string[]
  emails: string[]
}

const escape = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)
const unescape = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1')

export function buildVCard(c: PhoneContact): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escape(c.name.trim())}`, `N:${escape(c.name.trim())};;;;`]
  const phones = c.phones.map((x) => x.trim()).filter(Boolean)
  for (const p of phones.filter((x, i) => phones.findIndex((y) => phoneKey(y) === phoneKey(x)) === i)) lines.push(`TEL;TYPE=CELL:${escape(p)}`)
  for (const e of c.emails.map((x) => x.trim()).filter(Boolean)) lines.push(`EMAIL:${escape(e)}`)
  lines.push('END:VCARD')
  return lines.join('\r\n') + '\r\n'
}

/** One number on a card: the text as written and the vCard TYPE shown as a label ("Mobile", "Work"…), if any. */
export interface ContactPhone {
  number: string
  label?: string
}

/** A card as shown in the chat: numbers (each distinct number once, with its label) and emails. */
export interface ContactDetails {
  name: string
  phones: ContactPhone[]
  emails: string[]
}

// The first TYPE in this order names the number; VOICE, PREF, OTHER and unknown types add no label.
const PHONE_LABELS: [string, string][] = [
  ['FAX', 'Fax'],
  ['PAGER', 'Pager'],
  ['CELL', 'Mobile'],
  ['MOBILE', 'Mobile'],
  ['IPHONE', 'iPhone'],
  ['MAIN', 'Main'],
  ['WORK', 'Work'],
  ['HOME', 'Home'],
]
function phoneLabel(params: string[]): string | undefined {
  const types = new Set(params.flatMap((p) => p.replace(/^TYPE=/i, '').split(',')).map((t) => t.trim().replace(/^"|"$/g, '').toUpperCase()))
  return PHONE_LABELS.find(([type]) => types.has(type))?.[1]
}

/** "+91 82872-73160", "+918287273160" and "tel:+91 (82872) 73160" are the same number. */
export const phoneKey = (n: string) => n.replace(/^tel:/i, '').replace(/[^\d+]/g, '') || n.trim().toLowerCase()

/** The first card in the text; unknown lines are ignored. Values are plain text (never HTML). Repeated numbers and emails are shown once. */
export function parseVCardDetails(text: string): ContactDetails {
  // Unfold continuation lines (RFC 6350 §3.2).
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const out: ContactDetails = { name: '', phones: [], emails: [] }
  let structured = ''
  for (const line of lines) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const [rawKey, ...params] = line.slice(0, i).split(';')
    const key = rawKey!.toUpperCase().replace(/^ITEM\d+\./, '')
    const value = unescape(line.slice(i + 1)).trim()
    if (!value) continue
    if (key === 'FN' && !out.name) out.name = value
    else if (key === 'N' && !structured) structured = value.split(';').filter(Boolean).reverse().join(' ')
    else if (key === 'TEL') {
      const number = value.replace(/^tel:/i, '').trim()
      const label = phoneLabel(params)
      const same = out.phones.find((p) => phoneKey(p.number) === phoneKey(number))
      if (same) same.label ??= label
      else if (number && out.phones.length < 5) out.phones.push(label ? { number, label } : { number })
    } else if (key === 'EMAIL' && out.emails.length < 5 && !out.emails.some((e) => e.toLowerCase() === value.toLowerCase())) out.emails.push(value)
    if (key === 'END') break
  }
  if (!out.name) out.name = structured || out.phones[0]?.number || out.emails[0] || 'Contact'
  return out
}

/** The first card in the text as name, numbers and emails (each distinct number once). */
export function parseVCard(text: string): PhoneContact {
  const c = parseVCardDetails(text)
  return { name: c.name, phones: c.phones.map((p) => p.number), emails: c.emails }
}

/** The number to dial: digits and a leading +. */
export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`

export function vcardFile(c: PhoneContact): File {
  const safe = c.name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Contact'
  return new File([buildVCard(c)], `${safe}.vcf`, { type: 'text/vcard' })
}

export const isVCard = (a: { mime: string; name: string }) => a.mime === 'text/vcard' || /\.vcf$/i.test(a.name)

interface ContactsManager {
  select(props: string[], opts?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]>
}

/** The phone's own contact picker (Chrome on Android). Desktop browsers do not have one. */
export function phoneContactsSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && typeof window !== 'undefined' && 'ContactsManager' in window
}

export async function pickPhoneContacts(): Promise<PhoneContact[]> {
  const manager = (navigator as unknown as { contacts: ContactsManager }).contacts
  const picked = await manager.select(['name', 'tel', 'email'], { multiple: true })
  return picked
    .map((p) => ({ name: p.name?.[0] ?? '', phones: p.tel ?? [], emails: p.email ?? [] }))
    .filter((p) => p.name || p.phones.length || p.emails.length)
    .map((p) => ({ ...p, name: p.name || p.phones[0] || p.emails[0] || 'Contact' }))
}
