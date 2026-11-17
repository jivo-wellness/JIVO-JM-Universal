import type { DeviceCache } from './deviceCache.types'
export { cacheName, type DeviceCache } from './deviceCache.types'
// Browsers have no OS-protected app storage equivalent; keep the cache in this tab only (U-004).
const files = new Map<string, string>()
export const deviceCache: DeviceCache = {
  read: async name => files.get(name) ?? null,
  write: async (name, value) => { files.set(name, value) },
  remove: async name => { files.delete(name) },
  clear: async keep => { for (const name of [...files.keys()]) if (!keep?.(name)) files.delete(name) },
}
