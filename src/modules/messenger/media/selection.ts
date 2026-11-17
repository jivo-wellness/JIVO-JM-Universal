import { uploadLimitError, type PickedFile } from './model'
import type { PhoneContact } from './contactModel'
import { phoneKey } from '../lib/vcard'

/** Reference Composer MAX_FILES: up to 10 files per message. */
export const MAX_FILES = 10

export type FileKind = 'image' | 'video' | 'file'
export function fileKind(file: Pick<PickedFile, 'mime' | 'name'>): FileKind {
  if (file.mime.startsWith('image/') || (!file.mime || file.mime === 'application/octet-stream') && /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name)) return 'image'
  if (file.mime.startsWith('video/') || (!file.mime || file.mime === 'application/octet-stream') && /\.(mp4|m4v|mov|webm|3gp)$/i.test(file.name)) return 'video'
  return 'file'
}
/** Reference MediaPreview `extensionOf`: up to 6 upper-case letters, or FILE. */
export function extensionOf(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toUpperCase().slice(0, 6) : 'FILE'
}
/** GIFs are not edited (reference); everything else that is an image can be. */
export const editable = (file: Pick<PickedFile, 'mime' | 'name'>) => fileKind(file) === 'image' && file.mime !== 'image/gif'

/**
 * Files chosen for one message: keep what fits within MAX_FILES and the size limits, and say why the rest was left out
 * (reference addFiles: "Up to 10 files per message." and the per-file limit errors).
 */
export function acceptFiles(existing: number, files: PickedFile[]): { accepted: PickedFile[]; rejected: PickedFile[]; notice: string } {
  const room = Math.max(0, MAX_FILES - existing)
  const inRoom = files.slice(0, room), overflow = files.slice(room)
  const notices: string[] = []
  if (overflow.length) notices.push(`Up to ${MAX_FILES} files per message.`)
  const accepted: PickedFile[] = [], rejected: PickedFile[] = [...overflow]
  for (const file of inRoom) {
    const error = uploadLimitError(file)
    if (error) { rejected.push(file); notices.push(`${file.name}: ${error}`) } else accepted.push(file)
  }
  return { accepted, rejected, notice: notices.join(' ') }
}

/** Which item to show after `key` is removed: the next one, else the previous one. */
export function nextSelection(keys: string[], removed: string, selected: string): string | null {
  const rest = keys.filter(key => key !== removed)
  if (!rest.length) return null
  if (selected !== removed) return selected
  const index = keys.indexOf(removed)
  return rest[Math.min(index, rest.length - 1)]
}

/** Send-button label of the reference MediaPreview. */
export const sendFilesLabel = (count: number) => `Send ${count} file${count === 1 ? '' : 's'}`

// ---------------------------------------------------------------------------- phone contacts

export interface DeviceContact extends PhoneContact { id: string }

const digits = (value: string) => value.replace(/\D+/g, '')
/** Name, email or (ignoring spaces and punctuation) phone number contains the search. */
export function matchContact(contact: PhoneContact, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (contact.name.toLowerCase().includes(q) || contact.emails.some(email => email.toLowerCase().includes(q))) return true
  const qd = digits(q)
  return qd.length >= 3 && contact.phones.some(phone => digits(phone).includes(qd))
}
/** The secondary line of a contact row: phones then emails, as in the reference "Chosen contacts" list. */
export const contactSummary = (contact: PhoneContact) => [...contact.phones, ...contact.emails].join(' · ')
/** Shareable contacts have a name and a phone or email; empty values are dropped and at most 5 of each kept. */
const unique = (values: string[], key: (value: string) => string) => values.filter((value, i) => values.findIndex(other => key(other) === key(value)) === i)
export function cleanContact<T extends PhoneContact>(contact: T): T | null {
  // Address books often hold the same number twice ("+91 82872 73160" and "+918287273160"): send each once.
  const phones = unique(contact.phones.map(p => p.trim()).filter(Boolean), phoneKey).slice(0, 5)
  const emails = unique(contact.emails.map(e => e.trim()).filter(Boolean), e => e.toLowerCase()).slice(0, 5)
  const name = contact.name.trim() || phones[0] || emails[0] || ''
  if (!name || (!phones.length && !emails.length)) return null
  return { ...contact, name: name.slice(0, 80), phones, emails }
}
/** Reference vcardFile file name: the contact's name without path characters, at most 60 characters. */
export const vcardName = (contact: PhoneContact) => (contact.name.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Contact') + '.vcf'
/** Reference PhoneContactForm: a name and a phone or email. */
export function typedContact(form: { name: string; phone: string; email: string }): PhoneContact | null {
  if (!form.name.trim()) return null
  return cleanContact({ name: form.name.trim(), phones: [form.phone], emails: [form.email] })
}
/** Toggle one contact in a multi-select (by id), up to MAX_FILES (each contact is one vCard file). */
export function toggleChosen(chosen: string[], id: string): string[] {
  if (chosen.includes(id)) return chosen.filter(value => value !== id)
  return chosen.length >= MAX_FILES ? chosen : [...chosen, id]
}
export const sendContactsLabel = (count: number) => `Send ${count === 1 ? 'contact' : `${count} contacts`}`
