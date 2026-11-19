import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { Directory, File, Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'
import type { PickedFile } from './model'

/**
 * Photos & videos: the system gallery (Android photo picker, no storage permission) with multi-select, in the order
 * chosen, like the reference `accept="image/*,video/*" multiple` input. Assets are the picker's own cache copies,
 * which the caller disposes.
 */
export async function pickMedia(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return []
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: limit > 1, selectionLimit: limit, orderedSelection: true, quality: 1, exif: false, base64: false })
  if (result.canceled) return []
  return result.assets.slice(0, limit).map((asset, index) => {
    const video = asset.type === 'video' || asset.mimeType?.startsWith('video/')
    const file = new File(asset.uri)
    const dispose = () => { if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete() }
    return { name: asset.fileName || `${video ? 'video' : 'photo'}-${index + 1}.${video ? 'mp4' : 'jpg'}`, uri: asset.uri, mime: asset.mimeType || (video ? 'video/mp4' : 'image/jpeg'), size: asset.fileSize ?? file.size, dispose }
  })
}

/** Documents: several at once, each copied into its own cache folder (as `pickDocument` does) and sent as chosen. */
export async function pickDocuments(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return []
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: limit > 1, copyToCacheDirectory: false, base64: false })
  if (result.canceled) return []
  const owned: PickedFile[] = []
  try {
    for (const asset of result.assets.slice(0, limit)) {
      if (asset.size === undefined || !Number.isFinite(asset.size) || asset.size < 0) throw Error('The document provider did not report a valid file size.')
      if (!asset.uri.startsWith('file://') && !asset.uri.startsWith('content://')) throw Error('The provider did not return a local file.')
      const directory = new Directory(Paths.cache, 'jivo-picker-' + randomUUID()); directory.create()
      const dispose = () => { if (!directory.uri.startsWith(Paths.cache.uri)) throw Error('Unexpected picker cache path.'); if (directory.exists) directory.delete() }
      try {
        const copy = new File(directory, 'selected' + (asset.name.match(/\.[a-z0-9]{1,12}$/i)?.[0] ?? ''))
        await new File(asset.uri).copy(copy)
        owned.push({ name: asset.name, size: copy.size, mime: asset.mimeType || 'application/octet-stream', uri: copy.uri, dispose })
      } catch (e) { dispose(); throw e }
    }
    return owned
  } catch (e) {
    for (const file of owned) { try { await file.dispose?.() } catch { /* already gone */ } }
    throw e
  }
}
