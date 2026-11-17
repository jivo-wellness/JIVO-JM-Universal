import { randomUUID } from 'expo-crypto'
import type { PickedFile } from '../media/model'
import { favouriteStorage } from './favouriteStorage'
import type { FavouriteStorage, StarSource } from './favouriteStorage.types'
import { addFavourite, type FavouriteSticker } from './model'

export interface FavouriteState { owner: string | null; list: FavouriteSticker[]; loaded: boolean }

/**
 * The signed-in person's favourite stickers on this device (WhatsApp's "Favourites"): bound to one account,
 * wiped when the session ends (Session boundary), newest first. Work is serialised so a star, a removal and a
 * session change never interleave.
 */
export function createFavourites(storage: FavouriteStorage, newId: () => string = randomUUID) {
  let state: FavouriteState = { owner: null, list: [], loaded: false }
  const listeners = new Set<(state: FavouriteState) => void>()
  let queue: Promise<unknown> = Promise.resolve()
  const run = <T>(work: () => Promise<T>): Promise<T> => { const next = queue.then(work); queue = next.catch(() => undefined); return next }
  const publish = (next: FavouriteState) => { state = next; listeners.forEach(fn => fn(state)) }
  return {
    snapshot: () => state,
    subscribe(fn: (state: FavouriteState) => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    /** Session ready (owner) or ended (null, also deletes the files unless `preserve`, a restore in progress). */
    bind(owner: string | null, preserve = false) {
      return run(async () => {
        if (owner === state.owner && state.loaded) return
        publish({ owner, list: [], loaded: !owner })
        if (!owner) { if (!preserve) await storage.retain(null); return }
        await storage.retain(owner)
        const list = await storage.read(owner)
        if (state.owner === owner) publish({ owner, list, loaded: true })
      })
    },
    /** Star an image from a chat; starring the same attachment again moves it to the front. */
    star(source: string, from: StarSource) {
      return run(async () => {
        const owner = state.owner
        if (!owner) throw Error('Sign in to keep stickers.')
        const id = newId()
        const saved = await storage.importImage(owner, id, from)
        const { list, dropped } = addFavourite(state.list, { id, source, uri: saved.uri, mime: 'image/png', size: saved.size, addedAt: Date.now() })
        await storage.write(owner, list)
        for (const item of dropped) await storage.removeImage(owner, item)
        publish({ owner, list, loaded: true })
      })
    },
    remove(id: string) {
      return run(async () => {
        const owner = state.owner; const item = state.list.find(f => f.id === id)
        if (!owner || !item) return
        const list = state.list.filter(f => f.id !== id)
        await storage.write(owner, list)
        await storage.removeImage(owner, item)
        publish({ owner, list, loaded: true })
      })
    },
    has: (source: string) => state.list.some(f => f.source === source),
  }
}

export const favouriteStickers = createFavourites(favouriteStorage)

/** A favourite as a file the outbox can queue (the outbox keeps its own copy). */
export const favouriteFile = (f: FavouriteSticker): PickedFile => ({ name: `sticker-${f.id.slice(0, 8)}.png`, mime: 'image/png', size: f.size, uri: f.uri, sticker: true })
