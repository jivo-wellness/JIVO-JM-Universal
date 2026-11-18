import { isAxiosError } from 'axios'

import { api } from '@/core/api/client'
import type { ConversationDetail, ConversationFilter, ConversationItem, Member, Message, PersonCard } from '@/modules/messenger/api'

/**
 * Oversight (BE-085 §9): Super Administrators read any chat or vault, silently for the members, inside an
 * oversight session (a reason + a passkey step-up, 30 minutes). Every request is recorded in the oversight audit
 * stream and announced to the other Super Administrators. Everything here is behind JM_OVERSIGHT_ENABLED on the
 * server (404 while it is off). Revealed secrets are never put in the query cache (see revealEntry).
 */

const jp = { baseURL: '/api/jp' }

export interface OversightSession {
  id: string
  reason: string
  started_at: string
  expires_at: string
}

/** Every oversight response names the live session (for the banner). */
export type WithSession<T> = T & { oversight?: { id: string; reason: string; expires_at: string } }

export interface OversightConversationRow {
  id: string
  kind: 'direct' | 'group'
  title: string
  avatar_url: string | null
  restricted_company: string | null
  member_count: number
  members: PersonCard[]
  last_message_at: string | null
  created_at: string
  /** With the person filter: when that person left (null while still in it). */
  person_left_at?: string | null
  /** With the pair filter: when the second person left. */
  with_left_at?: string | null
}

export type OversightMember = Member & { left_at?: string | null }

export type OversightConversation = ConversationDetail & { members?: OversightMember[] }

export interface OversightVaultRow {
  id: string
  name: string
  kind: 'personal' | 'shared' | 'company'
  owner: PersonCard | null
  member_count: number
  entry_count: number
  frozen: boolean
  archived: boolean
}

export interface OversightEntryRow {
  id: string
  title: string
  url: string
  username: string
  kind?: string
  folder: { id: string; name: string } | null
  updated_at: string
}

export type SearchSection = 'people' | 'conversations' | 'messages' | 'vault_items'

export interface OversightSearchResult {
  people: PersonCard[]
  conversations: OversightConversationRow[]
  messages: { conversation: OversightConversationRow; message: Message; snippet: string }[]
  vault_items: { vault: { id: string; name: string; kind: OversightVaultRow['kind']; owner: PersonCard | null }; entry: { id: string; title: string; url: string } }[]
  incomplete: boolean
  cursor: string | null
  /** Without a section: each section's next page (ask again with that section and this cursor). */
  cursors?: Partial<Record<SearchSection, string | null>>
}

export interface SearchQuery {
  q: string
  section?: SearchSection | ''
  person?: string
  /** With person: the second person of a pair (messages either sent in the chats both share). */
  with?: string
  conversation?: string
  since?: string
  until?: string
}

export const oversightKeys = {
  all: ['oversight'] as const,
  session: ['oversight', 'session'] as const,
  conversations: (q: string, kind: string) => ['oversight', 'conversations', q, kind] as const,
  conversation: (id: string) => ['oversight', 'conversation', id] as const,
  messages: (id: string) => ['oversight', 'conversation', id, 'messages'] as const,
  search: (query: SearchQuery) => ['oversight', 'search', query] as const,
  people: (q: string) => ['oversight', 'people', q] as const,
  pairChats: (person: string, other: string, kind: string) => ['oversight', 'pair', person, other, kind] as const,
  personChats: (person: string, kind: string) => ['oversight', 'person', person, kind] as const,
  asList: (person: string, filter: string, q: string) => ['oversight', 'as', person, 'list', filter, q] as const,
  asConversation: (person: string, id: string) => ['oversight', 'as', person, 'conversation', id] as const,
  asMessages: (person: string, id: string) => ['oversight', 'as', person, 'conversation', id, 'messages'] as const,
  vaults: (q: string, kind: string) => ['oversight', 'vaults', q, kind] as const,
  vault: (id: string, q: string) => ['oversight', 'vault', id, q] as const,
}

const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null))

// Session -------------------------------------------------------------------------------------------
/** The live oversight session of this sign-in, or null (404 no_oversight_session). */
export async function getSession(): Promise<OversightSession | null> {
  try {
    return (await api.get<OversightSession>('/oversight/session/')).data
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 404) return null
    throw e
  }
}
/** Needs the `oversight` step-up (passkey); the "Confirm it's you" dialog opens by itself. */
export const startSession = async (reason: string) => (await api.post<OversightSession>('/oversight/session/', { reason })).data
export const endSession = async () => api.delete('/oversight/session/')

