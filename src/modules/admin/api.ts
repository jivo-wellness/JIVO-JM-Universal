import { api } from '@/core/api/client'
import type { Page, Person } from '@/core/api/types'
import type { CapabilityModule } from '@/config/capabilities'
import type { Membership } from '@/core/auth/types'

export type UserStatus = 'active' | 'invited' | 'inactive' | 'deleted'

export interface AdminUser {
  id: string
  email: string
  full_name: string
  display_name: string
  name: string
  phone: string
  employee_code: string | null
  is_active: boolean
  status: UserStatus
  has_password: boolean
  date_joined: string
  last_login: string | null
  deactivated_at: string | null
  is_deleted: boolean
  deleted_at: string | null
  deleted_by: Person | null
  groups: string[]
  /** Only on one person's page. */
  permissions?: EffectivePermission[]
  companies: Membership[]
  mfa_enabled: boolean
  locked_out: boolean
  pending_email: string | null
  pending_email_requested_at: string | null
  is_superuser?: boolean
  /** Freeze: no sign-in, sessions ended (BE-085 §8). `frozen_until` empty = until unfrozen. */
  frozen_at?: string | null
  frozen_until?: string | null
  /** Empty unless you may freeze people. */
  frozen_reason?: string
  /** Block: can sign in and read, cannot send, react, create, upload or share. */
  blocked_at?: string | null
  /** Empty unless you may block people. */
  blocked_reason?: string
  /** In the built-in Super Administrators group. */
  is_super_admin?: boolean
  /** What you may do to this person (the capability and the target-rank guard, server-side). */
  can?: AdminUserCan
}

export interface AdminCompany {
  id: string
  code: string
  name: string
  short_name: string
  color: string
  is_active: boolean
  member_count: number
  is_deleted: boolean
  deleted_at: string | null
  deleted_by: Person | null
}

/** One permission a person holds, and where it comes from (shown on their page). */
export interface EffectivePermission {
  key: string
  label: string
  area: 'JM' | 'JP' | 'ADMIN'
  /** The catalogue module (BE-085); older servers send only `area`. */
  module?: CapabilityModule
  /** Groups that grant it. */
  groups: string[]
  /** Granted to the person directly (Django admin), not through a group. */
  direct: boolean
  superuser: boolean
  /** False while the account cannot sign in (deactivated or deleted). */
  effective: boolean
  /** Withheld until they set up two-step verification (when it is ON). */
  needs_two_step: boolean
}

export interface GroupInfo {
  id: string
  name: string
  description: string
  /** Built-in groups come from JM itself: only their members can change. */
  built_in: boolean
  capabilities: string[]
  member_count: number
  /** For this administrator (the server checks again): edit a custom group / add and remove its members. */
  can_edit: boolean
  can_manage_members: boolean
  created_at: string
  /** Holds every capability, including ones added later (Super Administrators). */
  all_capabilities?: boolean
  /** The built-in Super Administrators group. */
  super_admin?: boolean
}

export interface CapabilityInfo {
  key: string
  label: string
  /** Messenger, Passwords, Administration or Oversight (older servers: absent, derived from the key). */
  module?: CapabilityModule
  /** One line: what it allows. */
  description?: string
  /** Withheld until the person signs in with two-step verification. */
  mfa_required?: boolean
  /** Built-in groups that grant it (besides Super Administrators). */
  default_groups?: string[]
  /** Held by the current administrator (only those can be put into a group). */
  held: boolean
}

export interface GroupMember {
  id: string
  name: string
  email: string
  avatar_url: string | null
  is_active: boolean
  is_me: boolean
  /** May this administrator take them out (rank, escalation, last Super Administrator; BE-092). Older servers: absent. */
  can_remove?: boolean
  /** Why not, as a guard code (`target_outranks_actor`, `last_super_admin`…). */
  reason?: string | null
}

export interface GroupInput {
  name: string
  description: string
  capabilities: string[]
}

export interface GroupOption {
  name: string
  grantable: boolean
}

export interface UserFilters {
  q?: string
  status?: string
  group?: string
  company?: string
  page?: number
}

