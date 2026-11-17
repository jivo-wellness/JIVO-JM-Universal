import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Linking, Platform, Pressable, Text, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import * as chat from '../../modules/messenger/api'
import { errorMessage } from '../../core/api/client'
import { useCursor } from '../../shared/useCursor'
import type { PhoneContact } from '../../modules/messenger/media/contactModel'
import { contactsAccess, deviceContactsSupported, loadDeviceContacts, requestContactsAccess, type ContactsAccess } from '../../modules/messenger/media/deviceContacts'
import { contactSummary, matchContact, sendContactsLabel, toggleChosen, typedContact, type DeviceContact } from '../../modules/messenger/media/selection'
import { Button, EmptyState, ErrorState, Field, useColors } from '../../ui'
import { ChatAvatar } from '../ChatAvatar'
import { Icon } from '../Icon'
import { AttachPage, ListRow, RoundIcon } from './AttachPage'

const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null
type Tab = 'jivo' | 'phone'

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

/**
 * Reference ContactDialog as a full page: "JIVO" (someone in the directory: tap to send their JM card) or
 * "Contacts" (the phone's address book: tick one or more and send them as vCards, or type the details).
 * One search bar filters whichever list is shown.
 */
export function ContactPage({ conversation, onSent, onShareExternal, onClose }: {
  conversation: string
  onSent: (message: chat.Message) => void
  /** Phone contacts go as vCard files through the normal upload (outbox), like the reference. */
  onShareExternal: (contacts: PhoneContact[]) => Promise<void>
  onClose: () => void
}) {
  const c = useColors()
  const [tab, setTab] = useState<Tab>('jivo')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [typing, setTyping] = useState(false)
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const request = useRef({ key: '', id: randomUUID() })

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try { await action() } catch (e) { if (alive.current) setError(errorMessage(e)) } finally { if (alive.current) setBusy(false) }
  }
  const sharePerson = (person: chat.PersonCard) => run(async () => {
    if (request.current.key !== person.id) request.current = { key: person.id, id: randomUUID() }
    const message = await chat.sendContact(conversation, request.current.id, person.id)
    if (alive.current) onSent(message)
  })
  const sharePhone = (list: PhoneContact[]) => run(async () => { await onShareExternal(list); if (alive.current) onClose() })

  const tabs = <View accessibilityRole="tablist" accessibilityLabel="Contacts from" style={{ flexDirection: 'row', gap: 4, marginHorizontal: 12, marginBottom: 10, padding: 4, borderRadius: 999, backgroundColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
    {([['jivo', 'JIVO'], ['phone', 'Contacts']] as const).map(([key, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === key }} aria-selected={tab === key} disabled={busy} onPress={() => { setTab(key); setTyping(false) }}
      style={[{ flex: 1, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === key ? (c.dark ? '#1e293b' : '#ffffff') : 'transparent', boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.15)' : undefined }, pointer]}>
      <Text style={{ color: tab === key ? c.text : c.muted, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14 }}>{label}</Text>
    </Pressable>)}
  </View>

  return <AttachPage title={typing ? 'Type the details' : 'Share a contact'} onBack={() => { if (busy) return; if (typing) setTyping(false); else onClose() }} backLabel={typing ? 'Back to contacts' : 'Close contact'} backDisabled={busy} scroll={typing}
    search={typing ? undefined : { value: search, onChangeText: setSearch, label: tab === 'jivo' ? 'Search people' : 'Search contacts', placeholder: tab === 'jivo' ? 'Search people by name, email or code' : 'Search name, number or email' }}
    below={typing ? undefined : tabs}>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 13, paddingHorizontal: 16, paddingTop: 10 }}>{error}</Text>}
    {typing ? <TypedContact busy={busy} onShare={contact => sharePhone([contact])} />
      : tab === 'jivo' ? <People search={search} busy={busy} onPick={person => void sharePerson(person)} />
        : <PhoneContacts search={search} busy={busy} onShare={list => sharePhone(list)} onType={() => setTyping(true)} />}
  </AttachPage>
}

/** Reference PeoplePicker: the JIVO directory, searched (debounced), endless by cursor. */
function People({ search, busy, onPick }: { search: string; busy: boolean; onPick: (person: chat.PersonCard) => void }) {
  const c = useColors()
  const q = useDebounced(search.trim(), 300)
  const load = useCallback((cursor?: string | null) => chat.searchPeople(q, cursor), [q])
  const page = useCursor(load)
  return <FlatList data={page.items} keyExtractor={p => p.id} keyboardShouldPersistTaps="handled" onEndReachedThreshold={0.4} onEndReached={() => { if (page.cursor && !page.loading) void page.more() }}
    accessibilityLabel="People"
    ListEmptyComponent={page.loading ? <View style={{ padding: 24 }}><ActivityIndicator color={c.brand} accessibilityLabel="Loading people" /></View> : page.error ? <ErrorState message={page.error} onRetry={() => void page.refresh()} /> : <EmptyState title="No one matches." />}
    ListFooterComponent={page.items.length && page.loading ? <View style={{ padding: 12 }}><ActivityIndicator color={c.brand} /></View> : undefined}
    renderItem={({ item: p }) => <ListRow title={p.name} subtitle={[p.email, p.company].filter(Boolean).join(' · ')} disabled={busy} accessibilityLabel={`Send ${p.name}`} accessibilityHint={[p.email, p.company].filter(Boolean).join(', ')} onPress={() => onPick(p)}
      leading={<ChatAvatar name={p.name} seed={p.id} uri={p.avatar_url} size={40} />} />} />
}

