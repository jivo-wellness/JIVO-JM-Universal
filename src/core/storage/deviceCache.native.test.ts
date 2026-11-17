import { beforeEach, expect, it, vi } from 'vitest'
import { cacheName, deviceCache } from './deviceCache.native'
const disk = vi.hoisted(() => new Map<string, string>())
vi.mock('expo-file-system', () => {
  class Directory {
    uri: string
    constructor(base: { uri: string }, name: string) { this.uri = base.uri + name + '/' }
    get exists() { return [...disk.keys()].some(key => key.startsWith(this.uri)) }
    create() {}
    list() { return [...disk.keys()].filter(key => key.startsWith(this.uri)).map(key => new File(this, key.slice(this.uri.length))) }
  }
  class File {
    uri: string; name: string
    constructor(base: { uri: string }, name: string) { this.uri = base.uri + name; this.name = name }
    get exists() { return disk.has(this.uri) }
    async text() { return disk.get(this.uri) ?? '' }
    async write(value: string) { disk.set(this.uri, value) }
    async move(to: File) { disk.set(to.uri, disk.get(this.uri) ?? ''); disk.delete(this.uri); this.uri = to.uri }
    delete() { disk.delete(this.uri) }
  }
  return { Paths: { document: { uri: 'file:///docs/' } }, Directory, File }
})
beforeEach(() => disk.clear())
it('writes through a temporary file, reads back and clears all but the kept names', async () => {
  await deviceCache.write('session.json', '{"a":1}')
  await deviceCache.write(cacheName('chats', 'alice'), 'A'); await deviceCache.write(cacheName('chats', 'bob'), 'B')
  expect([...disk.keys()].some(key => key.endsWith('.tmp'))).toBe(false)
  expect(await deviceCache.read('session.json')).toBe('{"a":1}')
  await deviceCache.clear(name => name === cacheName('chats', 'bob'))
  expect(await deviceCache.read(cacheName('chats', 'bob'))).toBe('B'); expect(await deviceCache.read(cacheName('chats', 'alice'))).toBeNull(); expect(await deviceCache.read('session.json')).toBeNull()
  await deviceCache.clear(); expect(disk.size).toBe(0)
})
it('derives safe file names from server ids', () => {
  expect(cacheName('chats', '../x/y')).toMatch(/^chats-[A-Za-z0-9_.-]+\.json$/)
})
