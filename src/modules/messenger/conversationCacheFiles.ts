import { cacheName, deviceCache } from '../../core/storage/deviceCache'
import type { CacheStorage } from './conversationCacheController'
const PREFIX = 'chats'
/** One file per account; binding an account removes every other account's file. */
export const conversationCacheFiles: CacheStorage = {
  read: owner => deviceCache.read(cacheName(PREFIX, owner)),
  write: (owner, value) => deviceCache.write(cacheName(PREFIX, owner), value),
  clear: keep => deviceCache.clear(keep ? name => !name.startsWith(PREFIX + '-') || name === cacheName(PREFIX, keep) : name => !name.startsWith(PREFIX + '-')),
}
