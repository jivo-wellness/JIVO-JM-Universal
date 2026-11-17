import { describe, expect, it, vi } from 'vitest'
import { uploadForm } from '../media/form'
import { createFavourites, favouriteFile } from './favourites'
import type { FavouriteStorage } from './favouriteStorage.types'
import { MAX_FAVOURITES, PACK_INFO, addFavourite, canStar, fitSticker, isStickerMessage, parseFavourites, searchPack, type FavouriteSticker } from './model'
// Hoisted above the imports by vitest.
vi.mock('expo-crypto', () => ({ randomUUID: () => 'unused' }))
vi.mock('./favouriteStorage', () => ({ favouriteStorage: {} }))

const fav = (n: number, source = `att-${n}`): FavouriteSticker => ({ id: `f${n}`, source, uri: `file:///s/f${n}.png`, mime: 'image/png', size: 10, addedAt: n })

describe('sticker model', () => {
  it('searches the pack by label and keyword word starts', () => {
    expect(searchPack(PACK_INFO, '').length).toBe(PACK_INFO.length)
    expect(searchPack(PACK_INFO, 'THANK').map(s => s.id)).toEqual(['thanks'])
    expect(searchPack(PACK_INFO, 'done').map(s => s.id)).toContain('star') // "well done"
    expect(searchPack(PACK_INFO, 'ea').map(s => s.id)).toEqual([]) // not inside a word ("tea", "great")
    expect(new Set(PACK_INFO.map(s => s.id)).size).toBe(PACK_INFO.length)
  })
  it('keeps one favourite per source, newest first, capped', () => {
    const many = Array.from({ length: MAX_FAVOURITES }, (_, i) => fav(i))
    const again = addFavourite(many, fav(99, 'att-5'))
    expect(again.list[0].id).toBe('f99')
    expect(again.list.filter(f => f.source === 'att-5')).toHaveLength(1)
    expect(again.dropped.map(f => f.id)).toEqual(['f5'])
    const overflow = addFavourite(many, fav(100))
    expect(overflow.list).toHaveLength(MAX_FAVOURITES)
    expect(overflow.dropped.map(f => f.id)).toEqual([`f${MAX_FAVOURITES - 1}`])
  })
  it('reads only well-formed saved entries', () => {
    expect(parseFavourites(null)).toEqual([])
    expect(parseFavourites('{bad')).toEqual([])
    expect(parseFavourites(JSON.stringify([fav(1), { ...fav(2), id: '../x' }, { ...fav(3), mime: 'image/svg+xml' }, 7]))).toEqual([fav(1)])
  })
  it('fits images inside 512 px without enlarging', () => {
    expect(fitSticker(1024, 512)).toEqual({ width: 512, height: 256 })
    expect(fitSticker(300, 200)).toEqual({ width: 300, height: 200 })
    expect(fitSticker(0, 0)).toEqual({ width: 512, height: 512 })
  })
  it('recognises sticker messages and starrable images', () => {
    const sticker = { kind: 'image', status: 'ready', sticker: true, preview_url: '/p', thumb_url: '/t' }
    const msg = { kind: 'attachment', body: '', deleted: false, attachments: [sticker] }
    expect(isStickerMessage(msg)).toBe(true)
    expect(isStickerMessage({ ...msg, body: 'caption' })).toBe(false)
    expect(isStickerMessage({ ...msg, deleted: true })).toBe(false)
    expect(isStickerMessage({ ...msg, attachments: [sticker, sticker] })).toBe(false)
    expect(isStickerMessage({ ...msg, attachments: [{ ...sticker, sticker: undefined }] })).toBe(false)
    expect(canStar(sticker)).toBe(true)
    expect(canStar({ ...sticker, kind: 'video' })).toBe(false)
    expect(canStar({ ...sticker, status: 'processing' })).toBe(false)
  })
})

function memoryStorage() {
  const lists = new Map<string, FavouriteSticker[]>(); const files = new Set<string>()
  const storage: FavouriteStorage = {
    read: async owner => [...(lists.get(owner) ?? [])],
    write: async (owner, list) => { lists.set(owner, [...list]) },
    importImage: vi.fn(async (owner: string, id: string) => { files.add(`${owner}/${id}`); return { uri: `file:///${owner}/${id}.png`, size: 42 } }),
    removeImage: async (owner, item) => { files.delete(`${owner}/${item.id}`) },
    retain: vi.fn(async (owner: string | null) => { for (const k of [...lists.keys()]) if (k !== owner) lists.delete(k); for (const f of [...files]) if (!owner || !f.startsWith(owner + '/')) files.delete(f) }),
  }
  return { storage, lists, files }
}

describe('favourite stickers', () => {
  it('stars, re-stars, removes and wipes per account', async () => {
    const { storage, lists, files } = memoryStorage(); let n = 0
    const favs = createFavourites(storage, () => `id${++n}`)
    await expect(favs.star('a1', { path: '/api/jm/files/a1/?v=large' })).rejects.toThrow('Sign in')
    await favs.bind('alice')
    await favs.star('a1', { path: '/api/jm/files/a1/?v=large' })
    await favs.star('a2', { path: '/api/jm/files/a2/?v=large' })
    await favs.star('a1', { path: '/api/jm/files/a1/?v=large' })
    expect(favs.snapshot().list.map(f => f.source)).toEqual(['a1', 'a2'])
    expect([...files].sort()).toEqual(['alice/id2', 'alice/id3']) // the first copy of a1 was removed
    expect(favs.has('a2')).toBe(true)
    await favs.remove(favs.snapshot().list[1].id)
    expect(lists.get('alice')?.map(f => f.source)).toEqual(['a1'])
    expect(favouriteFile(favs.snapshot().list[0])).toMatchObject({ mime: 'image/png', sticker: true, size: 42 })
    await favs.bind(null, true) // session restore keeps the files
    expect(files.size).toBe(1)
    await favs.bind('alice')
    expect(favs.snapshot()).toMatchObject({ owner: 'alice', loaded: true })
    expect(favs.snapshot().list).toHaveLength(1)
    await favs.bind('bob') // another account: alice's favourites are deleted
    expect(files.size).toBe(0)
    await favs.bind(null)
    expect(storage.retain).toHaveBeenLastCalledWith(null)
  })
  it('a session end waits for a star in progress, then deletes it', async () => {
    const { storage, files } = memoryStorage()
    const favs = createFavourites(storage, () => 'late')
    await favs.bind('alice')
    let release!: () => void
    vi.mocked(storage.importImage).mockImplementationOnce(async (owner, id) => { await new Promise<void>(r => { release = r }); files.add(`${owner}/${id}`); return { uri: 'file:///late.png', size: 1 } })
    const starring = favs.star('a1', { path: '/x' })
    const ending = favs.bind(null)
    await vi.waitFor(() => expect(release).toBeDefined()); release()
    await starring; await ending
    expect(favs.snapshot().list).toEqual([])
    expect(files.size).toBe(0)
  })
})

describe('sticker upload form', () => {
  it('flags stickers on attachment uploads only', () => {
    const file = new File([new Uint8Array([1])], 'jm-sticker-ok.png', { type: 'image/png' })
    const picked = { name: file.name, mime: 'image/png', size: 1, uri: 'blob:x', file }
    expect(uploadForm({ ...picked, sticker: true }).get('sticker')).toBe('1')
    expect(uploadForm(picked).get('sticker')).toBeNull()
    expect(uploadForm({ ...picked, sticker: true }, 'avatar').get('sticker')).toBeNull()
  })
})
