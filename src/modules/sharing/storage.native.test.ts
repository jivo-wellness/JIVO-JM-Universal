import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SharePayload } from 'expo-sharing'

const fx = vi.hoisted(() => ({
  raw: [] as SharePayload[],
  disk: new Map<string, string>(),
  dirs: new Set<string>(),
  providers: new Map<string, { name: string; data: string; type: string; size?: number }>(),
  uuid: 0,
  clear: { calls: 0 },
}))
vi.mock('expo-sharing', () => ({ getSharedPayloads: () => fx.raw, clearSharedPayloads: () => { fx.clear.calls++; fx.raw = [] } }))
vi.mock('expo-crypto', () => ({ randomUUID: () => `u${++fx.uuid}`, CryptoDigestAlgorithm: { SHA256: 'sha256' }, digestStringAsync: async (_a: string, value: string) => 'h' + value.length + ':' + value.slice(0, 40) }))
vi.mock('expo-file-system', () => {
  const base = (uri: string) => uri.replace(/\/$/, '').split('/').pop() ?? ''
  class Directory {
    uri: string
    constructor(parent: { uri: string } | string, name?: string) { this.uri = (typeof parent === 'string' ? parent : parent.uri + name) + '/' }
    get name() { return base(this.uri) }
    get exists() { return fx.dirs.has(this.uri) || [...fx.disk.keys()].some(key => key.startsWith(this.uri)) }
    create() { fx.dirs.add(this.uri) }
    delete() { for (const key of [...fx.disk.keys()]) if (key.startsWith(this.uri)) fx.disk.delete(key); for (const dir of [...fx.dirs]) if (dir.startsWith(this.uri)) fx.dirs.delete(dir) }
    list() {
      const names = new Map<string, Directory | File>()
      for (const key of fx.disk.keys()) if (key.startsWith(this.uri)) { const rest = key.slice(this.uri.length); const [head, ...tail] = rest.split('/'); names.set(head, tail.length ? new Directory(this, head) : new File(this, head)) }
      for (const dir of fx.dirs) if (dir !== this.uri && dir.startsWith(this.uri)) { const head = dir.slice(this.uri.length).split('/')[0]; if (!names.has(head)) names.set(head, new Directory(this, head)) }
      return [...names.values()]
    }
  }
  class File {
    uri: string
    constructor(parent: { uri: string } | string, name?: string) { this.uri = typeof parent === 'string' ? parent : parent.uri + name }
    get name() { return base(this.uri) }
    get parentDirectory() { return new Directory(this.uri.slice(0, this.uri.lastIndexOf('/'))) }
    get exists() { return fx.disk.has(this.uri) || fx.providers.has(this.uri) }
    get size() { const p = fx.providers.get(this.uri); return p ? p.size ?? p.data.length : (fx.disk.get(this.uri) ?? '').length }
    get type() { return fx.providers.get(this.uri)?.type ?? '' }
    async copy(to: Directory | File) {
      const p = fx.providers.get(this.uri); if (!p) throw Error('Permission denied')
      fx.disk.set(to instanceof Directory ? to.uri + p.name : to.uri, p.data)
    }
    async text() { return fx.disk.get(this.uri) ?? '' }
    async write(value: string) { fx.disk.set(this.uri, value) }
    async move(to: File) { fx.disk.set(to.uri, fx.disk.get(this.uri) ?? ''); fx.disk.delete(this.uri); this.uri = to.uri }
    delete() { fx.disk.delete(this.uri) }
  }
  return { Paths: { cache: { uri: 'file:///cache/' } }, Directory, File }
})

const provide = (uri: string, name: string, type: string, data = 'data', size?: number) => fx.providers.set(uri, { name, type, data, size })
const shareFiles = () => [...fx.disk.keys()].filter(key => key.startsWith('file:///cache/jm-share/share-')).sort()
async function load() { vi.resetModules(); return (await import('./storage.native')).incomingStorage }

beforeEach(() => { fx.raw = []; fx.disk.clear(); fx.dirs.clear(); fx.providers.clear(); fx.uuid = 0; fx.clear.calls = 0 })

