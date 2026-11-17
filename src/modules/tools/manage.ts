import { allows } from '../../config/capabilities'
import { safeToolLink } from './links'
import type { ToolInput } from './api'

/** The backend's gate on /api/jm/admin/tools/ (org/tools.py). Without it the Tools screen shows no management and calls no admin endpoint. */
export const canManageTools = (capabilities: readonly string[]) => allows(capabilities, 'ADMIN_TOOLS_MANAGE')

/** The ids in their new order after moving the one at `from` to `to` (unchanged when out of range). */
export function movedIds(ids: readonly string[], from: number, to: number): string[] {
  const next = [...ids]
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Our own check before sending (the server checks the same rules); an empty string means the tool can be saved. */
export function toolProblem(data: ToolInput): string {
  if (!data.name.trim() || !safeToolLink(data.web_url.trim()) || (data.app_url.trim() && !safeToolLink(data.app_url.trim(), true))) return 'Enter a name, an HTTPS website, and a valid optional app link.'
  return ''
}