/** A sensitive action waiting for a second administrator (two-person rule, server: identity.recovery). */
export interface Approval {
  id: string
  kind: 'reset_password' | 'reset_mfa' | 'reactivate' | 'restore' | 'two_step_off'
  label: string
  target: { id: string; name: string; email: string } | null
  requested_by: { id: string; name: string; email: string }
  reason: string
  status: 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired'
  created_at: string
  expires_at: string
  decided_by: { id: string; name: string; email: string } | null
  decided_at: string | null
  can: { decide: boolean; cancel: boolean }
}

/** Thrown instead of a result when the server answered 202: the action now waits for a second administrator. */
export class ApprovalPending extends Error {
  approval: Approval
  constructor(approval: Approval) {
    super('Sent for approval: a second administrator must approve it.')
    this.approval = approval
  }
}

async function orPending<T>(request: Promise<{ status: number; data: unknown }>): Promise<T> {
  const r = await request
  if (r.status === 202) throw new ApprovalPending((r.data as { approval: Approval }).approval)
  return r.data as T
}

export const listApprovals = async (status: 'pending' | 'all') =>
  (await api.get<{ results: Approval[] }>('/admin/approvals/', { params: { status } })).data.results
export const decideApproval = async (id: string, decision: 'approve' | 'deny' | 'cancel') =>
  (await api.post<Approval & { result?: { link?: string; expires_at?: string } }>(`/admin/approvals/${id}/${decision}/`)).data

export const adminKeys = {
  all: ['admin'] as const,
  approvals: (status: string) => ['admin', 'approvals', status] as const,
  users: (f: UserFilters) => ['admin', 'users', f] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  groupOptions: ['admin', 'group-options'] as const,
  groups: ['admin', 'groups'] as const,
  capabilities: ['admin', 'capabilities'] as const,
  groupMembers: (id: string, q: string) => ['admin', 'groups', id, 'members', q] as const,
  companies: (show: string) => ['admin', 'companies', show] as const,
  securityPolicy: ['admin', 'security-policy'] as const,
}

const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined))

// Users
export const listUsers = async (f: UserFilters) => (await api.get<Page<AdminUser>>('/admin/users/', { params: clean(f) })).data
export const getUser = async (id: string) => (await api.get<AdminUser>(`/admin/users/${id}/`, { params: { status: 'all' } })).data
export const createUser = async (data: { email: string; full_name: string; display_name?: string; phone?: string; employee_code?: string; password?: string }) =>
  (await api.post<AdminUser & { invite_link: string | null; password_set: boolean }>('/admin/users/', data)).data
export const setUserPassword = async (id: string, password: string, signal?: AbortSignal) => orPending<AdminUser>(api.post(`/admin/users/${id}/set-password/`, { password }, { signal }))
export const updateUser = async (id: string, data: Partial<Pick<AdminUser, 'full_name' | 'display_name' | 'phone' | 'employee_code'>>) =>
  (await api.patch<AdminUser>(`/admin/users/${id}/`, data)).data
export const userAction = async (id: string, action: 'deactivate' | 'activate' | 'restore') =>
  orPending<AdminUser>(api.post(`/admin/users/${id}/${action}/`))
export const deleteUser = async (id: string) => api.delete(`/admin/users/${id}/`)
export const inviteLink = async (id: string) => orPending<{ link: string }>(api.post(`/admin/users/${id}/invite-link/`))
export const resetLink = async (id: string) => orPending<{ link: string }>(api.post(`/admin/users/${id}/reset-link/`))
export const resetUserMfa = async (id: string) => orPending<AdminUser>(api.post(`/admin/users/${id}/reset-mfa/`))
export const decideEmailChange = async (id: string, decision: 'approve' | 'reject') =>
  (await api.post<AdminUser>(`/admin/users/${id}/email-change/${decision}/`)).data
export const unlockUser = async (id: string) => (await api.post<AdminUser>(`/admin/users/${id}/unlock/`)).data
export interface UserDevice {
  id: string
  device_label: string
  auth_method: string
  created_at: string
  last_seen_at: string
  ip_last: string | null
  current: boolean
}
export const listUserDevices = async (id: string) => (await api.get<UserDevice[]>(`/admin/users/${id}/sessions/`)).data
export const revokeUserDevice = async (id: string, sessionId: string) => api.post(`/admin/users/${id}/sessions/${sessionId}/revoke/`)
export const revokeUserSessions = async (id: string) => (await api.post<{ revoked: number }>(`/admin/users/${id}/revoke-sessions/`)).data
export const setUserGroups = async (id: string, groups: string[]) => (await api.put<AdminUser>(`/admin/users/${id}/groups/`, { groups })).data
export const groupOptions = async () => (await api.get<GroupOption[]>('/admin/users/group-options/')).data

