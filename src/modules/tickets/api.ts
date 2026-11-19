import { randomUUID } from 'expo-crypto'
import { api } from '../../core/api/client'
import { uploadAttachment } from '../messenger/media/upload'
import type { PickedFile } from '../messenger/media/model'
import { validateFiles, type Person, type TicketDetail, type TicketList, type TicketPriority, type TicketStatus } from './model'

const path = (code: string) => `/tickets/${encodeURIComponent(code)}/`
export const listTickets = async (params: { page: number; status: string; search: string; mine?: string }) => (await api.get<TicketList>('/tickets/', { params })).data
export const getTicket = async (code: string) => (await api.get<TicketDetail>(path(code))).data
export const listResolvers = async () => (await api.get<Person[]>('/tickets/resolvers/')).data
export const updateTicket = async (code: string, changes: { status?: TicketStatus; priority?: TicketPriority; assignee?: string | null; resolution?: string }, signal: AbortSignal) => (await api.patch<TicketDetail>(path(code), changes, { signal })).data
export const fetchTicketFile = async (code: string, id: string, signal: AbortSignal) => (await api.get<Blob>(`${path(code)}files/${encodeURIComponent(id)}/`, { responseType: 'blob', signal, timeout: 120000 })).data
async function uploadFiles(files: PickedFile[], signal: AbortSignal) {
  validateFiles(files)
  const ids: string[] = []
  for (const file of files) {
    signal.throwIfAborted()
    ids.push((await uploadAttachment(file, randomUUID(), signal, () => {}, 'ticket')).id)
  }
  signal.throwIfAborted()
  return ids
}
export async function raiseTicket(fields: { title: string; description: string; priority: TicketPriority; page_url: string; browser: string }, files: PickedFile[], signal: AbortSignal) {
  const ids = await uploadFiles(files, signal)
  return (await api.post<TicketDetail>('/tickets/', { ...fields, files: ids }, { signal })).data
}
export async function replyTicket(code: string, body: string, files: PickedFile[], signal: AbortSignal) {
  const ids = await uploadFiles(files, signal)
  return (await api.post<TicketDetail>(`${path(code)}comments/`, { body, files: ids }, { signal })).data
}
