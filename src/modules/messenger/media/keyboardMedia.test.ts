import { keyboardMedia } from './keyboardMedia'
import { beforeEach, expect, it, vi } from 'vitest'
const fixtures = vi.hoisted(() => new Map<string, { bytes: Uint8Array; size: number; exists: boolean }>())
vi.mock('expo-crypto', () => ({ randomUUID: () => 'test-id' }))
vi.mock('expo-file-system', () => ({
 Paths: { cache: { uri: 'file:///cache/' } },
 File: class {
  constructor(public uri: string) {}
  get exists() { return fixtures.get(this.uri)?.exists ?? false }
  get size() { return fixtures.get(this.uri)?.size ?? 0 }
  async bytes() { return fixtures.get(this.uri)!.bytes }
  delete() { fixtures.get(this.uri)!.exists = false }
 },
}))
beforeEach(() => fixtures.clear())
const add = (name: string, size = 20, signature = 'GIF89a') => {
 const uri = 'file:///cache/' + name
 fixtures.set(uri, { bytes: new TextEncoder().encode(signature), size, exists: true })
 return uri
}
it('keeps the original GIF URI and bytes until preview/outbox releases it', async () => {
 const uri = add('keyboard-file')
 const [file] = await keyboardMedia([uri, uri])
 expect(file).toMatchObject({ name: 'keyboard-test-id.gif', mime: 'image/gif', uri, size: 20 })
 expect(fixtures.get(uri)!.exists).toBe(true)
 await file.dispose?.()
 expect(fixtures.get(uri)!.exists).toBe(false)
})
it('cleans a rejected batch and enforces image size limits', async () => {
 const first = add('first.gif'), tooBig = add('big.gif', 11 * 1024 * 1024)
 await expect(keyboardMedia([first, tooBig])).rejects.toThrow('10 MB')
 expect(fixtures.get(first)!.exists).toBe(false)
 expect(fixtures.get(tooBig)!.exists).toBe(false)
})
it('rejects empty, non-image and external files', async () => {
 await expect(keyboardMedia([add('empty.gif', 0)])).rejects.toThrow('empty')
 await expect(keyboardMedia([add('bad.gif', 20, '<html>')])).rejects.toThrow('format')
 await expect(keyboardMedia(['https://example.com/test.gif'])).rejects.toThrow('local image')
})
