/** Hold-to-record gesture on the microphone (reference Composer micDown/micMove/micUp, plus WhatsApp's slide up to lock). */
export const CANCEL_SLIDE = 90
export const LOCK_LIFT = 70
export const TAP_MS = 400

/** While holding: far enough left cancels, far enough up locks (hands-free); left wins when both. */
export function micMove(dx: number, dy: number): 'cancel' | 'lock' | null {
  if (dx < -CANCEL_SLIDE) return 'cancel'
  if (dy < -LOCK_LIFT) return 'lock'
  return null
}

/**
 * Letting go: a locked recording keeps going; a short tap (or a press the permission prompt took over) keeps
 * recording hands-free like the reference; otherwise it stops for review (nothing is sent without Send).
 */
export function micRelease(heldMs: number, phase: 'idle' | 'preparing' | 'recording' | 'stopping' | 'review', locked: boolean): 'keep' | 'review' | 'none' {
  if (phase !== 'preparing' && phase !== 'recording') return 'none'
  if (locked || phase === 'preparing' || heldMs < TAP_MS) return 'keep'
  return 'review'
}
