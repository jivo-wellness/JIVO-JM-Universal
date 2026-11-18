/** Inspect actual bytes, not a keyboard-supplied filename. Keep animated GIF bytes unchanged. */
export function keyboardImageType(bytes: Uint8Array): { extension: string; mime: string } | null {
 const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
 if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return { extension: 'gif', mime: 'image/gif' }
 if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return { extension: 'png', mime: 'image/png' }
 if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension: 'jpg', mime: 'image/jpeg' }
 if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' }
 return null
}
