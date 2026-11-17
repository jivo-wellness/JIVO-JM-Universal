import type { ConversationItem, PersonCard } from '../messenger/api'
import type { PickedFile } from '../messenger/media/model'
import { acceptFiles, fileKind, MAX_FILES } from '../messenger/media/selection'
import { SHARE_MAX_TEXT, SHARE_TTL, shareExpired, sharedText } from './shareTarget'

export { SHARE_MAX_TEXT, SHARE_TTL, sharedText }
/** Like WhatsApp's forward limit: one share goes to at most five chats. */
export const MAX_SHARE_TARGETS = 5
/** The largest file any kind may be (videos, `uploadLimitError`); bigger files are not even copied off the provider. */
export const MAX_SHARE_FILE_BYTES = 500 * 1024 * 1024

/**
 * What another app shared with JM, after intake: the text (title/text/link as one message) and the files, copied into
 * JM's own storage. `owner` is null until a signed-in account opens it; another account never sees it. `notice` says
 * which files were left out and why; `error` is set when nothing could be taken (the page shows it).
 */
export interface IncomingShare { id: string; owner: string | null; at: number; text: string; files: PickedFile[]; notice: string; error?: string }

/** A user-facing reason the share cannot be used. */
export class ShareProblem extends Error {}

const BLOCKED_NAME = /\.(apk|apks|aab|xapk|exe|msi|bat|cmd|com|scr|ps1|vbs|jar|sh|dll|dmg|pkg|ipa)$/i
const BLOCKED_MIME = /^application\/(vnd\.android\.package-archive|x-msdownload|x-msdos-program|x-msi|x-executable|x-elf|x-sh|x-shellscript|java-archive|x-java-archive|x-apple-diskimage)$/
/** PDF, office and other common document types; the server still scans every upload. */
const DOCUMENT_MIME = /^application\/(pdf|rtf|json|xml|zip|x-zip-compressed|gzip|x-gzip|x-tar|x-7z-compressed|x-rar-compressed|vnd\.rar|epub\+zip|msword|vnd\.ms-(excel|powerpoint|outlook|word)(\.[a-z0-9.]+)?|vnd\.openxmlformats-officedocument\.[a-z0-9.]+|vnd\.oasis\.opendocument\.[a-z0-9.]+|vnd\.apple\.(pages|numbers|keynote)|x-vcard|vcard|ics|csv)$/
const KNOWN_NAME = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|odp|zip|7z|rar|json|xml|vcf|ics|epub|pages|numbers|key|jpe?g|png|gif|webp|heic|heif|mp4|mov|m4v|webm|3gp|mp3|m4a|aac|ogg|opus|wav|amr)$/i

/**
 * Null when JM takes this kind of file from a share: photos, videos, audio, text and common documents (PDF, Word,
 * Excel, PowerPoint, OpenDocument, archives). Apps/programs and unknown binary types are refused with the file's name.
 */
export function shareTypeProblem(file: Pick<PickedFile, 'name' | 'mime'>): string | null {
  const mime = (file.mime || '').toLowerCase().split(';')[0].trim()
  if (BLOCKED_NAME.test(file.name) || BLOCKED_MIME.test(mime) || mime === 'text/javascript' || mime === 'application/javascript') return `${file.name}: apps and programs can't be sent in JM.`
  if (/^(image|video|audio|text)\/[a-z0-9.+-]+$/.test(mime) || DOCUMENT_MIME.test(mime)) return null
  if ((!mime || mime === 'application/octet-stream' || mime === '*/*') && KNOWN_NAME.test(file.name)) return null
  return `${file.name}: JM can't send this type of file (${mime || 'unknown type'}).`
}

/**
 * The share as JM will offer it: text joined (title/text/link), files of a type JM takes, then the composer's limits
 * (`acceptFiles`: up to 10 files, photos 10 MB, videos 500 MB). Throws a ShareProblem when nothing usable is left,
 * with every reason; otherwise the reasons for left-out files are in `notice`.
 */
