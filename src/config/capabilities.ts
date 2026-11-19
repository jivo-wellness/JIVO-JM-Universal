/**
 * Capability keys, exactly as the backend returns them in /me. Hiding UI is a convenience only:
 * every endpoint checks the same capability on the server.
 */
export const CAPABILITIES = [
  // Messenger
  'JM_ACCESS',
  'JM_TICKETS_RESOLVE',
  'JM_DIRECTORY_VIEW',
  'JM_PRESENCE_VIEW',
  'JM_PROFILE_PHOTO',
  'JM_CHAT_READ',
  'JM_CHAT_START_DIRECT',
  'JM_CHAT_SEARCH',
  'JM_CHAT_ORGANIZE',
  'JM_CHAT_LEAVE',
  'JM_CHAT_DISAPPEARING',
  'JM_MESSAGE_SEND',
  'JM_MESSAGE_FORWARD',
  'JM_MESSAGE_EDIT_OWN',
  'JM_MESSAGE_DELETE_OWN',
  'JM_MESSAGE_DELETE_ANY',
  'JM_MESSAGE_REACT',
  'JM_FILE_SEND',
  'JM_FILE_OPEN',
  'JM_POLL_CREATE',
  'JM_POLL_VOTE',
  'JM_EVENT_CREATE',
  'JM_EVENT_EDIT_OWN',
  'JM_EVENT_RESPOND',
  'JM_LOCATION_SHARE',
  'JM_CONTACT_SHARE',
  'JM_MAPS_USE',
  'JM_LINK_PREVIEW',
  'JM_GROUP_CREATE',
  'JM_GROUP_EDIT_INFO',
  'JM_GROUP_MEMBERS',
  'JM_GROUP_EDIT_ANY',
  'JM_GROUP_MEMBERS_ANY',
  'JM_MODERATION_LOG_VIEW',
  'JM_NOTIFICATIONS',
  'JM_ALERT_VIEW',
  'JM_ALERT_SEND',
  'JM_ALERT_MANAGE',
  'JM_ATLAS_USE',
  // Passwords
  'JP_ACCESS',
  'JP_SHARED_VIEW',
  'JP_FOLDER_MANAGE',
  'JP_VAULT_EDIT',
  'JP_VAULT_ARCHIVE',
  'JP_VAULT_ACTIVITY',
  'JP_VAULT_CREATE_PERSONAL',
  'JP_ENTRY_CREATE',
  'JP_FILE_UPLOAD',
  'JP_ENTRY_REVEAL',
  'JP_ENTRY_HISTORY',
  'JP_FILE_DOWNLOAD',
  'JP_ENTRY_EDIT',
  'JP_ENTRY_MOVE',
  'JP_FILE_RENAME',
  'JP_ENTRY_DELETE',
  'JP_ENTRY_RESTORE',
  'JP_FILE_DELETE',
  'JP_ENTRY_SHARE',
  'JP_VAULT_MEMBERS_ADD',
  'JP_SHARE_REVOKE',
  'JP_VAULT_MEMBERS_REMOVE',
  'JP_VAULT_CREATE_COMPANY',
  'JP_VAULT_APPOINT_OWNER',
  'JP_VAULT_DIRECTORY',
  'JP_EMERGENCY_REQUEST',
  'JP_EMERGENCY_APPROVE',
  'JP_AUDIT_VIEW',
  // Administration
  'ADMIN_USER_VIEW',
  'ADMIN_USER_CREATE',
  'ADMIN_USER_EDIT',
  'ADMIN_USER_INVITE',
  'ADMIN_USER_PASSWORD',
  'ADMIN_USER_EMAIL',
  'ADMIN_USER_SESSIONS',
  'ADMIN_USER_RESET_MFA',
  'ADMIN_USER_UNLOCK',
  'ADMIN_USER_DEACTIVATE',
  'ADMIN_USER_DELETE',
  'ADMIN_USER_FREEZE',
  'ADMIN_USER_BLOCK',
  'ADMIN_USER_GROUPS',
  'ADMIN_GROUP_VIEW',
  'ADMIN_GROUP_MANAGE',
  'ADMIN_COMPANY_VIEW',
  'ADMIN_COMPANY_MANAGE',
  'ADMIN_MEMBERSHIP_MANAGE',
  'ADMIN_CHAT_POLICY',
  'ADMIN_APPEARANCE',
  'ADMIN_SECURITY_POLICY',
  'ADMIN_APPROVALS',
  'ADMIN_TOOLS_MANAGE',
  'ADMIN_AUDIT_VIEW',
  // Oversight (Super Administrators; only while the server has oversight switched on)
  'JM_OVERSIGHT_READ',
  'JM_OVERSIGHT_SEARCH',
  'JM_OVERSIGHT_MODERATE',
  'JP_OVERSIGHT_VIEW',
] as const

export const LEGACY_CAPABILITIES = [
  'JM_SEND_MESSAGE',
  'JM_SEND_FILE',
  'JM_CREATE_GROUP',
  'JM_MANAGE_GROUP',
  'JM_MANAGE_MEMBERS',
  'JM_DELETE_MESSAGE',
  'JM_MANAGE_MESSAGES',
  'JM_SEND_ALERT',
  'JP_CREATE_PASSWORD',
  'JP_VIEW_PASSWORD',
  'JP_UPDATE_PASSWORD',
  'JP_DELETE_PASSWORD',
  'JP_SHARE_PASSWORD',
  'JP_REVOKE_PASSWORD',
  'JP_MANAGE_VAULT',
  'JP_BREAK_GLASS',
  'JP_REQUEST_EMERGENCY',
  'ADMIN_USERS',
  'ADMIN_AUDIT',
] as const

// Legacy types remain during migration; never expand an alias into action permissions.
export type Capability = (typeof CAPABILITIES)[number] | (typeof LEGACY_CAPABILITIES)[number]

/** One capability, or a list of which any one is enough. */
export type CapabilityRule = Capability | readonly Capability[]

export const ADMIN_ACCESS: readonly Capability[] = CAPABILITIES.filter(key => key.startsWith('ADMIN_'))
export const OVERSIGHT_ACCESS: readonly Capability[] = ['JM_OVERSIGHT_READ', 'JM_OVERSIGHT_SEARCH', 'JM_OVERSIGHT_MODERATE', 'JP_OVERSIGHT_VIEW']
export const MODULES = ['Messenger', 'Passwords', 'Administration', 'Oversight'] as const
export type CapabilityModule = (typeof MODULES)[number]
export function moduleOf(key: string): CapabilityModule {
  if ((OVERSIGHT_ACCESS as readonly string[]).includes(key)) return 'Oversight'
  if (key.startsWith('JP_')) return 'Passwords'
  if (key.startsWith('ADMIN_')) return 'Administration'
  return 'Messenger'
}

export function allows(held: readonly string[], rule: CapabilityRule | undefined): boolean {
  if (!rule) return true
  return typeof rule === 'string' ? held.includes(rule) : rule.some((c) => held.includes(c))
}

/** A disabled server feature must not appear even if an older /me response retains its grants. */
export function withOversightAvailability<T extends { capabilities: readonly string[]; oversight_enabled?: boolean }>(me: T): T {
  if (me.oversight_enabled) return me
  const capabilities = me.capabilities.filter(key => !(OVERSIGHT_ACCESS as readonly string[]).includes(key))
  return capabilities.length === me.capabilities.length ? me : { ...me, capabilities } as T
}