// Memberships
export const addMembership = async (data: { user: string; company: string; title?: string; department?: string; is_default?: boolean }) =>
  (await api.post('/admin/memberships/', data)).data
export const updateMembership = async (id: string, data: { title?: string; department?: string; is_default?: boolean; is_active?: boolean }) =>
  (await api.patch(`/admin/memberships/${id}/`, data)).data
export const removeMembership = async (id: string) => api.delete(`/admin/memberships/${id}/`)

// Companies & groups
export const listCompanies = async (show = '') => (await api.get<AdminCompany[]>('/admin/companies/', { params: clean({ show }) })).data
export const saveCompany = async (company: Partial<AdminCompany> & { id?: string }) =>
  company.id
    ? (await api.patch<AdminCompany>(`/admin/companies/${company.id}/`, company)).data
    : (await api.post<AdminCompany>('/admin/companies/', company)).data
export const deleteCompany = async (id: string) => api.delete(`/admin/companies/${id}/`)
export const restoreCompany = async (id: string) => (await api.post<AdminCompany>(`/admin/companies/${id}/restore/`)).data
export const listGroups = async () => (await api.get<GroupInfo[]>('/admin/groups/')).data
export const listCapabilities = async () => (await api.get<CapabilityInfo[]>('/admin/capabilities/')).data
export const createGroup = async (data: GroupInput) => (await api.post<GroupInfo>('/admin/groups/', data)).data
export const updateGroup = async (id: string, data: Partial<GroupInput>) => (await api.patch<GroupInfo>(`/admin/groups/${id}/`, data)).data
export const deleteGroup = async (id: string) => api.delete(`/admin/groups/${id}/`)
export const listGroupMembers = async (id: string, q: string, cursor?: string | null) =>
  (await api.get<{ results: GroupMember[]; next_cursor: string | null }>(`/admin/groups/${id}/members/`, { params: { q: q || undefined, cursor: cursor || undefined } })).data
export const changeGroupMembers = async (id: string, change: { add?: string[]; remove?: string[] }) =>
  (await api.post<{ added: number; removed: number; group: GroupInfo }>(`/admin/groups/${id}/members/`, change)).data

// Security policy (organisation-wide)
export interface SecurityPolicy {
  two_step_enforced: boolean
  updated_at: string | null
  updated_by: { id: string; name: string } | null
}
export const getSecurityPolicy = async () => (await api.get<SecurityPolicy>('/admin/security-policy/')).data
export const setTwoStepEnforced = async (two_step_enforced: boolean) =>
  orPending<SecurityPolicy>(api.put('/admin/security-policy/', { two_step_enforced }))

// Chat access (Messenger): whom a person may chat with, and group creation
export interface ChatAccess {
  mode: 'all' | 'selected'
  can_create_groups: boolean
  allowed_count: number
  updated_at: string | null
  updated_by: { id: string; name: string } | null
}
export interface ChatPerson {
  id: string
  name: string
  email: string
  avatar_url: string | null
  company: string | null
}
const chatAccessUrl = (id: string) => `/admin/users/${id}/chat-access/`
export const getChatAccess = async (id: string) => (await api.get<ChatAccess>(chatAccessUrl(id))).data
export const setChatAccess = async (id: string, data: Partial<Pick<ChatAccess, 'mode' | 'can_create_groups'>>) =>
  (await api.put<ChatAccess>(chatAccessUrl(id), data)).data
export const listChatAllowed = async (id: string, q: string, cursor?: string | null) =>
  (await api.get<{ results: ChatPerson[]; next_cursor: string | null }>(`${chatAccessUrl(id)}allowed/`, { params: clean({ q, cursor: cursor ?? '' }) })).data
