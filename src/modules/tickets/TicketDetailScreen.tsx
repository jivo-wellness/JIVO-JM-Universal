import { useCallback, useState } from 'react'
import { Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Select } from './TicketSelect'
import { errorMessage } from '../../core/api/client'
import { useResource } from '../../shared/useResource'
import { Button, Card, Field, Label, Spinner, useColors } from '../../ui'
import { PriorityBadge, SectionTitle, StatusBadge, TicketPage, TicketText } from './TicketUi'
import { getTicket, listResolvers, replyTicket, updateTicket } from './api'
import { priorities, statuses, type TicketDetail, type TicketPriority, type TicketStatus } from './model'
import { FilePicker, TicketFiles, useTicketFiles } from './TicketFiles'
import { ViewDisabled } from './ReportTicketScreen'
import { useTicketAction } from './useTicketAction'
export function TicketDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>(); const router = useRouter()
  const { value, error, loading, refresh } = useResource(useCallback(() => getTicket(code), [code]))
  useFocusEffect(useCallback(() => { refresh() }, [refresh]))
  return <TicketPage maxWidth={760}><Button title="Back to tickets" variant="ghost" style={{ alignSelf: 'flex-start' }} onPress={() => router.replace('/tickets')} />{loading && <Spinner />}{!!error && <Card><Label>{errorMessage(error)}</Label><Button title="Retry" onPress={refresh} /></Card>}{value && <Detail key={`${value.code}-${value.updated_at}`} ticket={value} refresh={refresh} />}</TicketPage>
}
function Detail({ ticket, refresh }: { ticket: TicketDetail; refresh: () => void }) {
  const action = useTicketAction(); const picker = useTicketFiles(); const [body, setBody] = useState(''); const [reason, setReason] = useState('')
  const change = (status: TicketStatus) => void action.run(signal => updateTicket(ticket.code, { status, ...(status === 'closed' ? { resolution: reason.trim() } : {}) }, signal), refresh)
  const c = useColors(); const [withdrawing, setWithdrawing] = useState(false)
  return <>
    <Card style={{ padding: 22, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}><StatusBadge status={ticket.status} label={ticket.status_label} /><PriorityBadge priority={ticket.priority} label={ticket.priority_label} /></View>
      <View style={{ gap: 6 }}><TicketText muted small>{ticket.code}</TicketText><Text accessibilityRole="header" style={{ color: c.text, fontSize: 25, lineHeight: 34, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.4 }}>{ticket.title}</Text></View>
      <TicketText>{ticket.description}</TicketText>
      <TicketFiles code={ticket.code} files={ticket.files} />
      <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 16, gap: 6 }}><TicketText muted>Reported by {ticket.raised_by.name}</TicketText><TicketText muted>Assigned to {ticket.assignee?.name ?? 'Unassigned'}</TicketText><TicketText muted small>Created {new Date(ticket.created_at).toLocaleString()}</TicketText>{!!ticket.page_url && <TicketText muted small>Screen: {ticket.page_url}</TicketText>}{!!ticket.browser && <TicketText muted small>Device: {ticket.browser}</TicketText>}</View>
      {!!ticket.resolution && <View style={{ padding: 14, borderRadius: 12, backgroundColor: c.successSoft, gap: 4 }}><TicketText strong>Resolution</TicketText><TicketText>{ticket.resolution}</TicketText></View>}
    </Card>
    {ticket.can.resolve && <WorkTicket ticket={ticket} refresh={refresh} />}
    {ticket.can.reopen && <Button title="Reopen ticket" variant="secondary" disabled={action.busy} onPress={() => change('open')} />}
    <Card style={{ padding: 22, gap: 20 }}><SectionTitle title="Activity" detail="Updates and replies, all in one place." />
      {!ticket.timeline.length && <TicketText muted>No updates yet. Add a reply below if you have more details.</TicketText>}
      {ticket.timeline.map(entry => <View key={entry.id} style={{ borderLeftWidth: 2, borderLeftColor: c.border, paddingLeft: 16, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}><TicketText strong>{entry.author?.name ?? 'System'}</TicketText><TicketText muted small>{new Date(entry.at).toLocaleString()}</TicketText></View>{!!entry.event && <TicketText muted small>{entry.event}</TicketText>}{!!entry.body && <TicketText>{entry.body}</TicketText>}<TicketFiles code={ticket.code} files={entry.files} /></View>)}
    </Card>
    <Card style={{ padding: 22, gap: 18 }}><SectionTitle title="Add a reply" /><Field label="Reply message" placeholder="Share an update or add more detail..." value={body} onChangeText={setBody} multiline maxLength={10000} editable={!action.busy} style={{ minHeight: 100 }} /><FilePicker picker={picker} disabled={action.busy} />{!!action.error && <Label>{action.error}</Label>}<Button title={action.busy ? 'Submitting...' : 'Send reply'} disabled={action.busy || (!body.trim() && !picker.files.length)} onPress={() => void action.run(signal => replyTicket(ticket.code, body.trim(), picker.files, signal), () => { picker.clear(); refresh() })} /></Card>
    {ticket.can.withdraw && <View style={{ gap: 12 }}><Button title={withdrawing ? 'Cancel withdrawal' : 'Withdraw this ticket'} variant="ghost" disabled={action.busy} onPress={() => setWithdrawing(v => !v)} />{withdrawing && <Card><SectionTitle title="Withdraw ticket" detail="No longer an issue? Leave a reason for the team." /><Field label="Reason for withdrawing" value={reason} onChangeText={setReason} maxLength={5000} editable={!action.busy} /><Button title="Withdraw ticket" variant="danger" disabled={action.busy || !reason.trim()} onPress={() => change('closed')} /></Card>}</View>}
    <Button title="Refresh ticket" variant="ghost" disabled={action.busy} onPress={refresh} />
  </>
}
function WorkTicket({ ticket, refresh }: { ticket: TicketDetail; refresh: () => void }) {
  const compact = useWindowDimensions().width < 600
  const [expanded, setExpanded] = useState(false)
  const action = useTicketAction(); const [status, setStatus] = useState<TicketStatus>(ticket.status); const [priority, setPriority] = useState<TicketPriority>(ticket.priority); const [resolution, setResolution] = useState(ticket.resolution); const [assignee, setAssignee] = useState(ticket.assignee?.id ?? '')
  const resolvers = useResource(useCallback(() => ticket.can.assign ? listResolvers() : Promise.resolve([]), [ticket.can.assign]))
  return <Card style={{ padding: 20, gap: 16 }}><View style={{ flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', alignItems: compact ? 'stretch' : 'center', gap: 12 }}><View style={{ flex: 1 }}><SectionTitle title="Ticket management" detail="Assignment, priority and resolution" /></View><Button title={expanded ? 'Hide controls' : 'Manage ticket'} variant="secondary" onPress={() => setExpanded(v => !v)} /></View>{expanded && <><ViewDisabled disabled={action.busy}><Select label="Status" value={status} options={statuses} onChange={setStatus} /></ViewDisabled><ViewDisabled disabled={action.busy}><Select label="Priority" value={priority} options={priorities} onChange={setPriority} /></ViewDisabled>{ticket.can.assign && <><ViewDisabled disabled={action.busy || resolvers.loading || !!resolvers.error}><Select label="Assignee" value={assignee} options={[[ '', 'Unassigned' ], ...(ticket.assignee && !resolvers.value?.some(p => p.id === ticket.assignee?.id) ? [[ticket.assignee.id, ticket.assignee.name] as const] : []), ...(resolvers.value ?? []).map(p => [p.id, p.name] as const)]} onChange={setAssignee} /></ViewDisabled>{!!resolvers.error && <><Label>{errorMessage(resolvers.error)}</Label><Button title="Retry assignees" onPress={resolvers.refresh} /></>}</>}<Field label="Resolution / closing reason" value={resolution} onChangeText={setResolution} multiline maxLength={5000} editable={!action.busy} />{!!action.error && <Label>{action.error}</Label>}<Button title={action.busy ? 'Saving…' : 'Save changes'} disabled={action.busy || (status === 'closed' && !resolution.trim())} onPress={() => void action.run(signal => updateTicket(ticket.code, { status, priority, resolution: resolution.trim(), ...(ticket.can.assign && assignee !== (ticket.assignee?.id ?? '') ? { assignee: assignee || null } : {}) }, signal), refresh)} /></>}</Card>
}
