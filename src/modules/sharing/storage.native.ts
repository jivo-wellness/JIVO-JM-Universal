import * as Sharing from 'expo-sharing'
import * as Crypto from 'expo-crypto'
import { Directory, File, Paths } from 'expo-file-system'
import type { PickedFile } from '../messenger/media/model'
import { MAX_SHARE_FILE_BYTES, normalizeShare, shareUsable, ShareProblem, type IncomingShare } from './model'
import { SHARE_MAX_FILES, shareExpired } from './shareTarget'
import { shareFileName, shareMime, splitNativeShare } from './nativePayload'
import { incomingShareChanged } from './events'
import type { IncomingStorage } from './storage'

/**
 * Android (and iOS, through the share extension) hand JM a share as an intent that expo-sharing keeps in memory
 * (`getSharedPayloads`: content:// URIs and text, read without any network). `capture` copies each file off the
 * provider into JM's cache (`jm-share/share-<uuid>/<n>/<display name>`, app-private) while the provider's read grant
 * is valid, writes `jm-share/pending.json` and then clears the intent, so the share survives the sign-in, the app lock
 * and a restart of the app. Sending copies the files into the outbox; send, discard and sign-out delete the folder.
 */
const root = () => new Directory(Paths.cache, 'jm-share')
const pendingFile = () => new File(root(), 'pending.json')
interface Stored { v: 1; id: string; owner: string | null; at: number; text: string; notice: string; error?: string; folder: string; files: { name: string; size: number; mime: string; uri: string }[] }

let epoch = 0
let serial: Promise<unknown> = Promise.resolve()
function locked<T>(work: () => Promise<T>) { const next = serial.catch(() => undefined).then(work); serial = next; return next }

function parse(text: string): Stored | null {
  try {
    const value = JSON.parse(text) as Stored
    if (value?.v !== 1 || typeof value.id !== 'string' || !Array.isArray(value.files) || typeof value.text !== 'string' || typeof value.folder !== 'string') return null
    return value
  } catch { return null }
}
async function readStored(): Promise<Stored | null> { const file = pendingFile(); return file.exists ? parse(await file.text()) : null }
async function writeStored(value: Stored) {
  const dir = root(); dir.create({ intermediates: true, idempotent: true })
  const temp = new File(dir, 'pending.json.tmp'); if (temp.exists) temp.delete()
  await temp.write(JSON.stringify(value))
  await temp.move(pendingFile(), { overwrite: true })
}
/** Share folders other than `keep` (older shares, or all of them), leaving pending.json. */
function wipeFolders(keep?: string) {
  const dir = root(); if (!dir.exists) return
  for (const item of dir.list()) { if (item.name === keep || item.name === 'pending.json') continue; try { item.delete() } catch { /* already gone */ } }
}
/** The pending share and every copied file. */
function wipe() { const dir = root(); try { if (dir.exists) dir.delete() } catch { wipeFolders(); try { pendingFile().delete() } catch { /* already gone */ } } }
function clearRaw(raw: ReturnType<typeof Sharing.getSharedPayloads>) {
  // A newer intent may have arrived while this one was being copied: clear the slot only if it still holds this one.
  if (JSON.stringify(Sharing.getSharedPayloads()) === JSON.stringify(raw)) Sharing.clearSharedPayloads()
}
const toShare = (value: Stored): IncomingShare => ({ id: value.id, owner: value.owner, at: value.at, text: value.text, notice: value.notice, ...(value.error ? { error: value.error } : {}), files: value.files.map(file => ({ ...file })) })

