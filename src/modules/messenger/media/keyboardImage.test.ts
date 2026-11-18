import { expect, it } from 'vitest'
import { keyboardImageType } from './keyboardImage'
import { editable, acceptFiles } from './selection'
const bytes = (text: string) => new TextEncoder().encode(text)
it.each(['GIF87a', 'GIF89a'])('preserves %s as a GIF and prevents still-image editing', signature => {
 const original = bytes(signature + 'animated frames')
 const before = original.slice()
 const type = keyboardImageType(original)!
 expect(type).toEqual({ extension: 'gif', mime: 'image/gif' })
 expect(original).toEqual(before)
 const file = { name: 'keyboard.gif', mime: type.mime, size: 500, uri: 'file:///cache/test.gif' }
 expect(editable(file)).toBe(false)
 expect(acceptFiles(0, [file]).accepted).toEqual([file])
 expect(acceptFiles(10, [file]).rejected).toEqual([file])
})
it('recognizes keyboard images and rejects unsupported data', () => {
 expect(keyboardImageType(new Uint8Array([137,80,78,71,13,10,26,10]))?.mime).toBe('image/png')
 expect(keyboardImageType(new Uint8Array([255,216,255]))?.mime).toBe('image/jpeg')
 expect(keyboardImageType(bytes('RIFF0000WEBP'))?.mime).toBe('image/webp')
 expect(keyboardImageType(bytes('<html>not an image'))).toBeNull()
 expect(keyboardImageType(new Uint8Array())).toBeNull()
})
