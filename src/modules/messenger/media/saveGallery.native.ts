import { File, Paths } from 'expo-file-system'
import * as Library from 'expo-media-library/legacy'
import { randomUUID } from 'expo-crypto'

export async function saveGallery(blob: Blob, name: string, current: () => boolean) {
  const permission = await Library.requestPermissionsAsync(true)
  if (!permission.granted) throw Error('Allow photo access in device settings to save to your gallery.')
  if (!current()) throw Error('Saving cancelled.')
  const file = new File(Paths.cache, randomUUID() + '-' + name.replace(/[^a-z0-9._-]/gi, '_'))
  try {
    const encoded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(Error('Could not read the media.'))
      reader.onabort = () => reject(Error('Saving cancelled.'))
      reader.onload = () => { const value = reader.result; if (typeof value !== 'string' || !/^data:[^,]*;base64,/.test(value)) { reject(Error('Could not read the media.')); return }; resolve(value.slice(value.indexOf(',') + 1)) }
      reader.readAsDataURL(blob)
    })
    await file.write(encoded, { encoding: 'base64' })
    if (!current()) throw Error('Saving cancelled.')
    await Library.saveToLibraryAsync(file.uri)
  } finally { if (file.exists) file.delete() }
}
