import { Asset } from 'expo-asset'
import { File as LocalFile } from 'expo-file-system'
import { Platform } from 'react-native'
import type { PickedFile } from '../media/model'
import { PACK_INFO, type StickerInfo } from './model'

/** Bundled images of the built-in pack (original JM artwork, scripts/stickers/make-stickers.py). */
const images: Record<string, number> = {
  hi: require('../../../../assets/stickers/hi.png'),
  smile: require('../../../../assets/stickers/smile.png'),
  laugh: require('../../../../assets/stickers/laugh.png'),
  love: require('../../../../assets/stickers/love.png'),
  wink: require('../../../../assets/stickers/wink.png'),
  wow: require('../../../../assets/stickers/wow.png'),
  sad: require('../../../../assets/stickers/sad.png'),
  heart: require('../../../../assets/stickers/heart.png'),
  thanks: require('../../../../assets/stickers/thanks.png'),
  ok: require('../../../../assets/stickers/ok.png'),
  done: require('../../../../assets/stickers/done.png'),
  star: require('../../../../assets/stickers/star.png'),
  party: require('../../../../assets/stickers/party.png'),
  chai: require('../../../../assets/stickers/chai.png'),
}

export type PackSticker = StickerInfo & { image: number }
export const jmPack: PackSticker[] = PACK_INFO.map(info => ({ ...info, image: images[info.id] }))

/** The bundled PNG as a file the outbox can queue (native: a local copy from expo-asset; browser: a File). */
export async function packStickerFile(sticker: PackSticker): Promise<PickedFile> {
  const asset = Asset.fromModule(sticker.image)
  const name = `jm-sticker-${sticker.id}.png`
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob()
    const file = new File([blob], name, { type: 'image/png' })
    return { name, mime: 'image/png', size: blob.size, uri: asset.uri, file, sticker: true }
  }
  await asset.downloadAsync()
  if (!asset.localUri) throw Error('The sticker could not be loaded.')
  return { name, mime: 'image/png', size: new LocalFile(asset.localUri).size, uri: asset.localUri, sticker: true }
}
