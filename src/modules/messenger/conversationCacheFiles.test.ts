import { expect, it } from 'vitest'
import { conversationCacheFiles } from './conversationCacheFiles'
import { deviceCache } from '../../core/storage/deviceCache'
it('keeps one file per account and only touches chat files when clearing', async () => {
  await deviceCache.write('session.json', 'profile')
  await conversationCacheFiles.write('alice', 'A'); await conversationCacheFiles.write('bob', 'B')
  await conversationCacheFiles.clear('bob')
  expect(await conversationCacheFiles.read('alice')).toBeNull(); expect(await conversationCacheFiles.read('bob')).toBe('B')
  expect(await deviceCache.read('session.json')).toBe('profile')
  await conversationCacheFiles.clear(); expect(await conversationCacheFiles.read('bob')).toBeNull()
})
