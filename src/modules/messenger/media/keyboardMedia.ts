import { File, Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'
import type { PickedFile } from './model'
import { keyboardImageType } from './keyboardImage'

/** Native receiver creates local cache files before its temporary keyboard permission expires. */
export async function keyboardMedia(uris: string[]): Promise<PickedFile[]> {
 const owned = [...new Set(uris)].map(uri => {
  if (!uri.startsWith(Paths.cache.uri) || uri.includes('/../')) throw Error('The keyboard did not provide a local image.')
  return new File(uri)
 })
 try {
  const result: PickedFile[] = []
  for (const file of owned) {
   if (!file.exists || file.size <= 0) throw Error('The keyboard image is empty. Please choose it again.')
   if (file.size > 10 * 1024 * 1024) throw Error('Keyboard images can be at most 10 MB.')
   const type = keyboardImageType(await file.bytes())
   if (!type) throw Error('This keyboard image format is not supported.')
   result.push({ name: `keyboard-${randomUUID()}.${type.extension}`, mime: type.mime, size: file.size, uri: file.uri, dispose: () => { if (file.exists) file.delete() } })
  }
  return result
 } catch (error) {
  for (const file of owned) { try { if (file.exists) file.delete() } catch { /* Cache may already be removed. */ } }
  throw error
 }
}
