import { expect, it } from 'vitest'
import { createSessionCache } from './sessionCache'
import type { DeviceCache } from '../storage/deviceCache'
import type { Me } from './types'
const files = () => { const map = new Map<string, string>(); const cache: DeviceCache = { read: async n => map.get(n) ?? null, write: async (n, v) => { map.set(n, v) }, remove: async n => { map.delete(n) }, clear: async () => map.clear() }; return { map, cache } }
it('round-trips the last confirmed profile and discards damaged or foreign data', async () => {
  const f = files(); const cache = createSessionCache(f.cache)
  const me = { id: 'u1', capabilities: ['JM_ACCESS'] } as unknown as Me
  expect(await cache.read()).toBeNull()
  await cache.write(me); expect(await cache.read()).toEqual(me)
  f.map.set('session.json', '{broken'); expect(await cache.read()).toBeNull()
  f.map.set('session.json', JSON.stringify({ version: 2, me })); expect(await cache.read()).toBeNull()
  f.map.set('session.json', JSON.stringify({ version: 1, me: { id: 'u1' } })); expect(await cache.read()).toBeNull()
  await cache.write(me); await cache.clear(); expect(await cache.read()).toBeNull(); expect(f.map.size).toBe(0)
})
it('preload starts the read before React mounts and the first read takes it (U-031)', async () => {
  const f = files(); const me = { id: 'u1', capabilities: [] } as unknown as Me
  f.map.set('session.json', JSON.stringify({ version: 1, me }))
  let reads = 0; const counted: DeviceCache = { ...f.cache, read: async n => { reads++; return f.cache.read(n) } }
  const cache = createSessionCache(counted)
  cache.preload(); cache.preload(); expect(reads).toBe(1)
  expect(await cache.read()).toEqual(me); expect(reads).toBe(1)
  await cache.clear(); expect(await cache.read()).toBeNull(); expect(reads).toBe(2)
})
