import { allows, OVERSIGHT_ACCESS, type CapabilityRule } from '../config/capabilities'
const tiles: { title: string; description: string; href: string; rule?: CapabilityRule }[] = [
 { title: 'Messenger', description: 'Conversations, files and your team.', href: '/messenger', rule: 'JM_ACCESS' },
 { title: 'Passwords', description: 'Your vaults and shared passwords.', href: '/passwords', rule: 'JP_ACCESS' },
 { title: 'Profile & security', description: 'Your details, sign-in and devices.', href: '/profile' },
 { title: 'Oversight', description: 'Authorized oversight of chats and vaults.', href: '/oversight', rule: OVERSIGHT_ACCESS },
 { title: 'People', description: 'Manage people and access.', href: '/admin?tab=people', rule: 'ADMIN_USER_VIEW' },
 { title: 'Permission groups', description: 'Review group permissions.', href: '/admin?tab=groups', rule: ['ADMIN_GROUP_VIEW','ADMIN_AUDIT_VIEW'] },
 { title: 'Security', description: 'Organization security policy.', href: '/admin?tab=security', rule: 'ADMIN_SECURITY_POLICY' },
 { title: 'Alerts', description: 'Send team announcements.', href: '/notifications?view=alerts', rule: ['JM_ALERT_SEND', 'JM_ALERT_MANAGE'] },
 { title: 'Team vaults', description: 'Manage team vault ownership.', href: '/passwords?view=admin', rule: 'JP_VAULT_DIRECTORY' },
 { title: 'Emergency access', description: 'Request or review emergency access.', href: '/passwords?view=break-glass', rule: ['JP_EMERGENCY_APPROVE','JP_EMERGENCY_REQUEST'] },
]
export const homeTiles = (capabilities: readonly string[]) => tiles.filter(tile => allows(capabilities,tile.rule))