// Chats ---------------------------------------------------------------------------------------------
export const listConversations = async (f: { q?: string; person?: string; with?: string; company?: string; kind?: string }, cursor?: string | null) =>
  (await api.get<WithSession<{ results: OversightConversationRow[]; cursor: string | null }>>('/oversight/conversations/', { params: clean({ ...f, cursor }) })).data
export const getConversation = async (id: string) => (await api.get<WithSession<OversightConversation>>(`/oversight/conversations/${id}/`)).data
export type MessagesQuery = { before_seq?: number; after_seq?: number; around?: string; limit?: number }
export type MessagesPage = WithSession<{ results: Message[]; has_more: boolean; has_more_after?: boolean }>
/** `around`: the page around one message (a search hit): `has_more` = older, `has_more_after` = newer. */
export const listMessages = async (id: string, q: MessagesQuery = {}) =>
  (await api.get<MessagesPage>(`/oversight/conversations/${id}/messages/`, { params: clean(q) })).data
export const moderateDelete = async (messageId: string, reason: string) => (await api.post<Message>(`/oversight/messages/${messageId}/delete/`, { reason })).data
export const moderateRemoveMember = async (conversationId: string, userId: string, reason: string) =>
  (await api.post<{ members: OversightMember[] }>(`/oversight/conversations/${conversationId}/members/${userId}/remove/`, { reason })).data

// People to pick (JM_OVERSIGHT_READ or _SEARCH; audited) ---------------------------------------------
export const searchPeople = async (q: string, cursor?: string | null) =>
  (await api.get<WithSession<{ results: (PersonCard & { email?: string; is_deleted?: boolean })[]; cursor: string | null }>>('/oversight/people/', { params: clean({ q, cursor }) })).data

// "View as" one person (BE-109): their own chat list and chats, read-only. GET only; no write route exists.
export type AsConversation = WithSession<ConversationDetail & { members?: OversightMember[]; viewing_as?: PersonCard }>
export const listAsConversations = async (person: string, f: { filter?: ConversationFilter | 'locked'; q?: string }, cursor?: string | null) =>
  (
    await api.get<WithSession<{ results: ConversationItem[]; next_cursor: string | null; locked_count: number; viewing_as: PersonCard }>>(`/oversight/as/${person}/conversations/`, {
      params: clean({ ...f, cursor }),
    })
  ).data
export const getAsConversation = async (person: string, id: string) => (await api.get<AsConversation>(`/oversight/as/${person}/conversations/${id}/`)).data
export const listAsMessages = async (person: string, id: string, q: MessagesQuery = {}) =>
  (await api.get<MessagesPage>(`/oversight/as/${person}/conversations/${id}/messages/`, { params: clean(q) })).data

// Search --------------------------------------------------------------------------------------------
export const search = async (query: SearchQuery, cursor?: string | null) =>
  (await api.get<WithSession<OversightSearchResult>>('/oversight/search/', { params: clean({ ...query, cursor }) })).data

// Vaults (Passwords) --------------------------------------------------------------------------------
export const listVaults = async (f: { q?: string; kind?: string; owner?: string }, cursor?: string | null) =>
  (await api.get<WithSession<{ results: OversightVaultRow[]; cursor: string | null }>>('/oversight/vaults/', { ...jp, params: clean({ ...f, cursor }) })).data
export const listVaultEntries = async (id: string, q: string, cursor?: string | null) =>
  (await api.get<WithSession<{ vault: OversightVaultRow; results: OversightEntryRow[]; cursor: string | null }>>(`/oversight/vaults/${id}/entries/`, { ...jp, params: clean({ q, cursor }) })).data

export type RevealResult = { status: 'revealed'; value: string; expires_in: number } | { status: 'pending' }

/**
 * Reveal one entry's password (also needs the `jp` step-up). With the two-person option on and a personal vault
 * the server answers 202: another Super Administrator must approve it first (Approvals). Never cached.
 */
export async function revealEntry(id: string, reason: string, field = 'password'): Promise<RevealResult> {
  const r = await api.post<{ field: string; value: string; version: number; expires_in: number } | { status: 'pending' }>(
    `/oversight/entries/${id}/reveal/`,
    clean({ reason: reason.trim(), field }),
    jp,
  )
  if (r.status === 202 || !('value' in r.data)) return { status: 'pending' }
  return { status: 'revealed', value: r.data.value, expires_in: r.data.expires_in }
}
