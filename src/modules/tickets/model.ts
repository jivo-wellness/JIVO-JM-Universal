import type { PickedFile } from '../messenger/media/model'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type Person = { id: string; name: string }
export type TicketFile = { id: string; name: string; size: number }
export type TicketRow = { code: string; title: string; status: TicketStatus; status_label: string; priority: TicketPriority; priority_label: string; raised_by: Person; assignee: Person | null; created_at: string; updated_at: string }
export type TicketDetail = TicketRow & { description: string; page_url: string; browser: string; resolution: string; files: TicketFile[]; timeline: { id: string; author: Person | null; body: string; event: string; at: string; files: TicketFile[] }[]; can: { resolve: boolean; assign: boolean; reopen: boolean; withdraw: boolean } }
export type TicketList = { count: number; results: TicketRow[]; counts: Record<TicketStatus, number>; may_resolve: boolean }
export const priorities: readonly (readonly [TicketPriority, string])[] = [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['urgent', 'Urgent']]
export const statuses: readonly (readonly [TicketStatus, string])[] = [['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved'], ['closed', 'Closed']]
export const MAX_FILES = 6
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export function validateFiles(files: readonly PickedFile[]) {
  if (files.length > MAX_FILES) throw Error('Attach up to 6 files.')
  for (const file of files) {
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_FILE_SIZE) throw Error('Each file must be between 1 byte and 10 MiB.')
    if (!/\.(png|jpe?g|gif|webp|mp4|webm|pdf|txt|log|csv)$/i.test(file.name)) throw Error('Use an image, MP4/WebM recording, PDF, TXT, LOG or CSV file.')
  }
}
