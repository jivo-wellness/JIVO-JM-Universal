import type { PickedFile } from './model'
export function uploadForm(asset: PickedFile, purpose: 'attachment' | 'avatar' | 'background' | 'group_avatar' | 'ticket' = 'attachment') {
  const form = new FormData()
  // React Native's multipart networking accepts a URI descriptor instead of browser File.
  form.append('file', { uri: asset.uri, name: asset.name, type: asset.mime } as unknown as Blob)
  form.append('purpose', purpose)
  if (asset.sticker && purpose === 'attachment') form.append('sticker', '1')
  if (asset.mime.startsWith('audio/') && Number.isFinite(asset.durationMs) && asset.durationMs! > 0) form.append('duration_ms', String(Math.round(asset.durationMs!)))
  return form
}
