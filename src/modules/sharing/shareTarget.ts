/**
 * Incoming-share intake rules shared by the app and the PWA service worker. `scripts/build-web.cts` inlines this
 * file into `share-worker.js` (exports stripped), so it must stay free of imports and of DOM/React Native APIs.
 */

/** IndexedDB database the worker stashes a Web Share Target POST in (separate from the public shell cache). */
export const SHARE_DB = 'jm-incoming-share-v1'
/** Reference Composer MAX_FILES; must equal `MAX_FILES` in `messenger/media/selection.ts` (checked by a test). */
export const SHARE_MAX_FILES = 10
/** The message body limit of the composer and the server. */
export const SHARE_MAX_TEXT = 4000
/**
 * The browser hands the whole multipart body to the worker, which buffers it before storing; this bounds that memory.
 * Native shares are copied file by file and have no total cap beyond the per-file limits.
 */
export const SHARE_INTAKE_BYTES = 100 * 1024 * 1024
/** Time to sign in (and unlock) before a pending share is dropped. */
export const SHARE_TTL = 60 * 60 * 1000

export interface FormLike { get(name: string): unknown; getAll(name: string): unknown[] }
export interface BlobLike { size: number; name?: string; type?: string }
export type ShareIntakeError = 'limit' | 'empty' | 'retry'
export type ShareIntake<F> = { ok: true; text: string; files: F[]; dropped: number } | { ok: false; reason: ShareIntakeError }
/** What the worker keeps in IndexedDB under the key `incoming`. */
export interface StashedShare<F> { id: string; owner: string | null; at: number; text: string; files: F[]; dropped: number }

/**
 * Title, text and URL as one message: trimmed, repeats dropped, and a part already contained in another part left out
 * (apps often send the link both as `url` and inside `text`).
 */
export function sharedText(parts: readonly unknown[]): string {
  const unique = [...new Set(parts.map(part => (typeof part === 'string' ? part.trim() : '')).filter(Boolean))]
  return unique.filter(part => !unique.some(other => other !== part && other.includes(part))).join('\n')
}

/** A declared body larger than the intake cap (plus room for the multipart framing) is refused before reading it. */
export function shareBodyTooLarge(contentLength: string | null | undefined): boolean {
  const length = Number(contentLength || 0)
  return Number.isFinite(length) && length > SHARE_INTAKE_BYTES + 65536
}

/**
 * The share target's form (`title`, `text`, `url`, `files`) as one pending share. Up to SHARE_MAX_FILES files are kept
 * (the rest are counted in `dropped` so the app can say so); empty files are ignored. Too much text or too many bytes
 * is refused (`limit`), and nothing usable is `empty`. File types are checked later by the app, which can say which
 * file was left out and why.
 */
export function shareIntake<F extends BlobLike>(form: FormLike, isFile: (value: unknown) => value is F): ShareIntake<F> {
  const all = form.getAll('files').filter(isFile).filter(file => file.size > 0)
  const text = sharedText(['title', 'text', 'url'].map(key => form.get(key)))
  const files = all.slice(0, SHARE_MAX_FILES)
  if (text.length > SHARE_MAX_TEXT || files.reduce((sum, file) => sum + file.size, 0) > SHARE_INTAKE_BYTES) return { ok: false, reason: 'limit' }
  if (!files.length && !text) return { ok: false, reason: 'empty' }
  return { ok: true, text, files, dropped: all.length - files.length }
}

/** Where the worker sends the browser after the POST (303): the share page, with the reason if nothing was kept. */
export function shareRedirect(error?: ShareIntakeError): string {
  return error ? `/share?shareError=${error}` : '/share'
}

/** The sentence the share page shows for a refused intake. */
export function shareIntakeMessage(reason: unknown): string {
  if (reason === 'limit') return `JM can take up to ${SHARE_MAX_FILES} files and ${SHARE_INTAKE_BYTES / 1024 / 1024} MB at a time, and ${SHARE_MAX_TEXT} characters of text. Share fewer or smaller files, or attach them from the chat.`
  if (reason === 'empty') return 'Nothing was shared. Share photos, videos, files or text from another app and choose JM.'
  return 'This share could not be received. Try sharing it again.'
}

/** A stored share is kept for SHARE_TTL; a time in the future (clock change) is treated as just now. */
export function shareExpired(at: unknown, now: number): boolean {
  return typeof at !== 'number' || !Number.isFinite(at) || now - at > SHARE_TTL || at > now + 60_000
}

/**
 * Whether a share POST may still be written: a sign-out between the start of the POST and the write bumps the
 * boundary, and the stale POST must not bring a share back for the next person. A newer share always replaces an
 * older one (as in WhatsApp, the last thing shared is what JM opens with).
 */
export function mayStash(boundaryAtStart: number, boundaryNow: unknown): boolean {
  return Number(boundaryNow || 0) === boundaryAtStart
}
