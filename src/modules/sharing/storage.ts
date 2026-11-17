import type { IncomingShare } from './model'
export interface IncomingStorage {
  /** Takes in what the system handed JM (native intent) into JM's own storage, even before sign-in. True when a new share was taken. */
  capture(): Promise<boolean>
  /** The pending share for `owner` (binding an unowned share to them); null when there is none or it is another account's. */
  read(owner: string): Promise<IncomingShare | null>
  /** Deletes the pending share and its files: one share (`id`), or everything (sign-out boundary). */
  clear(id?: string): Promise<void>
  hasPending(): Promise<boolean>
}
export const incomingStorage: IncomingStorage = { capture: async () => false, read: async () => null, clear: async () => {}, hasPending: async () => false }
