import type { AttachActions } from '../../components/attach/AttachMenu'

export const ATLAS_TEXT_ONLY_REASON = 'Atlas currently accepts text only. Files, camera, voice messages and other message tools are unavailable.'
const unavailable = () => {}

/** Preserve the chat menu without exposing unsupported upload or device actions. */
export const atlasTextOnlyActions: AttachActions = {
  canSendFile: false,
  allowed: { location: false, contact: false, poll: false, event: false },
  unavailableReason: ATLAS_TEXT_ONLY_REASON,
  onDocument: unavailable,
  onMedia: unavailable,
  onCamera: unavailable,
  onLocation: unavailable,
  onContact: unavailable,
  onPoll: unavailable,
  onEvent: unavailable,
}
