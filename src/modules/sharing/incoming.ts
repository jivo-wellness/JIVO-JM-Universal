import { incomingStorage } from './storage'
import { incomingShareChanged, onIncomingShareChange } from './events'

let generation = 0
/** Bumped at every confirmed sign-out / session loss; work started before it must not show or send a share. */
export const incomingShareGeneration = () => generation
/** Confirmed sign-out/session loss only (Session.tsx); a share taken in before sign-in is kept for whoever signs in. */
export function incomingShareBoundary() { ++generation; void incomingStorage.clear().catch(() => undefined); incomingShareChanged() }
export { incomingStorage, onIncomingShareChange }
