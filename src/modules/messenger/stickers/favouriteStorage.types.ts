import type { FavouriteSticker } from './model'

/** Where a starred image comes from: a same-origin JM file path (the attachment's large or small preview). */
export interface StarSource { path: string }

export interface FavouriteStorage {
  read(owner: string): Promise<FavouriteSticker[]>
  write(owner: string, list: FavouriteSticker[]): Promise<void>
  /** Downloads the image, scales it to fit 512 px and keeps it as a PNG on this device. */
  importImage(owner: string, id: string, source: StarSource): Promise<{ uri: string; size: number }>
  removeImage(owner: string, item: FavouriteSticker): Promise<void>
  /** Deletes every account's favourites except `owner`'s (all of them for null). */
  retain(owner: string | null): Promise<void>
}
