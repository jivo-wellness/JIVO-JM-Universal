import { deviceCache, type DeviceCache } from '../storage/deviceCache'
import type { SessionCache } from './controller'
import type { Me } from './types'

const NAME = 'session.json'
/** The last profile the server confirmed (U-022). Holds no token or secret: the session cookie stays in the cookie store. */
export function createSessionCache(files: DeviceCache = deviceCache): SessionCache & { preload(): void } {
  // `preload` starts the file read before React mounts (U-031); the first `read` takes that result.
  let early: Promise<string | null> | null = null
  return {
    preload() { early ??= files.read(NAME).catch(() => null) },
    async read() {
      const pending = early; early = null
      const raw = await (pending ?? files.read(NAME))
      if (!raw) return null
      try {
        const saved = JSON.parse(raw) as { version?: number; me?: Me }
        const me = saved?.me
        if (saved.version !== 1 || !me || typeof me.id !== 'string' || !me.id || !Array.isArray(me.capabilities)) return null
        return me
      } catch { return null }
    },
    write: me => { early = null; return files.write(NAME, JSON.stringify({ version: 1, me })) },
    clear: () => { early = null; return files.remove(NAME) },
  }
}
export const sessionCache = createSessionCache()
