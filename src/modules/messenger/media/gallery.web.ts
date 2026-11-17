import * as DocumentPicker from 'expo-document-picker'
import type { PickedFile } from './model'

const owned = (file: File, uri: string): PickedFile => ({ name: file.name, uri, file, mime: file.type || 'application/octet-stream', size: file.size, dispose: () => { if (uri.startsWith('blob:')) URL.revokeObjectURL(uri) } })

/** Browser gallery: a multi-file chooser limited to photos and videos (reference `accept="image/*,video/*" multiple`). */
export async function pickMedia(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return []
  const picker = await import('expo-image-picker')
  const result = await picker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: limit > 1, selectionLimit: limit, quality: 1 })
  if (result.canceled) return []
  const files: PickedFile[] = []
  for (const asset of result.assets) {
    if (asset.file && files.length < limit) files.push(owned(asset.file, asset.uri))
    else if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri)
  }
  return files
}

export async function pickDocuments(limit: number): Promise<PickedFile[]> {
  if (limit <= 0) return []
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: limit > 1, copyToCacheDirectory: false, base64: false })
  if (result.canceled) return []
  const files: PickedFile[] = []
  for (const asset of result.assets) {
    if (asset.file && files.length < limit) files.push(owned(asset.file, asset.uri))
    else if (asset.uri.startsWith('blob:')) URL.revokeObjectURL(asset.uri)
  }
  return files
}
