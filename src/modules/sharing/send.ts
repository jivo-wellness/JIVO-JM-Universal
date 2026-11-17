import type { ConversationItem, SendPayload } from '../messenger/api'
import type { PickedFile } from '../messenger/media/model'
import { shareable, type ShareTarget } from './model'

export interface ShareSendDeps {
  /** The direct chat with a person (created by the server if there is none yet). */
  openDirect(person: string): Promise<ConversationItem>
  /** The outbox: saved on the device first, then sent (and retried) in the background. */
  enqueueText(owner: string, conversation: string, payload: SendPayload): Promise<void>
  enqueueFiles(owner: string, conversation: string, payload: SendPayload, files: { key: string; file: PickedFile }[]): Promise<void>
  /** The same message id for the same content and chat, so a retry never queues a second copy. */
  clientId(conversation: string): string
  message(error: unknown): string
}
export interface ShareSendResult { sent: ConversationItem[]; failed: { title: string; error: string }[] }

/**
 * Queues the share once per chosen chat through the outbox (each chat gets its own copy of the files). Chats already
 * done (`done`, kept by the caller across retries) are skipped; a chat that fails does not stop the others. A chat
 * must still allow this person to send (and send files) when it is resolved; the outbox and server check again.
 */
export async function sendShare(deps: ShareSendDeps, input: { owner: string; targets: readonly ShareTarget[]; body: string; files: { key: string; file: PickedFile }[]; done: Map<string, ConversationItem> }): Promise<ShareSendResult> {
  const body = input.body.trim()
  const files = input.files.length > 0
  if (!files && !body) throw Error('Type a message to send.')
  const failed: ShareSendResult['failed'] = []
  for (const target of input.targets) {
    if (input.done.has(target.key)) continue
    try {
      const chat = target.kind === 'chat' ? target.chat : await deps.openDirect(target.person.id)
      if (!shareable(chat, files)) throw Error(chat.locked ? 'This chat is locked.' : files && chat.can?.send ? "You can't send files in this chat." : "You can't send messages in this chat.")
      const payload: SendPayload = { client_id: deps.clientId(chat.id), body, upload_ids: [] }
      if (files) await deps.enqueueFiles(input.owner, chat.id, payload, input.files)
      else await deps.enqueueText(input.owner, chat.id, payload)
      input.done.set(target.key, chat)
    } catch (error) { failed.push({ title: target.title, error: deps.message(error) }) }
  }
  return { sent: input.targets.map(target => input.done.get(target.key)).filter((chat): chat is ConversationItem => !!chat), failed }
}

/** One sentence for a partly failed share: who got it, and why the rest did not. */
export function shareFailureMessage(result: ShareSendResult): string {
  const failed = result.failed.map(item => `${item.title}: ${item.error}`).join(' ')
  return result.sent.length ? `Sent to ${result.sent.map(chat => chat.title || chat.peer?.name || 'chat').join(', ')}. Not sent to ${failed}` : `Not sent. ${failed}`
}
