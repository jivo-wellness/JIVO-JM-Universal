import { useCallback, useRef, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSession } from '../../core/auth/Session'
import { useCursor } from '../../shared/useCursor'
import { Badge, SearchInput, Select } from '../../components/AdminUi'
import { EventDateTime } from '../../components/EventDateTime'
import { Button, ListSection as Card, ErrorState, Label, Spinner, styles, useColors } from '../../ui'
import * as api from './api'

export function AuditScreen() {
  const { me } = useSession()
  return me?.capabilities.includes('ADMIN_AUDIT_VIEW') ? <Audit /> : <Label>Audit access is not enabled for your account.</Label>
}
function Audit() {
  const c = useColors(); const [filters, setFilters] = useState<api.AuditFilters>({})
  const generation = useRef(0)
  const [verification, setVerification] = useState<api.AuditVerification | null>(null)
  const set = (key: keyof api.AuditFilters, value: string) => { generation.current++; setVerification(null); setFilters(old => ({ ...old, [key]: value })) }
  const load = useCallback(async (cursor?: string | null) => {
    const token = generation.current
    const result = await api.listAudit({ ...filters, since: filters.since ? new Date(`${filters.since}T00:00:00`).toISOString() : '', until: filters.until ? new Date(`${filters.until}T23:59:59.999`).toISOString() : '' }, cursor)
    if (!cursor && token === generation.current) setVerification(result.verification ?? null)
    return { results: result.results, next_cursor: result.cursor }
  }, [filters])
  const page = useCursor(load)
  return <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"><Label large>Audit log</Label><Label>Everything JM records: sign-ins, administration, moderation, Passwords and oversight.</Label>
    <Select label="Stream" value={filters.stream ?? ''} onChange={value => set('stream',value)} options={[["", "All streams"], ...api.AUDIT_STREAMS.map(stream => [stream, stream] as const)]} />
    <SearchInput value={filters.action ?? ''} onChange={value => set('action',value)} placeholder="Action, e.g. admin.user_frozen" />
    <Select label="Outcome" value={filters.outcome ?? ''} onChange={value => set('outcome',value)} options={[["", "Any outcome"], ["success", "Success"], ["denied", "Denied"], ["failure", "Failure"]]} />
    <View style={{ flexDirection: 'row', gap: 8 }}><EventDateTime type="date" label="From" value={filters.since ?? ''} onChange={value => set('since',value)} /><EventDateTime type="date" label="To" min={filters.since} value={filters.until ?? ''} onChange={value => set('until',value)} /></View>
    {!!filters.actor && <Badge>Person: {filters.actor}</Badge>}{!!filters.target && <Badge>Target: {filters.target}</Badge>}
    {Object.values(filters).some(Boolean) && <Button title="Clear filters" variant="ghost" onPress={() => { generation.current++; setVerification(null); setFilters({}) }} />}
    {!filters.stream ? <Label>Choose a stream to check that its records are intact.</Label> : verification && <Text accessibilityRole={verification.ok ? 'text' : 'alert'} style={{ color: verification.ok ? c.brand : c.danger }}>{verification.ok ? `Chain verified: ${verification.checked} records checked, none changed or missing.` : `Chain broken${verification.broken_at === null ? '' : ` at record #${verification.broken_at}`}. Report this to security.`}</Text>}
    {!!page.error && <ErrorState message={page.error} onRetry={() => void page.refresh()} />}{page.loading && !page.items.length && <Spinner label="Loading audit log" />}
    {!page.loading && !page.error && !page.items.length && <Label>No records found.</Label>}
    {page.items.map(event => <Card key={event.id}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><Badge>{event.stream}</Badge><Badge tone={event.outcome === 'success' ? 'success' : event.outcome === 'denied' || event.outcome === 'failure' ? 'danger' : 'neutral'}>{event.outcome}</Badge></View><Label>{event.action}</Label><Text style={{ color: c.muted }}>{new Date(event.at).toLocaleString()}</Text>
      {event.actor && <Button title={event.actor.name} variant="ghost" onPress={() => set('actor',event.actor!.id)} />}{event.target && <Button title={event.target.label || event.target.id} variant="ghost" onPress={() => set('target',event.target!.id)} />}
      {!!event.ip && <Label>{event.ip}</Label>}{Object.entries(event.details).map(([key,value]) => <Text key={key} selectable style={{ color: c.muted }}>{key}: {typeof value === 'string' ? value : JSON.stringify(value)}</Text>)}
    </Card>)}
    {page.cursor && <Button title="Show more" variant="secondary" disabled={page.loading} onPress={() => void page.more()} />}
  </ScrollView>
}