/** The phone's address book: permission prompt, denied state, search, multi-select and Send. */
function PhoneContacts({ search, busy, onShare, onType }: { search: string; busy: boolean; onShare: (list: PhoneContact[]) => void; onType: () => void }) {
  const c = useColors()
  const [access, setAccess] = useState<ContactsAccess | 'checking'>(deviceContactsSupported ? 'checking' : 'blocked')
  const [all, setAll] = useState<DeviceContact[] | null>(null); const [loadError, setLoadError] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  useEffect(() => { if (!deviceContactsSupported) return; let alive = true; void contactsAccess().then(value => { if (alive) setAccess(value) }).catch(() => { if (alive) setAccess('undetermined') }); return () => { alive = false } }, [])
  useEffect(() => {
    if (access !== 'granted' || all) return
    let alive = true
    void loadDeviceContacts().then(list => { if (alive) setAll(list) }).catch(e => { if (alive) setLoadError(errorMessage(e)) })
    return () => { alive = false }
  }, [access, all])
  const shown = useMemo(() => (all ?? []).filter(contact => matchContact(contact, search)), [all, search])
  const picked = (all ?? []).filter(contact => chosen.includes(contact.id))
  const typeRow = <ListRow title="Type the details" subtitle="Send a contact that is not on this phone" accessibilityLabel="Type the details" accessibilityHint="Send a contact that is not on this phone" onPress={onType} disabled={busy} leading={<RoundIcon icon="pencil" color={c.brand} background={c.successSoft} />} />

  if (!deviceContactsSupported) return <View>
    <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, padding: 16 }}>This browser cannot open your phone’s contacts. Type the details to send a contact card.</Text>
    {typeRow}
  </View>
  if (access === 'checking') return <View style={{ padding: 24 }}><ActivityIndicator color={c.brand} /></View>
  if (access !== 'granted') return <View style={{ alignItems: 'center', gap: 12, padding: 24 }}>
    <RoundIcon icon="bookUser" color={c.brand} background={c.successSoft} size={64} />
    <Text style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, textAlign: 'center' }}>{access === 'undetermined' ? 'Share contacts from this phone' : 'Contacts access is off'}</Text>
    <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 340 }}>{access === 'undetermined'
      ? 'Allow JM to read your contacts to choose who to share. Only the contacts you send leave this phone.'
      : access === 'denied' ? 'JM cannot read your contacts. Allow access to choose from them, or type the details.' : 'Contacts access was turned off for JM. Turn it on in Settings, or type the details.'}</Text>
    {access === 'blocked'
      ? <Button title="Open settings" onPress={() => void Linking.openSettings().catch(() => {})} />
      : <Button title="Allow access to contacts" onPress={() => void requestContactsAccess().then(setAccess).catch(() => setAccess('blocked'))} />}
    <Button title="Type the details instead" variant="ghost" onPress={onType} />
  </View>
  return <View style={{ flex: 1 }}>
    <FlatList data={shown} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" accessibilityLabel="Phone contacts" initialNumToRender={20} windowSize={9}
      ListHeaderComponent={search.trim() ? undefined : typeRow}
      ListEmptyComponent={loadError ? <ErrorState message={loadError} onRetry={() => { setLoadError(''); setAll(null) }} /> : all === null ? <View style={{ padding: 24 }}><ActivityIndicator color={c.brand} accessibilityLabel="Loading contacts" /></View> : <EmptyState title={search.trim() ? 'No contacts match.' : 'No contacts with a phone number or email.'} />}
      renderItem={({ item }) => { const on = chosen.includes(item.id)
        return <ListRow title={item.name} subtitle={contactSummary(item)} selected={on} disabled={busy} onPress={() => setChosen(list => toggleChosen(list, item.id))}
          leading={<View><ChatAvatar name={item.name} seed={item.id} size={40} />{on && <View style={{ position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={10} color="#ffffff" /></View>}</View>} />
      }} />
    {picked.length > 0 && <View style={{ borderTopWidth: 1, borderColor: c.border, padding: 12, gap: 8, backgroundColor: c.panel }}>
      <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13 }}>{picked.map(p => p.name).join(', ')}</Text>
      <Button title={busy ? 'Sending…' : sendContactsLabel(picked.length)} loading={busy} onPress={() => onShare(picked.map(({ name, phones, emails }) => ({ name, phones, emails })))} />
    </View>}
  </View>
}

/** Reference PhoneContactForm: name, phone, optional email. */
function TypedContact({ busy, onShare }: { busy: boolean; onShare: (contact: PhoneContact) => void }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' })
  const contact = typedContact(form)
  return <View style={{ padding: 16, gap: 16 }}>
    <Field label="Name" value={form.name} maxLength={80} editable={!busy} autoFocus onChangeText={name => setForm(f => ({ ...f, name }))} />
    <Field label="Phone" value={form.phone} maxLength={30} keyboardType="phone-pad" editable={!busy} onChangeText={phone => setForm(f => ({ ...f, phone }))} />
    <Field label="Email (optional)" value={form.email} maxLength={120} keyboardType="email-address" autoCapitalize="none" editable={!busy} onChangeText={email => setForm(f => ({ ...f, email }))} />
    <Button title={busy ? 'Sending…' : 'Send contact'} loading={busy} disabled={!contact} onPress={() => { if (contact) onShare(contact) }} />
  </View>
}
