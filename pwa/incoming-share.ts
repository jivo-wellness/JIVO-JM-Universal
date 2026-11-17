/// <reference lib="webworker" />
export {}
declare const self: ServiceWorkerGlobalScope
// Inlined before this file from src/modules/sharing/shareTarget.ts by scripts/build-web.cts (share-worker.js).
declare const SHARE_DB: string
declare function shareBodyTooLarge(contentLength: string | null | undefined): boolean
declare function shareIntake<F extends { size: number }>(form: { get(name: string): unknown; getAll(name: string): unknown[] }, isFile: (value: unknown) => value is F): { ok: true; text: string; files: F[]; dropped: number } | { ok: false; reason: 'limit' | 'empty' | 'retry' }
declare function shareRedirect(error?: 'limit' | 'empty' | 'retry'): string
declare function mayStash(boundaryAtStart: number, boundaryNow: unknown): boolean

/**
 * Web Share Target (manifest `share_target`, POST multipart to /share-target): the installed PWA receives photos,
 * videos, documents, text and links from other apps. The files and text go to IndexedDB (never Cache Storage), then
 * the browser is sent to /share (303), where the app opens "Send to…". A newer share replaces an older one; a sign-out
 * during the POST (boundary bumped by the app) drops it.
 */
function openDb() { return new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(SHARE_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore('pending'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
function boundaryOf(db: IDBDatabase) { return new Promise<number>((resolve, reject) => { const request = db.transaction('pending').objectStore('pending').get('boundary'); request.onsuccess = () => resolve(Number(request.result || 0)); request.onerror = () => reject(request.error) }) }
class Refused extends Error { constructor(readonly reason: 'limit' | 'empty' | 'retry') { super(reason) } }
async function readForm(request: Request) {
  if (shareBodyTooLarge(request.headers.get('content-length'))) throw new Refused('limit')
  const reader = request.body?.getReader()
  if (!reader) throw new Refused('empty')
  const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0
  while (true) {
    const part = await reader.read(); if (part.done) break
    size += part.value.byteLength
    if (shareBodyTooLarge(String(size))) { await reader.cancel(); throw new Refused('limit') }
    chunks.push(new Uint8Array(part.value))
  }
  return new Response(new Blob(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData()
}
async function owner(): Promise<string | null> {
  try {
    const response = await fetch('/api/jm/me/', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const me = await response.json() as { id?: unknown }
    return typeof me.id === 'string' ? me.id : null
  } catch { return null /* offline or signed out: the app binds it to whoever signs in */ }
}
self.addEventListener('fetch', event => {
  const request = event.request; const url = new URL(request.url)
  if (request.method !== 'POST' || url.origin !== self.location.origin || url.pathname !== '/share-target') return
  event.respondWith((async () => {
    let db: IDBDatabase | undefined
    try {
      db = await openDb(); const boundary = await boundaryOf(db)
      const intake = shareIntake(await readForm(request), (value): value is File => value instanceof File)
      if (!intake.ok) throw new Refused(intake.reason)
      const record = { id: crypto.randomUUID(), owner: await owner(), at: Date.now(), text: intake.text, files: intake.files, dropped: intake.dropped }
      await new Promise<void>((resolve, reject) => {
        const transaction = db!.transaction('pending', 'readwrite'); const store = transaction.objectStore('pending')
        const check = store.get('boundary')
        check.onsuccess = () => { if (!mayStash(boundary, check.result)) { transaction.abort(); return } store.put(record, 'incoming') }
        transaction.oncomplete = () => resolve()
        transaction.onerror = transaction.onabort = () => reject(new Refused('retry'))
      })
      return Response.redirect(new URL(shareRedirect(), self.location.origin).href, 303)
    } catch (error) {
      return Response.redirect(new URL(shareRedirect(error instanceof Refused ? error.reason : 'retry'), self.location.origin).href, 303)
    } finally { db?.close() }
  })())
})
