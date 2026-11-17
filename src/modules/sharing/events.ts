const listeners = new Set<() => void>()
/** Told when a new share was taken in or a pending share was cleared. */
export function onIncomingShareChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function incomingShareChanged() { for (const listener of [...listeners]) { try { listener() } catch { /* one screen's failure must not stop the others */ } } }