/** Copies one shared file into its own numbered folder; the copy keeps the provider's display name. */
async function copyIn(folder: Directory, index: number, source: { uri: string; mime: string }): Promise<PickedFile | string> {
  const original = new File(source.uri)
  const size = Number(original.size ?? 0)
  if (size > MAX_SHARE_FILE_BYTES) return `A shared file is larger than ${MAX_SHARE_FILE_BYTES / 1024 / 1024} MB and was left out.`
  const slot = new Directory(folder, String(index)); slot.create({ intermediates: true, idempotent: true })
  try { await original.copy(slot) } catch { throw new ShareProblem('JM could not read a shared file. Share it again from the other app.') }
  const copy = slot.list().find((entry): entry is File => entry instanceof File)
  if (!copy || !copy.exists) throw new ShareProblem('JM could not read a shared file. Share it again from the other app.')
  const name = shareFileName(copy.name, index)
  let type: string | undefined
  try { type = (original as unknown as { type?: string }).type } catch { type = undefined }
  return { name, size: copy.size ?? size, mime: shareMime(name, source.mime, type), uri: copy.uri }
}

export const incomingStorage: IncomingStorage = {
  capture() {
    return locked(async () => {
      const raw = Sharing.getSharedPayloads()
      if (!raw.length) return false
      const current = epoch
      const id = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(raw))
      const previous = await readStored()
      if (previous?.id === id) { clearRaw(raw); return false }
      const folder = new Directory(root(), 'share-' + Crypto.randomUUID())
      let value: Stored
      try {
        folder.create({ intermediates: true, idempotent: true })
        const { texts, files: sources } = splitNativeShare(raw)
        const files: PickedFile[] = []; const notices: string[] = []
        // Files past the tenth are not even copied off the provider.
        for (const [index, source] of sources.slice(0, SHARE_MAX_FILES).entries()) {
          const result = await copyIn(folder, index, source)
          if (typeof result === 'string') notices.push(result); else files.push(result)
        }
        const share = normalizeShare({ texts, files, notices, dropped: Math.max(0, sources.length - SHARE_MAX_FILES) })
        for (const file of share.rejected) { try { new File(file.uri).parentDirectory.delete() } catch { /* best effort */ } }
        value = { v: 1, id, owner: null, at: Date.now(), text: share.text, notice: share.notice, folder: folder.name, files: share.files.map(({ name, size, mime, uri }) => ({ name, size, mime, uri })) }
      } catch (error) {
        try { if (folder.exists) folder.delete() } catch { /* best effort */ }
        const message = error instanceof ShareProblem ? error.message : 'JM could not receive this share. Try sharing it again.'
        value = { v: 1, id, owner: null, at: Date.now(), text: '', notice: '', error: message, folder: '', files: [] }
      }
      if (current !== epoch) { try { if (folder.exists) folder.delete() } catch { /* best effort */ } return false }
      await writeStored(value)
      // A new share replaces the previous one (as in WhatsApp): its copied files go now.
      wipeFolders(value.folder || undefined)
      clearRaw(raw)
      incomingShareChanged()
      return true
    })
  },
  read(owner) {
    const current = epoch
    return locked(async () => {
      const stored = await readStored()
      if (!stored || current !== epoch) return null
      if (!shareUsable(stored, owner)) { wipe(); incomingShareChanged(); return null }
      if (stored.files.some(file => !new File(file.uri).exists)) {
        // The system may clear the cache while JM is closed.
        wipeFolders()
        stored.files = []; stored.error = 'The shared files are no longer on this device. Share them again from the other app.'
        await writeStored(stored)
      }
      if (!stored.owner) { stored.owner = owner; await writeStored(stored) }
      return current === epoch ? toShare(stored) : null
    })
  },
  clear(id) {
    if (!id) ++epoch
    return locked(async () => {
      if (!id) { Sharing.clearSharedPayloads(); wipe(); incomingShareChanged(); return }
      const stored = await readStored()
      if (stored && stored.id !== id) return
      wipe(); incomingShareChanged()
    })
  },
  hasPending() {
    return locked(async () => {
      if (Sharing.getSharedPayloads().length > 0) return true
      const stored = await readStored()
      return !!stored && !shareExpired(stored.at, Date.now())
    })
  },
}
