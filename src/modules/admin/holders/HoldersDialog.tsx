import { useCallback, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSession } from '../../../core/auth/Session'
import { errorMessage } from '../../../core/api/client'
import { useCursor } from '../../../shared/useCursor'
import { Sheet } from '../../../components/Sheet'
import { Badge, SearchInput } from '../../../components/AdminUi'
import { Button, ErrorState, Label, Spinner } from '../../../ui'
import * as api from '../api'
import { people, reasonText, skippedText } from './reasons'

export type HoldersTarget = { kind: 'group'; group: api.GroupInfo } | { kind: 'capability'; key: string; label: string }
type Row = api.GroupMember & Partial<Pick<api.CapabilityHolder, 'via' | 'direct' | 'superuser'>>
export function removable(target: HoldersTarget, row: Row) {
  return row.can_remove ?? (target.kind === 'group' && target.group.can_manage_members && !row.is_me)
}
export function HoldersDialog({ target, onClose, onChanged }: { target: HoldersTarget; onClose: () => void; onChanged: () => void }) {
  const { me } = useSession()
  const canManage = !!me?.capabilities.includes('ADMIN_USER_GROUPS')
  const [q, setQ] = useState(''); const [selected, setSelected] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const load = useCallback((cursor?: string | null): Promise<{ results: Row[]; next_cursor: string | null }> => target.kind === 'group' ? api.listGroupMembers(target.group.id, q, cursor) : api.listCapabilityHolders(target.key, q, cursor), [target,q])
  const page = useCursor(load)
  const eligible = page.items.filter(row => canManage && removable(target,row))
  const chosen = eligible.filter(row => selected.includes(row.id))
  const title = target.kind === 'group' ? target.group.name : target.label
  async function remove() {
    if (!canManage || busy || !chosen.length) return
    setBusy(true); setError('')
    try {
      const ids = chosen.map(row => row.id)
      const result = target.kind === 'group' ? await api.bulkRemoveGroupMembers(target.group.id, ids) : await api.removeCapabilityHolders(target.key, ids)
      setNotice(`${people(result.removed.length)} removed.${result.skipped.length ? ` ${skippedText(result.skipped)}` : ''}`)
      setSelected([]); setConfirm(false); await page.refresh(); onChanged()
    } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <Sheet visible title={title} onClose={() => { if (!busy) onClose() }} footer={canManage && chosen.length ? <Button title={`Remove ${people(chosen.length)}`} variant="danger" disabled={busy} onPress={() => setConfirm(true)} /> : undefined}>
    <SearchInput value={q} onChange={value => { setQ(value); setSelected([]); setConfirm(false) }} placeholder="Search people" />
    {!!notice && <Label>{notice}</Label>}{!!error && <Label>{error}</Label>}
    {!!page.error && <ErrorState message={page.error} onRetry={() => void page.refresh()} />}
    {page.loading && !page.items.length && <Spinner label="Loading people" />}
    {!page.loading && !page.error && !page.items.length && <Label>No people found.</Label>}
    {canManage && eligible.length > 0 && <Button variant="ghost" title={chosen.length === eligible.length ? 'Clear selection' : 'Select all shown'} disabled={busy} onPress={() => setSelected(chosen.length === eligible.length ? [] : eligible.map(row => row.id))} />}
    {page.items.map(row => <Pressable key={row.id} accessibilityRole={canManage ? 'checkbox' : undefined} accessibilityState={{ checked: selected.includes(row.id), disabled: !canManage || !removable(target,row) || busy }} disabled={!canManage || !removable(target,row) || busy} onPress={() => setSelected(ids => ids.includes(row.id) ? ids.filter(id => id !== row.id) : [...ids,row.id])} style={{ paddingVertical: 12, gap: 4 }}>
      <Label>{selected.includes(row.id) ? '\u2713 ' : ''}{row.name}{row.is_me ? ' (You)' : ''}</Label><Label>{row.email}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>{row.via?.map(group => <Badge key={group.name}>{group.name}</Badge>)}{row.direct && <Badge tone="info">Direct</Badge>}{row.superuser && <Badge tone="danger">Superuser</Badge>}</View>
      {!removable(target,row) && <Label>{reasonText(row.reason)}</Label>}
    </Pressable>)}
    {page.cursor && <Button variant="secondary" title="Show more" disabled={page.loading || busy} onPress={() => void page.more()} />}
    {confirm && canManage && <Sheet visible title={`Remove ${people(chosen.length)}?`} onClose={() => { if (!busy) setConfirm(false) }} footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button title="Cancel" variant="secondary" disabled={busy} onPress={() => setConfirm(false)} /><Button title="Remove" variant="danger" disabled={busy || !canManage || !chosen.length} onPress={() => void remove()} /></View>}>
      <Label>{chosen.map(row => row.name).join(', ')}</Label>
      <Label>{target.kind === 'group' ? `They leave ${target.group.name} and lose its permissions unless another group grants them.` : `They lose ${target.label}, leave every group granting it, and lose the other permissions from those groups unless granted elsewhere. Any direct grant is also removed.`}</Label>
      {target.kind === 'capability' && [...new Set(chosen.flatMap(row => row.via?.map(group => group.name) ?? []))].map(name => <Badge key={name}>{name}</Badge>)}
      <Label>Each person is checked by the server. Anyone you cannot remove is skipped and listed afterwards. The last Super Administrator cannot be removed.</Label>
      {!!error && <Label>{error}</Label>}
    </Sheet>}
  </Sheet>
}
