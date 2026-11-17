import type { PickedFile } from './model'
export function uploadForm(asset: PickedFile, purpose: 'attachment' | 'avatar' | 'background' | 'group_avatar' = 'attachment') {
  if (!asset.file) throw new Error('The browser did not return a readable file.')
  const form = new FormData(); form.append('file', asset.file); form.append('purpose', purpose)
  if (asset.sticker && purpose === 'attachment') form.append('sticker', '1')
  return form
}
