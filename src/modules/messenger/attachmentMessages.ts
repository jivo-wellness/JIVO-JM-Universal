import type { SendPayload } from './api'
/** Keep a batch's UUID prefix across individually sent messages, without changing its first ID.
 * 112 random bits identify the batch; the suffix advances once per attachment. */
export function attachmentClientId(first: string, index: number, fallback: string) {
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(first)) return index === 0 ? first : fallback
 return first.slice(0, -4) + ((parseInt(first.slice(-4), 16) + index) % 65536).toString(16).padStart(4, '0')
}
/** Stable IDs let a partially queued batch resume without duplicating earlier files. */
export function attachmentMessages<T extends { key: string }>(payload: SendPayload, files: T[]) {
 return files.map((file,index)=>({file,payload:{...payload,client_id:attachmentClientId(payload.client_id,index,file.key),body:index===0?payload.body:'',upload_ids:index===0?payload.upload_ids:[]}}))
}
