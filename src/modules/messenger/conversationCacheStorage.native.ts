import * as SecureStore from 'expo-secure-store'
import { randomUUID } from 'expo-crypto'
import { SecureSnapshot } from '../../core/storage/secureSnapshot'
import { conversationCacheFiles as files } from './conversationCacheFiles'
import type { CacheStorage } from './conversationCacheController'
// Before the file cache, recent history lived in chunked SecureStore records ("jm.history.v1"). Remove them once.
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
let legacy: Promise<void> | null = null
const dropLegacy = () => legacy ??= new SecureSnapshot({
  get: key => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: key => SecureStore.deleteItemAsync(key, options),
}, 'jm.history.v1', randomUUID).clear().catch(() => {})
export const conversationCacheStorage: CacheStorage = {
  read: owner => { void dropLegacy(); return files.read(owner) },
  write: (owner, value) => files.write(owner, value),
  clear: async keep => { await files.clear(keep); await dropLegacy() },
}
