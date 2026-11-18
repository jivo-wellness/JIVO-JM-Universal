import type { Message } from './api'
const family = (m: Message) => m.client_id && /^[0-9a-f-]{36}$/i.test(m.client_id) ? m.client_id.slice(0, -4) : null
const eligible = (m: Message) => !m.deleted && !m.forwarded && !m.reactions.length && !m.edited_at && m.attachments.length > 0 && m.attachments.every(a => a.status === 'ready' && (a.kind === 'image' || a.kind === 'video'))
/** Presentation only: each upload/message keeps its original server identity and gallery actions. */
export function messageAlbums(messages: Message[], focusSeq: number | null = null): Message[] {
 const rows: Message[] = []
 const originals = new Map<string, Message[]>()
 for (const m of messages) {
  const prev = rows.at(-1)
  if (prev && focusSeq === null && eligible(prev) && eligible(m) && !m.body && family(m) && family(prev) === family(m) && prev.conversation === m.conversation && prev.sender?.id === m.sender?.id && prev.reply_to?.id === m.reply_to?.id && m.seq === prev.seq + 1) {
   originals.set(prev.id, [...(originals.get(prev.id) ?? [prev]), m])
   rows[rows.length - 1] = { ...prev, seq: m.seq, attachments: [...prev.attachments, ...m.attachments] }
  } else rows.push(m)
 }
 return rows.flatMap(row => row.attachments.length < 4 ? originals.get(row.id) ?? [row] : [row]).flatMap(row =>
  eligible(row) && row.attachments.length > 1 && row.attachments.length < 4
   ? row.attachments.map((attachment, index) => ({ ...row, attachments: [attachment], body: index === row.attachments.length - 1 ? row.body : '' }))
   : [row])
}
