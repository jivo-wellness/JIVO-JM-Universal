import type { SharePayload } from 'expo-sharing'
import { ShareProblem } from './model'

const FILE_TYPES = ['file', 'image', 'audio', 'video']
/** Only files on this device (a provider's content:// or a file://) are taken; web links stay text and are never fetched. */
export const localShareUri = (uri: string) => /^(?:file|content):\/\//i.test(uri)

/**
 * The raw Android/iOS share payloads (`Sharing.getSharedPayloads()`, no network) split into text parts and file
 * sources. A "file" that is not local is refused with a clear message instead of being downloaded.
 */
export function splitNativeShare(raw: readonly SharePayload[]): { texts: string[]; files: { uri: string; mime: string }[] } {
  const texts: string[] = [], files: { uri: string; mime: string }[] = []
  for (const item of raw) {
    const value = typeof item?.value === 'string' ? item.value : ''
    if (!FILE_TYPES.includes(item?.shareType ?? '')) { if (value.trim()) texts.push(value); continue }
    if (!localShareUri(value)) throw new ShareProblem('Only files on this device can be shared to JM. Share web links as text.')
    files.push({ uri: value, mime: (item.mimeType || '').toLowerCase() })
  }
  return { texts, files }
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', opus: 'audio/opus', wav: 'audio/wav', amr: 'audio/amr',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv', vcf: 'text/vcard', ics: 'text/calendar', zip: 'application/zip', json: 'application/json',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}
/** The provider's type, else the file system's, else one from the file name; never a wildcard. */
export function shareMime(name: string, ...candidates: (string | null | undefined)[]): string {
  for (const value of candidates) { const mime = (value || '').toLowerCase().split(';')[0].trim(); if (mime && !mime.includes('*') && mime !== 'application/octet-stream') return mime }
  return EXTENSION_MIME[name.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1] ?? ''] ?? 'application/octet-stream'
}

/** A file name the provider gave, safe to keep: no path parts or control characters, at most 120 characters. */
export function shareFileName(name: string | null | undefined, index: number): string {
  const clean = (name || '').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').trim()
  if (!clean) return `Shared file ${index + 1}`
  if (clean.length <= 120) return clean
  const extension = clean.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? ''
  return clean.slice(0, 120 - extension.length) + extension
}