export const changeChatAllowed = async (id: string, data: { add?: string[]; remove?: string[]; clear?: boolean }) =>
  (await api.post<ChatAccess>(`${chatAccessUrl(id)}allowed/`, data)).data

export interface CapabilityHolder extends GroupMember {
  /** Groups that grant it; `id` is null for a group made outside JM. */
  via: { id: string | null; name: string }[]
  /** Granted to the person directly (Django admin). */
  direct: boolean
  /** Holds every permission whatever their groups (set only from the command line). */
  superuser: boolean
}

export interface HoldersPage {
  capability: { key: string; label: string; module: CapabilityModule; description: string }
  count: number
  results: CapabilityHolder[]
  next_cursor: string | null
}

export interface BulkSkip {
  user_id: string
  name: string | null
  /** Guard code: `self_grant_forbidden`, `target_outranks_actor`, `last_super_admin`, `superuser`, `not_member`… */
  reason: string
  detail: string
}

export interface GroupBulkResult {
  removed: { user_id: string; name: string; lost: string[] }[]
  skipped: BulkSkip[]
  group: GroupInfo
}

export interface CapabilityBulkResult {
  removed: { user_id: string; name: string; groups_left: { id: string; name: string }[]; direct_revoked: boolean; also_lost: string[] }[]
  skipped: BulkSkip[]
}

export const bulkRemoveGroupMembers = async (id: string, userIds: string[]) =>
  (await api.post<GroupBulkResult>(`/admin/groups/${id}/members/bulk-remove/`, { user_ids: userIds })).data
export const listCapabilityHolders = async (key: string, q: string, cursor?: string | null) =>
  (await api.get<HoldersPage>(`/admin/capabilities/${key}/holders/`, { params: { q: q || undefined, cursor: cursor || undefined } })).data
export const removeCapabilityHolders = async (key: string, userIds: string[]) =>
  (await api.post<CapabilityBulkResult>(`/admin/capabilities/${key}/holders/remove/`, { user_ids: userIds, mode: 'groups' })).data

export interface AdminUserCan {
  edit: boolean
  freeze: boolean
  block: boolean
  deactivate: boolean
  delete: boolean
  sessions: boolean
  reset_mfa: boolean
  password: boolean
}

// Audit log (BE-085 §10): every stream, newest first, with the hash-chain check of the chosen stream.
export const AUDIT_STREAMS = ['security', 'admin', 'moderation', 'jp', 'oversight'] as const
export type AuditStream = (typeof AUDIT_STREAMS)[number]

export interface AuditEvent {
  id: number
  stream: AuditStream
  seq: number
  at: string
  action: string
  outcome: string
  actor: { id: string; name: string; email: string } | null
  target: { type: string; id: string; label: string } | null
  ip: string | null
  details: Record<string, unknown>
}

export interface AuditVerification {
  stream: AuditStream
  ok: boolean
  checked: number
  broken_at: number | null
}

export interface AuditFilters {
  stream?: string
  actor?: string
  target?: string
  action?: string
  outcome?: string
  since?: string
  until?: string
}

export const listAudit = async (f: AuditFilters, cursor?: string | null) =>
  (await api.get<{ results: AuditEvent[]; cursor: string | null; verification?: AuditVerification | null }>('/admin/audit/', { params: clean({ ...f, cursor: cursor ?? '' }) })).data

// Freeze and block (BE-085 §8): a reason is required; admin step-up as for every administrator action.
export const freezeUser = async (id: string, data: { reason: string; until: string | null }) =>
  (await api.post<AdminUser>(`/admin/users/${id}/freeze/`, data)).data
export const unfreezeUser = async (id: string, reason = '') => (await api.post<AdminUser>(`/admin/users/${id}/unfreeze/`, { reason })).data
export const blockUser = async (id: string, reason: string) => (await api.post<AdminUser>(`/admin/users/${id}/block/`, { reason })).data
export const unblockUser = async (id: string, reason = '') => (await api.post<AdminUser>(`/admin/users/${id}/unblock/`, { reason })).data
export function isFrozen(u: Pick<AdminUser, 'frozen_at' | 'frozen_until'>, now: Date = new Date()): boolean {
  return Boolean(u.frozen_at) && (!u.frozen_until || new Date(u.frozen_until) > now)
}
