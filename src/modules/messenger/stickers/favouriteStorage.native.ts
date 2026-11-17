import { Directory, File, Paths } from 'expo-file-system'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { origin } from '../../../core/api/client'
import { authenticatedMediaSource } from '../media/source'
import { mediaUrl } from '../media/url'
import { fitSticker, parseFavourites, type FavouriteSticker } from './model'
import type { FavouriteStorage, StarSource } from './favouriteStorage.types'
export type { FavouriteStorage, StarSource } from './favouriteStorage.types'

// App-private storage (like the chat cache, U-022): one folder per account, deleted when the session ends.
const root = new Directory(Paths.document, 'jm-stickers')
const segment = (value: string) => 'id-' + encodeURIComponent(value)
const ownerDir = (owner: string) => new Directory(root, segment(owner))
const index = (owner: string) => new File(ownerDir(owner), 'index.json')
const image = (owner: string, id: string) => new File(ownerDir(owner), `${id}.png`)

export const favouriteStorage: FavouriteStorage = {
  async read(owner) {
    const file = index(owner)
    if (!file.exists) return []
    // Entries whose image is gone (cleared storage) are dropped; uris are rebuilt from the id (the app folder can move).
    return parseFavourites(await file.text()).map(f => ({ ...f, uri: image(owner, f.id).uri })).filter(f => new File(f.uri).exists)
  },
  async write(owner, list) {
    const dir = ownerDir(owner); dir.create({ intermediates: true, idempotent: true })
    const temp = new File(dir, 'index.json.tmp'); if (temp.exists) temp.delete()
    await temp.write(JSON.stringify(list))
    await temp.move(index(owner), { overwrite: true })
  },
  async importImage(owner, id, source: StarSource) {
    const url = mediaUrl(source.path, origin)
    if (!url) throw Error('This image cannot be added to stickers.')
    const { headers } = await authenticatedMediaSource(url)
    const download = new File(Paths.cache, `jm-sticker-${id}.download`)
    if (download.exists) download.delete()
    const context = ImageManipulator.manipulate((await File.downloadFileAsync(url, download, { headers, idempotent: true })).uri)
    let probe; let result
    try {
      probe = await context.renderAsync()
      const size = fitSticker(probe.width, probe.height)
      if (size.width !== probe.width) context.reset().resize(size)
      result = await context.renderAsync()
      // PNG keeps transparency (stickers) and is what the server accepts for a sticker.
      const saved = await result.saveAsync({ format: SaveFormat.PNG })
      const dir = ownerDir(owner); dir.create({ intermediates: true, idempotent: true })
      const target = image(owner, id)
      new File(saved.uri).move(target)
      return { uri: target.uri, size: target.size }
    } finally {
      probe?.release(); result?.release(); context.release()
      if (download.exists) download.delete()
    }
  },
  async removeImage(owner, item: FavouriteSticker) { const file = image(owner, item.id); if (file.exists) file.delete() },
  async retain(owner) { if (!root.exists) return; for (const item of root.list()) if (!owner || item.name !== segment(owner)) item.delete() },
}