describe('native share intake (Android content:// URIs)', () => {
  it('copies shared files into the app cache before sign-in, keeps them for whoever signs in, and clears the intent', async () => {
    provide('content://media/1', 'IMG_1.jpg', 'image/jpeg'); provide('content://docs/2', 'Report.pdf', 'application/pdf')
    fx.raw = [{ shareType: 'image', value: 'content://media/1', mimeType: 'image/jpeg' }, { shareType: 'file', value: 'content://docs/2', mimeType: 'application/pdf' }]
    const storage = await load()
    expect(await storage.capture()).toBe(true)
    expect(fx.raw).toEqual([]); expect(await storage.hasPending()).toBe(true)
    expect(shareFiles()).toEqual(['file:///cache/jm-share/share-u1/0/IMG_1.jpg', 'file:///cache/jm-share/share-u1/1/Report.pdf'])
    const share = await storage.read('alice')
    expect(share).toMatchObject({ owner: 'alice', text: '', notice: '' })
    expect(share?.files.map(f => [f.name, f.mime, f.uri])).toEqual([['IMG_1.jpg', 'image/jpeg', 'file:///cache/jm-share/share-u1/0/IMG_1.jpg'], ['Report.pdf', 'application/pdf', 'file:///cache/jm-share/share-u1/1/Report.pdf']])
    expect(await storage.read('bob')).toBeNull()
    expect(await storage.hasPending()).toBe(false); expect(shareFiles()).toEqual([])
  })
  it('takes text and links without touching the network or the file system', async () => {
    fx.raw = [{ shareType: 'url', value: 'https://a.test/page' }]
    const storage = await load()
    await storage.capture()
    expect(await storage.read('alice')).toMatchObject({ text: 'https://a.test/page', files: [] })
  })
  it('does not take the same intent twice, and a new share replaces the previous one and its files', async () => {
    provide('content://media/1', 'a.jpg', 'image/jpeg')
    const first: SharePayload[] = [{ shareType: 'image', value: 'content://media/1', mimeType: 'image/jpeg' }]
    fx.raw = first
    const storage = await load()
    expect(await storage.capture()).toBe(true)
    fx.raw = first
    expect(await storage.capture()).toBe(false)
    fx.raw = [{ shareType: 'text', value: 'Newer' }]
    expect(await storage.capture()).toBe(true)
    expect(shareFiles()).toEqual([])
    expect(await storage.read('alice')).toMatchObject({ text: 'Newer', files: [] })
  })
  it('refuses unknown types with a clear message and keeps none of their bytes', async () => {
    provide('content://x/1', 'tool.apk', 'application/vnd.android.package-archive')
    fx.raw = [{ shareType: 'file', value: 'content://x/1', mimeType: 'application/vnd.android.package-archive' }]
    const storage = await load()
    await storage.capture()
    expect(await storage.read('alice')).toMatchObject({ files: [], error: "tool.apk: apps and programs can't be sent in JM." })
    expect(shareFiles()).toEqual([])
  })
  it('leaves out a file over 500 MB without copying it, and files past the tenth', async () => {
    provide('content://v/big', 'big.mp4', 'video/mp4', 'x', 600 * 1024 * 1024)
    for (let i = 0; i < 11; i++) provide(`content://p/${i}`, `p${i}.jpg`, 'image/jpeg')
    fx.raw = [{ shareType: 'video', value: 'content://v/big' }, ...Array.from({ length: 11 }, (_, i) => ({ shareType: 'image' as const, value: `content://p/${i}` }))]
    const storage = await load()
    await storage.capture()
    const share = await storage.read('alice')
    expect(share?.files.map(f => f.name)).toEqual(['p0.jpg', 'p1.jpg', 'p2.jpg', 'p3.jpg', 'p4.jpg', 'p5.jpg', 'p6.jpg', 'p7.jpg', 'p8.jpg'])
    expect(share?.notice).toMatch(/larger than 500 MB.*Up to 10 files per message: 2 more were left out\./)
  })
  it('says so when the provider no longer lets JM read the file', async () => {
    fx.raw = [{ shareType: 'image', value: 'content://revoked/1', mimeType: 'image/jpeg' }]
    const storage = await load()
    await storage.capture()
    expect(await storage.read('alice')).toMatchObject({ error: 'JM could not read a shared file. Share it again from the other app.' })
  })
  it('deletes the copies after send/discard (by id) and on sign-out (everything, including a waiting intent)', async () => {
    provide('content://media/1', 'a.jpg', 'image/jpeg')
    fx.raw = [{ shareType: 'image', value: 'content://media/1' }]
    const storage = await load()
    await storage.capture()
    const share = await storage.read('alice')
    await storage.clear('another-id'); expect(shareFiles()).toHaveLength(1)
    await storage.clear(share!.id); expect(shareFiles()).toEqual([]); expect(await storage.hasPending()).toBe(false)
    fx.raw = [{ shareType: 'text', value: 'later' }]
    await storage.clear(); expect(fx.raw).toEqual([]); expect(await storage.hasPending()).toBe(false)
  })
  it('reports missing files when the system cleared the cache while JM was closed', async () => {
    provide('content://media/1', 'a.jpg', 'image/jpeg')
    fx.raw = [{ shareType: 'image', value: 'content://media/1' }]
    const storage = await load()
    await storage.capture()
    for (const key of shareFiles()) fx.disk.delete(key)
    expect(await storage.read('alice')).toMatchObject({ files: [], error: expect.stringMatching(/no longer on this device/) })
  })
})
