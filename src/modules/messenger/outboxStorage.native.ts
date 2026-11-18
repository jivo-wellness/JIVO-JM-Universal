import * as SecureStore from 'expo-secure-store'
import { randomUUID } from 'expo-crypto'
import { SecureSnapshot } from '../../core/storage/secureSnapshot'
import type { OutboxStorage, PendingSend } from './outboxController'

const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
const snapshot = new SecureSnapshot({
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
}, 'jm.outbox.v1', randomUUID)
let owner: string | null = null
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(work: () => Promise<T>): Promise<T> {
  const pending = queue.catch(() => {}).then(work); queue = pending; return pending
}
let cached: PendingSend[] | null = null
async function store(next: PendingSend[]) {
  await snapshot.write(JSON.stringify(next))
  cached = next
}
async function rows(): Promise<PendingSend[]> {
  if (cached) return cached
  const value: unknown = JSON.parse(await snapshot.read() ?? '[]')
  if (!Array.isArray(value)) throw Error('Invalid protected outbox')
  cached = value as PendingSend[]
  return cached
}
export const outboxStorage: OutboxStorage = {
  read: nextOwner => serial(async () => {
    const saved = await rows()
    if (nextOwner) {
      if (saved.some(entry => entry.owner !== nextOwner)) await store(saved.filter(entry => entry.owner === nextOwner))
      owner = nextOwner
    }
    return saved.filter(entry => entry.owner === owner)
  }),
  put: (entry, create) => serial(async () => {
    if (entry.owner !== owner) throw Error('Outbox belongs to a different account')
    const saved = [...await rows()]
    const index = saved.findIndex(row => row.owner === entry.owner && row.payload.client_id === entry.payload.client_id)
    if (index >= 0) saved[index] = entry
    else if (create) saved.push(entry)
    await store(saved)
  }),
  remove: (account, client) => serial(async () => {
    const saved = await rows()
    const next = saved.filter(row => row.owner !== account || row.payload.client_id !== client)
    if (next.length !== saved.length) await store(next)
  }),
  clear: () => serial(async () => { owner = null; await snapshot.clear(); cached = [] }),
}
export const outboxStorageNotice = 'Unsent messages are protected on this device until sent or discarded, and cleared on sign-out.'
