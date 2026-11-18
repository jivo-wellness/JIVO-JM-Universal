import type { PendingSend } from './outboxController'

/** Failed persistence restores the sent text without dropping anything typed since the tap. */
export function restoreUnsentDraft(sent: string, current: string): string {
  return current ? `${sent}\n${current}` : sent
}

/** Display the tap immediately; durable queue state takes over without a duplicate bubble. */
export function mergePendingPreview(entries: PendingSend[], preview: PendingSend | null, owner?: string): PendingSend[] {
  if (!preview || preview.owner !== owner || entries.some(entry => entry.payload.client_id === preview.payload.client_id)) return entries
  return [...entries, preview]
}
