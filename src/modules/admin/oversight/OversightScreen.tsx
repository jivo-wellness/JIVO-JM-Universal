import { OversightHeading, OversightRow, OversightHint } from './OversightUi'
import { Icon, type IconName } from '../../../components/Icon'
import { EventDateTime } from '../../../components/EventDateTime'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSession } from '../../../core/auth/Session'
import { useCursor } from '../../../shared/useCursor'
import { useResource } from '../../../shared/useResource'
import { Button, ListSection as Card, EmptyState, ErrorState, Label, Spinner, styles, useColors } from '../../../ui'
import { Badge, PillTabs, SearchInput, Select } from '../../../components/AdminUi'
import { ChatAvatar } from '../../../components/ChatAvatar'
import { Sheet } from '../../../components/Sheet'
import type { PersonCard } from '../../messenger/api'
import * as api from './api'
import { OversightGate, useOversightRequest } from './OversightGate'
import { OversightChat, OversightVault } from './OversightDetail'

type Tab = 'pair' | 'person' | 'all' | 'vaults'
export function OversightScreen() {
  const { me } = useSession()
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.page, { width: '100%', maxWidth: 960, alignSelf: 'center' }]}><OversightGate><Hub key={me?.id} /></OversightGate></ScrollView>
}
function PersonPicker({ title, person, onPick }: { title: string; person: PersonCard | null; onPick: (person: PersonCard) => void }) {
  const [open, setOpen] = useState(false); const c = useColors()
  return <View style={{ gap: 8 }}><OversightHint>{title}</OversightHint><Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${person?.name ?? 'Choose a person'}`} onPress={() => setOpen(true)} style={({ pressed }) => ({ minHeight: 60, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? c.hover : c.panel })}><View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>{person ? <ChatAvatar name={person.name} seed={person.id} size={32} /> : <Icon name="user" size={22} color={c.muted} />}</View><View style={{ flex: 1, minWidth: 0 }}><Label>{person?.name ?? 'Choose a person'}</Label>{!!person?.email && <Text numberOfLines={1} style={{ color: c.muted, fontSize: 12 }}>{person.email}</Text>}</View><Icon name="chevronRight" size={18} color={c.muted} /></Pressable>{open && <People title={title} onClose={() => setOpen(false)} onPick={value => { onPick(value); setOpen(false) }} />}</View>
}
function People({ title, onPick, onClose }: { title: string; onPick: (person: PersonCard) => void; onClose: () => void }) {
  const request = useOversightRequest(); const [q, setQ] = useState(''); const [debounced, setDebounced] = useState('')
  useEffect(() => { const timer = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(timer) }, [q])
  const load = useCallback(async (cursor?: string | null) => { if (debounced.length < 2) return { results: [] as PersonCard[], next_cursor: null }; const result = await request(() => api.searchPeople(debounced,cursor)); return { results: result.results, next_cursor: result.cursor } }, [request,debounced]); const resource = useCursor(load)
  return <Sheet visible title={title} onClose={onClose}><SearchInput placeholder="Search name or email" value={q} onChange={setQ} />{q.trim().length < 2 && <OversightHint>Type at least 2 characters to find a person.</OversightHint>}{resource.loading && debounced.length >= 2 && <Spinner label="Loading people" />}{!!resource.error && <ErrorState message="Could not load people." onRetry={() => void resource.refresh()} />}{debounced.length >= 2 && !resource.loading && !resource.error && !resource.items.length && <OversightHint>No people found.</OversightHint>}{resource.items.map(person => <OversightRow key={person.id} title={person.name} detail={person.email} leading={<ChatAvatar name={person.name} seed={person.id} size={40} />} onPress={() => onPick(person)} />)}{resource.cursor && <Button title="Show more" variant="secondary" disabled={resource.loading} onPress={() => void resource.more()} />}</Sheet>
}
function Hub() {
  const { me } = useSession(); const router = useRouter(); const p = useLocalSearchParams<{ chat?: string; vault?: string; as?: string; focus?: string; view?: string }>()
  const read = !!me?.capabilities.includes('JM_OVERSIGHT_READ'); const search = !!me?.capabilities.includes('JM_OVERSIGHT_SEARCH'); const vaults = !!me?.capabilities.includes('JP_OVERSIGHT_VIEW')
  const tabs: (readonly [Tab, string])[] = [...(read ? [['pair', 'Between two people'], ['person', 'One person'], ['all', 'All chats & groups']] as const : []), ...(vaults ? [['vaults', 'Vaults']] as const : [])]
  const selected = tabs.find(([key]) => key === p.view)?.[0]
  const [first, setFirst] = useState<PersonCard | null>(null); const [second, setSecond] = useState<PersonCard | null>(null)
  const [mode, setMode] = useState('view'); const [kind, setKind] = useState(''); const [q, setQ] = useState('')
  const openChat = (id: string, as?: string, focus?: string) => router.push({ pathname: '/oversight', params: { chat: id, ...(as ? { as } : {}), ...(focus ? { focus } : {}) } })
  const openVault = (id: string) => router.push({ pathname: '/oversight', params: { vault: id } })
  if (p.chat && read) return <OversightChat key={[p.chat,p.as,p.focus].join(':')} id={p.chat} asPerson={p.as} focus={p.focus} onBack={() => router.back()} />
  if (p.vault && vaults) return <OversightVault key={p.vault} id={p.vault} onBack={() => router.back()} />
  const sections: Record<string, { icon: IconName; detail: string }> = {
    pair: { icon: 'users', detail: 'Review the conversation between two people.' },
    person: { icon: 'user', detail: 'Browse one person\'s conversations and groups.' },
    all: { icon: 'messagesSquare', detail: 'Find direct conversations and team groups.' },
    vaults: { icon: 'key', detail: 'Review vaults, entries and authorized reveals.' },
    search: { icon: 'search', detail: 'Find people, conversations, messages and vault items.' },
  }
  if (!p.view) return <View style={{ gap: 12 }}><OversightHeading title="Oversight" detail="Choose what you want to review." /><View>{[...tabs, ...(search ? [['search', 'Search everything']] : [])].map(([key, label]) => <OversightRow key={key} title={label} icon={sections[key].icon} detail={sections[key].detail} onPress={() => router.push({ pathname: '/oversight', params: { view: key } })} />)}</View></View>
  return <View style={{ gap: 20, minWidth: 0 }}><OversightHeading title={tabs.find(([key]) => key === p.view)?.[1] ?? 'Search everything'} detail={sections[p.view]?.detail} onBack={() => router.canGoBack() ? router.back() : router.replace('/oversight')} />
    {search && p.view === 'search' && <Omni onPerson={person => { setFirst(person); router.setParams({ view: 'person' }) }} onChat={openChat} onVault={openVault} canRead={read} canVault={vaults} />}
    {selected === 'pair' && <><PersonPicker title="First person" person={first} onPick={setFirst} /><PersonPicker title="Second person" person={second} onPick={setSecond} />{first && second && first.id === second.id && <Label>Choose two different people.</Label>}</>}
    {selected === 'person' && <><PersonPicker title="Person" person={first} onPick={setFirst} /><PillTabs horizontal label="Person view" value={mode} options={[["view", "View as"], ["all", "All chats (including left)"]]} onChange={setMode} /></>}
    {selected && <SearchInput value={q} onChange={setQ} placeholder={selected === 'vaults' ? 'Search vaults' : 'Search chats'} />}
    {selected === 'vaults' ? <><Select label="Kind" value={kind} options={[["", "All kinds"], ["personal", "Personal"], ["shared", "Team"], ["company", "Company"]]} onChange={setKind} /><VaultList key={`vaults:${q}:${kind}`} q={q} kind={kind} onOpen={openVault} /></> : read && selected && <>
      <Select label="Chats" value={kind} options={[["", "All chats"], ["direct", "Direct chats"], ["group", "Groups"]]} onChange={setKind} />
      {selected === 'all' || selected === 'pair' && first && second && first.id !== second.id || selected === 'person' && first ? <ChatList key={[selected,first?.id,second?.id,kind,q,mode].join(':')} q={q} kind={kind} person={selected === 'all' ? undefined : first?.id} other={selected === 'pair' ? second?.id : undefined} as={selected === 'person' && mode === 'view'} onOpen={openChat} /> : <Label>Choose {selected === 'pair' ? 'two people' : 'a person'} to view their conversations.</Label>}
    </>}
  </View>
}
function ChatList({ q, kind, person, other, as, onOpen }: { q: string; kind: string; person?: string; other?: string; as?: boolean; onOpen: (id: string, as?: string) => void }) {
  const request = useOversightRequest(); const [filter, setFilter] = useState<api.SearchSection | 'all' | 'unread' | 'archived' | 'locked'>('all')
  const load = useCallback(async (cursor?: string | null): Promise<{ results: api.OversightConversationRow[]; next_cursor: string | null }> => {
    if (as && person) { const page = await request(() => api.listAsConversations(person, { q, filter: filter === 'unread' || filter === 'archived' || filter === 'locked' ? filter : kind === 'group' ? 'groups' : kind === 'direct' ? 'direct' : 'all' }, cursor)); return { results: page.results.map(row => ({ id: row.id, title: row.title, avatar_url: row.avatar_url, kind: row.kind, member_count: row.member_count, members: [] as PersonCard[], restricted_company: null, last_message_at: row.last_message?.created_at ?? null, created_at: '', person_left_at: null })), next_cursor: page.next_cursor } }
    const page = await request(() => api.listConversations({ q, kind: kind === 'group' || kind === 'direct' ? kind : '', person, with: other }, cursor)); return { results: page.results, next_cursor: page.cursor }
  }, [request, as, person, other, kind, q, filter]); const page = useCursor(load)
  return <View style={{ gap: 8 }}>{as && <><OversightHint>Read-only view. Every conversation you open is recorded.</OversightHint><PillTabs horizontal label="Chat filter" value={filter} options={[["all", "All"], ["unread", "Unread"], ["archived", "Archived"], ["locked", "Locked"]]} onChange={setFilter} /></>}
    {page.loading && !page.items.length && <Spinner label="Loading chats" />}{!!page.error && <ErrorState message={page.error} onRetry={() => void page.refresh()} />}
    {!page.loading && !page.error && !page.items.length && <EmptyState title="No conversations found." />}
    {page.items.map(row => <OversightRow key={row.id} title={row.title} detail={`${row.kind === 'group' ? `Group \u00b7 ${row.member_count} members` : 'Direct chat'}${row.members.length ? ` \u00b7 ${row.members.map(m => m.name).join(', ')}` : ''}`} leading={<ChatAvatar name={row.title} seed={row.id} size={42} />} onPress={() => onOpen(row.id, as ? person : undefined)}>{row.person_left_at && <Badge tone="warning">Left</Badge>}</OversightRow>)}
    {page.cursor && <Button variant="secondary" size="sm" title="Show more" disabled={page.loading} onPress={() => void page.more()} />}
  </View>
}
function VaultList({ q, kind, onOpen }: { q: string; kind: string; onOpen: (id: string) => void }) {
  const request = useOversightRequest(); const load = useCallback(async (cursor?: string | null) => { const page = await request(() => api.listVaults({ q, kind: ['personal','shared','company'].includes(kind) ? kind : '' }, cursor)); return { results: page.results, next_cursor: page.cursor } }, [request,q,kind]); const page = useCursor(load)
  return <View style={{ gap: 8 }}>{page.loading && !page.items.length && <Spinner label="Loading vaults" />}{!!page.error && <ErrorState message={page.error} onRetry={() => void page.refresh()} />}{!page.loading && !page.error && !page.items.length && <EmptyState title="No vaults found." />}{page.items.map(v => <OversightRow key={v.id} title={v.name} icon="key" detail={`${v.kind} \u00b7 ${v.entry_count} entries${v.owner ? ` \u00b7 ${v.owner.name}` : ''}`} onPress={() => onOpen(v.id)}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{v.frozen && <Badge tone="info">Frozen</Badge>}{v.archived && <Badge>Archived</Badge>}</View></OversightRow>)}{page.cursor && <Button variant="secondary" title="Show more" disabled={page.loading} onPress={() => void page.more()} />}</View>
}
function Omni({ onPerson, onChat, onVault, canRead, canVault }: { onPerson: (person: PersonCard) => void; onChat: (id: string, as?: string, focus?: string) => void; onVault: (id: string) => void; canRead: boolean; canVault: boolean }) {
  const [filters, setFilters] = useState(false); const [person,setPerson] = useState<PersonCard | null>(null); const [other,setOther] = useState<PersonCard | null>(null);
  const request = useOversightRequest(); const [q, setQ] = useState(''); const [section, setSection] = useState<api.SearchSection | ''>(''); const [since, setSince] = useState(''); const [until, setUntil] = useState(''); const [query, setQuery] = useState<api.SearchQuery | null>(null); const [cursor, setCursor] = useState<string | null>(null)
  const load = useCallback(() => query ? request(() => api.search(query, cursor)) : Promise.resolve(null), [request, query, cursor]); const result = useResource(load)
  return <Card><SearchInput value={q} onChange={setQ} placeholder="Search oversight" /><Select label="Search in" value={section} onChange={v => setSection(v as api.SearchSection | '')} options={[["", "Everything"], ["people", "People"], ["conversations", "Conversations"], ["messages", "Messages"], ["vault_items", "Vault items"]]} />
    <View style={{ alignSelf: 'flex-start' }}><Button variant="ghost" size="sm" title={filters ? 'Hide filters' : `Filters${person || other || since || until ? ' - Applied' : ''}`} onPress={() => setFilters(v => !v)} /></View>
    {filters && <View style={{ gap: 16 }}><PersonPicker title="Person" person={person} onPick={setPerson} /><PersonPicker title="With person" person={other} onPick={setOther} />{(person || other) && <Button title="Clear people" variant="ghost" onPress={() => { setPerson(null); setOther(null) }} />}
    <View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><EventDateTime type="date" label="From" value={since} onChange={setSince} /></View><View style={{ flex: 1 }}><EventDateTime type="date" label="To" value={until} min={since} onChange={setUntil} /></View></View></View>}
    <View style={{ alignSelf: 'flex-end' }}><Button title="Search" disabled={q.trim().length < 2 || !!since && !/^\d{4}-\d{2}-\d{2}$/.test(since) || !!until && !/^\d{4}-\d{2}-\d{2}$/.test(until)} onPress={() => { setCursor(null); setQuery({ q: q.trim(), section, person: person?.id, with: other?.id, since: since ? new Date(`${since}T00:00:00`).toISOString() : '', until: until ? new Date(`${until}T23:59:59.999`).toISOString() : '' }) }} /></View>
    {result.loading && query && <Spinner label="Searching" />}{!!result.error && <ErrorState message="Search failed." onRetry={result.refresh} />}
    {result.value && <>{!result.value.people.length && !result.value.conversations.length && !result.value.messages.length && !result.value.vault_items.length && <EmptyState title="No results found." />}{!!result.value.people.length && <Label>People ({result.value.people.length})</Label>}{result.value.people.map(person => <OversightRow key={person.id} title={person.name} icon="user" detail={person.email} disabled={!canRead} onPress={() => onPerson(person)} />)}{!!result.value.conversations.length && <Label>Conversations ({result.value.conversations.length})</Label>}{result.value.conversations.map(chat => <OversightRow key={chat.id} title={chat.title} disabled={!canRead} onPress={() => onChat(chat.id)} />)}{!!result.value.messages.length && <Label>Messages ({result.value.messages.length})</Label>}{result.value.messages.map(hit => <OversightRow key={hit.message.id} title={hit.conversation.title} detail={hit.snippet} disabled={!canRead} onPress={() => onChat(hit.conversation.id, undefined, hit.message.id)} />)}{!!result.value.vault_items.length && <Label>Vault items ({result.value.vault_items.length})</Label>}{result.value.vault_items.map(hit => <OversightRow key={hit.entry.id} title={hit.entry.title} detail={hit.vault.name} icon="key" disabled={!canVault} onPress={() => onVault(hit.vault.id)} />)}
    {(Object.entries(result.value.cursors ?? {}) as [api.SearchSection, string | null][]).filter(([, value]) => value).map(([key, value]) => <Button key={key} title={`More ${key.replace('_', ' ')}`} variant="secondary" onPress={() => { setQuery(old => old && { ...old, section: key }); setCursor(value) }} />)}
    {result.value.cursor && <Button title={result.value.incomplete ? 'Continue search' : 'Show more'} variant="secondary" onPress={() => setCursor(result.value!.cursor)} />}</>}
  </Card>
}
