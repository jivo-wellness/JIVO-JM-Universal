import { Directory, File, Paths } from 'expo-file-system'
import type { DeviceCache } from './deviceCache.types'
export { cacheName, type DeviceCache } from './deviceCache.types'
// App-private storage (Android internal storage / iOS Documents, excluded from other apps). SecureStore is kept for
// small secrets: its values are limited to about 2 KB on Android, too small for a chat list.
const root = () => new Directory(Paths.document, 'jm-cache')
const file = (name: string) => new File(root(), name)
export const deviceCache: DeviceCache = {
  async read(name) { const f = file(name); return f.exists ? await f.text() : null },
  async write(name, value) {
    const dir = root(); dir.create({ intermediates: true, idempotent: true })
    // Write a sibling first, then swap, so an interrupted write never leaves a half file under the real name.
    const temp = file(name + '.tmp'); if (temp.exists) temp.delete()
    await temp.write(value)
    await temp.move(file(name), { overwrite: true })
  },
  async remove(name) { const f = file(name); if (f.exists) f.delete() },
  async clear(keep) {
    const dir = root(); if (!dir.exists) return
    for (const item of dir.list()) if (!keep?.(item.name)) item.delete()
  },
}
