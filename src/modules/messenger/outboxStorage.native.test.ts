import { beforeEach, expect, it, vi } from 'vitest'
const secure = vi.hoisted(() => ({ values: new Map<string, string>(), get: vi.fn(), set: vi.fn(), remove: vi.fn() }))
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device', getItemAsync: secure.get, setItemAsync: secure.set, deleteItemAsync: secure.remove }))
vi.mock('expo-crypto', () => ({ randomUUID: () => crypto.randomUUID() }))
beforeEach(() => {
 vi.resetModules(); secure.values.clear(); vi.clearAllMocks()
 secure.get.mockImplementation(async (key: string) => secure.values.get(key) ?? null)
 secure.set.mockImplementation(async (key: string, value: string) => { secure.values.set(key, value) })
 secure.remove.mockImplementation(async (key: string) => { secure.values.delete(key) })
})
const entry = { owner: 'a', conversation: 'chat', payload: { client_id: 'one', body: 'Photo', upload_ids: [] }, created: 1, status: 'queued' as const }
it('reuses loaded metadata and skips a second removal without losing durable queue entries', async () => {
 const { outboxStorage: s } = await import('./outboxStorage.native')
 await s.read('a'); await s.put(entry, true); const reads = secure.get.mock.calls.length
 expect(await s.read()).toEqual([entry]); expect(secure.get).toHaveBeenCalledTimes(reads)
 await s.remove('a', 'one'); const writes = secure.set.mock.calls.length
 await s.remove('a', 'one'); expect(secure.set).toHaveBeenCalledTimes(writes)
 vi.resetModules(); const fresh = (await import('./outboxStorage.native')).outboxStorage
 expect(await fresh.read('a')).toEqual([])
})
it('does not publish a failed write to its memory cache and clears data on sign-out', async () => {
 const { outboxStorage: s } = await import('./outboxStorage.native')
 await s.read('a'); await s.put(entry, true)
 secure.set.mockRejectedValueOnce(Error('disk full'))
 await expect(s.put({ ...entry, status: 'sending' }, false)).rejects.toThrow('disk full')
 expect((await s.read())[0].status).toBe('queued')
 await s.clear(); expect(await s.read('b')).toEqual([])
 await expect(s.put(entry, true)).rejects.toThrow('different account')
})
