import type { BulkSkip } from '../api'

/** Why someone cannot be removed (the server's guard codes, BE-092) in plain words. */
const REASONS: Record<string, string> = {
  self_grant_forbidden: 'You cannot change your own access',
  self_action_forbidden: 'You cannot change your own access',
  target_outranks_actor: 'Has permissions you do not hold',
  escalation_forbidden: 'A group grants permissions you do not hold',
  last_super_admin: 'The last Super Administrator',
  superuser: 'Superuser: holds every permission (changed only from the command line)',
  unmanaged_group: 'Holds it through a group made outside JM',
  not_member: 'Was no longer in the group',
  not_holder: 'Did not hold it any more',
  not_found: 'Not found',
  permission_denied: 'You cannot change group membership',
}

export function reasonText(code: string | null | undefined): string {
  if (!code) return ''
  return REASONS[code] ?? 'Cannot be removed'
}

/** "Asha Verma: The last Super Administrator · Vik: Has permissions you do not hold" (up to 4, then "and N more"). */
export function skippedText(skipped: BulkSkip[]): string {
  const shown = skipped.slice(0, 4).map((s) => `${s.name ?? 'Unknown person'}: ${reasonText(s.reason)}`)
  if (skipped.length > 4) shown.push(`and ${skipped.length - 4} more`)
  return shown.join(' · ')
}

export const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`
