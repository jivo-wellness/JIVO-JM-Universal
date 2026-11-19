import { useCallback, useState } from 'react'
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Icon } from '../../components/Icon'
import { errorMessage } from '../../core/api/client'
import { useResource } from '../../shared/useResource'
import { Button, Card, Field, Spinner, useColors } from '../../ui'
import { listTickets } from './api'
import { statuses } from './model'
import { PriorityBadge, SectionTitle, StatusBadge, TicketHeading, TicketPage, TicketText, shortDate } from './TicketUi'

export function TicketsScreen() {
  const router = useRouter(); const c = useColors(); const { width } = useWindowDimensions()
  const [page, setPage] = useState(1); const [status, setStatus] = useState('active'); const [mine, setMine] = useState(false)
  const [query, setQuery] = useState(''); const [search, setSearch] = useState('')
  const { value, error, loading, refresh } = useResource(useCallback(() => listTickets({ page, status, search, mine: mine ? '1' : undefined }), [page, status, search, mine]))
  useFocusEffect(useCallback(() => { refresh() }, [refresh]))
  const filter = (next: string) => { setStatus(next); setPage(1) }
  const submitSearch = () => { setSearch(query.trim()); setPage(1) }
  return <TicketPage>
    <TicketHeading title="Bug tickets" subtitle="Report an issue. Follow the fix." action={<Button title="Report a bug" onPress={() => router.push('/tickets/new')} />} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {statuses.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Filter ${label} tickets`} accessibilityState={{ selected: status === key }} onPress={() => filter(key)} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 88, borderRadius: 14, borderWidth: 1, borderColor: status === key ? c.brand : c.border, padding: width < 600 ? 10 : 14, gap: 6, backgroundColor: pressed ? c.neutral : c.panel })}><View style={{ minHeight: 36 }}><TicketText muted small>{label}</TicketText></View><Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 24, lineHeight: 28, color: c.text }}>{value ? value.counts[key] : '–'}</Text></Pressable>)}
    </View>
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1 }}><Field label="Search tickets" compact placeholder="Search title or ticket number" value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={submitSearch} /></View><Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={submitSearch} style={({ pressed }) => ({ width: 48, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.neutral : c.panel, borderWidth: 1, borderColor: c.border })}><Icon name="search" size={20} color={c.text} /></Pressable></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{[['active', 'Active'], ['', 'All'], ...statuses].map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label} tickets`} accessibilityState={{ selected: status === key }} onPress={() => filter(key)} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 17, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: status === key ? c.brand : c.border, backgroundColor: status === key ? c.successSoft : pressed ? c.neutral : c.panel })}><Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: status === key ? c.softText : c.muted }}>{label}</Text></Pressable>)}</ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><TicketText muted small>{loading ? 'Loading tickets…' : `${value?.count ?? 0} ${value?.count === 1 ? 'ticket' : 'tickets'}${search ? ` matching “${search}”` : ''}`}</TicketText><View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>{value?.may_resolve && <Button title={mine ? 'Show everyone' : 'Show mine'} accessibilityLabel={mine ? 'Showing my tickets · Show all' : 'Showing all tickets · Show mine'} variant="ghost" onPress={() => { setMine(v => !v); setPage(1) }} />}<Button title="Refresh" accessibilityLabel="Refresh tickets" variant="ghost" onPress={refresh} /></View></View>
    </View>
    {loading && <Spinner label="Loading tickets" />}
    {!!error && <Card><SectionTitle title="Tickets couldn’t load" detail={errorMessage(error)} /><Button title="Retry" onPress={refresh} /></Card>}
    {value && !value.results.length && <Card style={{ paddingVertical: 36, alignItems: 'center' }}><View style={{ padding: 18, borderRadius: 50, backgroundColor: c.successSoft }}><Icon name="clipboardCheck" size={30} color={c.brand} /></View><SectionTitle title={search ? 'No matching tickets' : 'Nothing here yet'} detail={search ? 'Try another search or choose a different status.' : 'Found something that isn’t working? Let us know.'} />{!!search && <Button title="Clear search" variant="secondary" onPress={() => { setQuery(''); setSearch(''); setPage(1) }} />}</Card>}
    <View style={{ gap: 12 }}>{value?.results.map(ticket => <Pressable key={ticket.code} accessibilityRole="button" accessibilityLabel={`Open ${ticket.code}`} accessibilityHint={`${ticket.title}, ${ticket.status_label}, ${ticket.priority_label} priority`} onPress={() => router.push({ pathname: '/tickets/[code]', params: { code: ticket.code } })} style={({ pressed }) => ({ borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 18, gap: 12, backgroundColor: pressed ? c.neutral : c.panel })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}><StatusBadge status={ticket.status} label={ticket.status_label} /><PriorityBadge priority={ticket.priority} label={ticket.priority_label} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text numberOfLines={2} style={{ flex: 1, color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26 }}>{ticket.title}</Text><Icon name="chevronRight" size={18} color={c.muted} /></View>
      <TicketText muted small>{ticket.code} · Updated {shortDate(ticket.updated_at)}</TicketText>
      <View style={{ borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.neutral }}><Icon name="user" size={14} color={c.muted} /></View><View style={{ flex: 1 }}><TicketText small>{ticket.assignee?.name ?? 'Unassigned'}</TicketText></View><TicketText small muted>By {ticket.raised_by.name}</TicketText></View>
    </Pressable>)}</View>
    {value && value.count > 25 && <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><Button title="Previous" disabled={page === 1} variant="secondary" onPress={() => setPage(p => p - 1)} /><TicketText muted>Page {page}</TicketText><Button title="Next" disabled={page * 25 >= value.count} variant="secondary" onPress={() => setPage(p => p + 1)} /></View>}
  </TicketPage>
}
