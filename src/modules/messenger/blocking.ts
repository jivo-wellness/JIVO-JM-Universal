import { errorMessage } from '../../core/api/client'
import { blockContact, unblockContact } from './api'
import { actionFailure } from './offlineAction'

/**
 * Personal "Block contact" (BE-108, WhatsApp-style): blocks someone for me only (they can't message me, we don't
 * see each other's online / typing / ticks; groups unchanged). Not the administrator "Block messaging", which stops
 * an account messaging everyone. Stored on the server, so it needs a connection: nothing is queued offline.
 */
export interface BlockTarget { id: string; name: string; /** Currently blocked by me: the action unblocks. */ blocked: boolean }

export const blockCopy = {
  title: (t: BlockTarget) => t.blocked ? `Unblock ${t.name}?` : `Block ${t.name}?`,
  body: (t: BlockTarget) => t.blocked ? 'They will be able to message you again.' : 'Blocked contacts can’t message you. They won’t be notified.',
  confirm: (t: BlockTarget) => t.blocked ? 'Unblock' : 'Block',
  menu: (blocked: boolean) => blocked ? 'Unblock contact' : 'Block contact',
  banner: 'You blocked this contact. Tap to unblock.',
}

/** Block or unblock; resolves to '' on success, otherwise the message to show (the offline line when not connected). */
export async function toggleBlock(target: BlockTarget, offline?: () => boolean): Promise<string> {
  try {
    if (target.blocked) await unblockContact(target.id)
    else await blockContact(target.id)
    return ''
  } catch (error) {
    return actionFailure(error, errorMessage, offline)
  }
}
