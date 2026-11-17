import type { IncomingStorage } from './storage'
import type { PickedFile } from '../messenger/media/model'
import { normalizeShare, shareUsable, ShareProblem, type IncomingShare } from './model'
import { SHARE_DB, shareExpired, type StashedShare } from './shareTarget'
import { incomingShareChanged } from './events'

/**
 * The installed PWA's Web Share Target: the service worker (`pwa/incoming-share.ts`) stashes the POSTed files and text
 * in IndexedDB (`jm-incoming-share-v1`, key `incoming`) and redirects to /share, which reads it here. Nothing goes to
 * Cache Storage. `boundary` is bumped on sign-out so a POST still in flight cannot bring a share back.
 */
export { SHARE_DB }
type Stored = StashedShare<File> & { caption?: string; error?: string }
function open() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(SHARE_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore('pending'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function transact<T>(action: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => { const transaction = db.transaction('pending', 'readwrite'); let result: T; action(transaction.objectStore('pending'), value => { result = value }); transaction.oncomplete = () => { db.close(); resolve(result) }; transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error ?? Error('Incoming share storage is unavailable.')) } })
}
const picked = (file: File): PickedFile => ({ name: file.name || 'Shared file', size: file.size, mime: file.type || 'application/octet-stream', uri: '', file })
/** The stored record as the share the page offers (types and limits applied; a share with nothing usable carries the reason). */
export function webShare(value: Stored): IncomingShare {
  const base = { id: value.id, owner: value.owner, at: value.at }
  if (value.error) return { ...base, text: '', files: [], notice: '', error: value.error }
  try {
    const share = normalizeShare({ texts: [value.text ?? value.caption ?? ''], files: (value.files ?? []).map(picked), dropped: value.dropped })
    return { ...base, text: share.text, files: share.files, notice: share.notice }
  } catch (error) {
    return { ...base, text: '', files: [], notice: '', error: error instanceof ShareProblem ? error.message : 'This share could not be received. Try sharing it again.' }
  }
}
export const incomingStorage: IncomingStorage = {
  async capture() { return false },
  async read(owner) {
    return transact<IncomingShare | null>((store, done) => {
      const request = store.get('incoming')
      request.onsuccess = () => {
        const value = request.result as Stored | undefined
        if (!value) { done(null); return }
        if (!shareUsable(value, owner)) { store.delete('incoming'); done(null); return }
        if (!value.owner) { value.owner = owner; store.put(value, 'incoming') }
        done(webShare(value))
      }
    })
  },
  async clear(id) {
    await transact<void>((store, done) => {
      if (!id) { const boundary = store.get('boundary'); boundary.onsuccess = () => store.put(Number(boundary.result || 0) + 1, 'boundary') }
      const request = store.get('incoming')
      request.onsuccess = () => { if (!id || (request.result as Stored | undefined)?.id === id) store.delete('incoming'); done() }
    })
    incomingShareChanged()
  },
  async hasPending() {
    return transact<boolean>((store, done) => {
      const request = store.get('incoming')
      request.onsuccess = () => { const value = request.result as Stored | undefined; if (value && shareExpired(value.at, Date.now())) { store.delete('incoming'); done(false) } else done(Boolean(value)) }
    })
  },
}
