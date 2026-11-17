import { origin } from '../../../core/api/client'
import { mediaUrl } from '../media/url'
import { fitSticker, type FavouriteSticker } from './model'
import type { FavouriteStorage, StarSource } from './favouriteStorage.types'
export type { FavouriteStorage, StarSource } from './favouriteStorage.types'

// Browsers have no OS-protected app storage (U-004): favourites live in this tab only, as object URLs.
const lists = new Map<string, FavouriteSticker[]>()
const blobs = new Map<string, string>()
const key = (owner: string, id: string) => owner + '\n' + id

async function toPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const size = fitSticker(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height
    const context = canvas.getContext('2d'); if (!context) throw Error('This browser cannot prepare stickers.')
    context.drawImage(bitmap, 0, 0, size.width, size.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(Error('The sticker could not be prepared.')), 'image/png'))
  } finally { bitmap.close() }
}

export const favouriteStorage: FavouriteStorage = {
  async read(owner) { return [...(lists.get(owner) ?? [])] },
  async write(owner, list) { lists.set(owner, [...list]) },
  async importImage(owner, id, source: StarSource) {
    const url = mediaUrl(source.path, origin)
    if (!url) throw Error('This image cannot be added to stickers.')
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) throw Error('The image could not be downloaded.')
    const png = await toPng(await response.blob())
    const uri = URL.createObjectURL(png)
    blobs.set(key(owner, id), uri)
    return { uri, size: png.size }
  },
  async removeImage(owner, item) { const uri = blobs.get(key(owner, item.id)); if (uri) { URL.revokeObjectURL(uri); blobs.delete(key(owner, item.id)) } },
  async retain(owner) {
    for (const name of [...lists.keys()]) if (name !== owner) lists.delete(name)
    for (const [name, uri] of [...blobs]) if (!owner || !name.startsWith(owner + '\n')) { URL.revokeObjectURL(uri); blobs.delete(name) }
  },
}