export function normalizeShare(input: { texts: readonly unknown[]; files: PickedFile[]; notices?: string[]; dropped?: number }): { text: string; files: PickedFile[]; rejected: PickedFile[]; notice: string } {
  const text = sharedText(input.texts)
  if (text.length > SHARE_MAX_TEXT) throw new ShareProblem(`Shared text can be at most ${SHARE_MAX_TEXT} characters.`)
  const notices = [...(input.notices ?? [])]
  if (input.dropped) notices.push(`Up to ${MAX_FILES} files per message: ${input.dropped} more ${input.dropped === 1 ? 'was' : 'were'} left out.`)
  const typed: PickedFile[] = [], rejected: PickedFile[] = []
  for (const file of input.files) { const problem = shareTypeProblem(file); if (problem) { rejected.push(file); notices.push(problem) } else typed.push(file) }
  const limited = acceptFiles(0, typed)
  if (limited.notice) notices.push(limited.notice)
  if (!limited.accepted.length && !text) throw new ShareProblem(notices.length ? notices.join(' ') : 'Nothing to share. Share photos, videos, files or text from another app and choose JM.')
  return { text, files: limited.accepted, rejected: [...rejected, ...limited.rejected], notice: notices.join(' ') }
}

/** Whether a stored share is still usable by `owner`: not expired and not another account's. */
export function shareUsable(share: Pick<IncomingShare, 'at' | 'owner'>, owner: string, now = Date.now()): boolean {
  return !shareExpired(share.at, now) && (!share.owner || share.owner === owner)
}

/** A chat the share may go to: not locked, the server lets this person send there, and send files when there are files. */
export function shareable(chat: Pick<ConversationItem, 'locked' | 'can'>, files: boolean) { return !chat.locked && !!chat.can?.send && (!files || !!chat.can.send_file) }
/** Why a listed chat cannot be chosen (shown under its name). */
export function unshareableReason(chat: Pick<ConversationItem, 'locked' | 'can'>, files: boolean): string | null {
  if (shareable(chat, files)) return null
  if (chat.locked) return 'Locked chat'
  return chat.can?.send ? "Can't send files here" : "Can't send messages here"
}

/** One recipient on the "Send to…" page: an existing chat, or a person (their direct chat is opened on Send). */
export type ShareTarget = { key: string; title: string; kind: 'chat'; chat: ConversationItem } | { key: string; title: string; kind: 'person'; person: PersonCard }
export const chatTarget = (chat: ConversationItem): ShareTarget => ({ key: 'chat:' + chat.id, title: chat.title || chat.peer?.name || 'Chat', kind: 'chat', chat })
export const personTarget = (person: PersonCard, title = person.name): ShareTarget => ({ key: 'person:' + person.id, title, kind: 'person', person })

/** Select or unselect one recipient; a sixth is refused with the sentence to show. */
export function toggleTarget(list: readonly ShareTarget[], target: ShareTarget): { list: ShareTarget[]; notice: string } {
  if (list.some(item => item.key === target.key)) return { list: list.filter(item => item.key !== target.key), notice: '' }
  if (list.length >= MAX_SHARE_TARGETS) return { list: [...list], notice: `You can share with up to ${MAX_SHARE_TARGETS} chats.` }
  return { list: [...list, target], notice: '' }
}

/** People already listed as a direct chat (or yourself, listed as "Message yourself") are not shown twice. */
export function peopleWithoutChats(people: readonly PersonCard[], chats: readonly ConversationItem[], me?: string | null): PersonCard[] {
  const direct = new Set(chats.filter(chat => chat.kind === 'direct').map(chat => (chat.is_self ? me : chat.peer?.id)).filter((id): id is string => !!id))
  return people.filter(person => !direct.has(person.id))
}

/** "2 photos, 1 video" / "1 document" / "Text": the line under the "Send to…" title. */
export function shareSummary(share: Pick<IncomingShare, 'text' | 'files'>): string {
  const count = { image: 0, video: 0, file: 0 }
  for (const file of share.files) count[fileKind(file)]++
  const parts = ([['image', 'photo'], ['video', 'video'], ['file', 'file']] as const).filter(([kind]) => count[kind]).map(([kind, word]) => `${count[kind]} ${word}${count[kind] === 1 ? '' : 's'}`)
  if (!parts.length) return share.text ? (/^https?:\/\/\S+$/i.test(share.text) ? 'Link' : 'Text') : ''
  return parts.join(', ') + (share.text ? ' with text' : '')
}

/**
 * What the app does with a pending share for the current session: nothing to do; wait for sign-in (the share is kept,
 * and opens once someone signs in); open the share page; or stay (already there, or already opened once for this
 * share and closed). Sessions still loading, signing out or unreachable wait.
 */
export function shareStep(input: { pending: boolean; status: string; signedIn: boolean; path: string; opened: boolean }): 'idle' | 'wait' | 'open' | 'stay' {
  if (!input.pending) return 'idle'
  if (input.status !== 'ready' || !input.signedIn) return 'wait'
  if (input.path === '/share' || input.path.startsWith('/share/') || input.opened) return 'stay'
  return 'open'
}
