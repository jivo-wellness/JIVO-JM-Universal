import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { createGroup, openDirect, searchPeople, type ConversationItem, type PersonCard } from '../modules/messenger/api'
import { Button, ErrorState, Field, useColors } from '../ui'
import { useSession } from '../core/auth/Session'
import { useCursor } from '../shared/useCursor'
import { errorMessage, origin } from '../core/api/client'
import { mediaUrl } from '../modules/messenger/media/url'
import { ChatAvatar } from './ChatAvatar'
import { Icon } from './Icon'
import { personSubtitle, pickerRows } from './conversationPickerModel'

const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as object
const hovered = (state: object) => Boolean((state as { hovered?: boolean }).hovered)

/** Reference useDebounced: the directory is asked once typing pauses, not on every key. */
function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(t) }, [value, ms])
  return debounced
}

/**
 * Reference NewChatDialog + PeoplePicker as a full-screen page, laid out like WhatsApp's "Select contact": a header
 * with Back, the title and Search; "New group" and "Message yourself" rows; then everyone in the JM directory (server
 * order: by name) with photo, name and email · company, loading more on scroll. "New group" is the same page with the
 * group name, chosen members and Create group.
 */
export function ConversationPicker({ groupAllowed, onChoose, onClose }: { groupAllowed: boolean; onChoose: (value: ConversationItem) => void; onClose: () => void }) {
  const c = useColors(); const { me } = useSession(); const inset = useSafeAreaInsets()
  const [search, setSearch] = useState(''); const [searching, setSearching] = useState(false)
  const query = useDebounced(search.trim())
  const [group, setGroup] = useState(false); const [title, setTitle] = useState(''); const [members, setMembers] = useState<PersonCard[]>([])
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const load = useCallback((cursor?: string | null) => searchPeople(query, cursor), [query])
  const page = useCursor(load)
  const searchRef = useRef<ComponentRef<typeof TextInput>>(null)
  const back = () => {
    if (busy) return
    if (searching) { setSearching(false); setSearch(''); return }
    if (group) { setGroup(false); setError(''); return }
    onClose()
  }
  async function direct(id: string) {
    setBusy(true); setError('')
    try { onChoose(await openDirect(id)) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  function choose(person: PersonCard) {
    if (group) { setMembers(list => list.some(m => m.id === person.id) ? list.filter(m => m.id !== person.id) : [...list, person]); return }
    void direct(person.id)
  }
  async function create() {
    setBusy(true); setError('')
    try { onChoose(await createGroup({ title: title.trim(), member_ids: members.map(m => m.id) })) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const { people, self } = pickerRows(page.items, me, query, group)
  const chosen = new Set(members.map(m => m.id))
  const heading = group ? 'New group' : 'New chat'
  const subtitle = group ? (members.length ? `${members.length} selected` : 'Add members') : undefined
  const rowStyle = (state: object, on = false, disabled = false) => ({ minHeight: 72, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 16, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: on ? c.successSoft : (state as { pressed?: boolean }).pressed || hovered(state) ? (c.dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)') : 'transparent', opacity: disabled ? 0.5 : 1, ...pointer })
  const nameText = { color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 16, lineHeight: 22 }
  const subText = { color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }
  const section = (label: string) => <Text accessibilityRole="header" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, color: c.muted, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{label}</Text>
  const actionRow = (label: string, icon: 'users', onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={onPress} style={state => rowStyle(state, false, busy)}>
    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color="#ffffff" /></View>
    <Text style={nameText}>{label}</Text>
  </Pressable>
  const header = <View>
    {!group && !searching && groupAllowed && actionRow('New group', 'users', () => { setGroup(true); setError('') })}
    {self && <Pressable accessibilityRole="button" accessibilityLabel={`Chat with ${self.name} (You)`} disabled={busy} onPress={() => choose(self)} style={state => rowStyle(state, false, busy)}>
      <ChatAvatar name={self.name} seed={self.id} uri={mediaUrl(self.avatar_url, origin)} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={nameText}>{self.name} (You)</Text><Text numberOfLines={1} style={subText}>Message yourself</Text></View>
    </Pressable>}
    {group && <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
      <Field label="Group name" value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. Plant Ops — Ludhiana" />
      {members.length > 0 && <View accessibilityLabel="Chosen members" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {members.map(m => <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, backgroundColor: c.successSoft, paddingLeft: 10, paddingRight: 6, paddingVertical: 2 }}>
          <Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 12, lineHeight: 16 }}>{m.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} onPress={() => choose(m)} style={{ padding: 4, borderRadius: 999, ...pointer }}><Icon name="x" size={12} color={c.brand} /></Pressable>
        </View>)}
      </View>}
    </View>}
    {!!error && <Text accessibilityRole="alert" style={{ paddingHorizontal: 16, paddingTop: 8, color: c.danger, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{error}</Text>}
    {(people.length > 0 || page.loading) && section(query ? 'Search results' : 'People on JM')}
  </View>
  const empty = page.loading ? <ActivityIndicator style={{ marginTop: 24 }} color={c.brand} accessibilityLabel="Loading people" />
    : page.error ? <View style={{ paddingHorizontal: 16 }}><ErrorState message={page.error} onRetry={() => void page.refresh()} /></View>
    : <Text style={{ padding: 24, textAlign: 'center', ...subText, fontSize: 14 }}>No one matches.</Text>
  return <Modal visible onRequestClose={back} animationType="slide">
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg, paddingTop: inset.top, paddingBottom: inset.bottom }}>
      <View accessibilityViewIsModal style={{ flex: 1, width: '100%' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 56, paddingHorizontal: 4, backgroundColor: c.panel, borderBottomWidth: 1, borderColor: c.border }}>
          <Pressable accessibilityRole="button" accessibilityLabel={searching ? 'Close search' : 'Back'} disabled={busy} onPress={back} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="back" size={24} /></Pressable>
          {searching ? <TextInput ref={searchRef} autoFocus selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" value={search} onChangeText={setSearch} placeholder="Search name, email or code" accessibilityLabel="Search people by name, email or code" placeholderTextColor={c.muted} returnKeyType="search"
            style={{ flex: 1, minWidth: 0, height: 48, paddingHorizontal: 4, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 16, ...(web ? ({ outlineStyle: 'none' } as object) : {}) }} />
            : <View style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
              <Text accessibilityRole="header" numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 19, lineHeight: 24 }}>{heading}</Text>
              {!!subtitle && <Text numberOfLines={1} style={subText}>{subtitle}</Text>}
            </View>}
          {searching ? !!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => { setSearch(''); searchRef.current?.focus() }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="x" size={20} /></Pressable>
            : <Pressable accessibilityRole="button" accessibilityLabel="Search people" onPress={() => setSearching(true)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="search" size={22} /></Pressable>}
        </View>
        <FlatList accessibilityLabel="People" data={people} keyExtractor={p => p.id} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}
          ListHeaderComponent={header} ListEmptyComponent={empty}
          ListFooterComponent={<View style={{ minHeight: 24, alignItems: 'center', justifyContent: 'center', paddingBottom: 8 }}>{page.loading && people.length > 0 && <ActivityIndicator color={c.brand} />}{busy && <ActivityIndicator color={c.brand} />}</View>}
          onEndReachedThreshold={0.5} onEndReached={() => { if (page.cursor && !page.loading) void page.more() }}
          renderItem={({ item: p }) => { const on = chosen.has(p.id); const disabled = busy || !p.is_active
            return <Pressable accessibilityRole="button" accessibilityLabel={group ? `${on ? 'Remove' : 'Select'} ${p.name}` : `Chat with ${p.name}`} accessibilityState={group ? { selected: on, disabled } : { disabled }} disabled={disabled} onPress={() => choose(p)} style={state => rowStyle(state, on, !p.is_active)}>
              <View><ChatAvatar name={p.name} seed={p.id} uri={mediaUrl(p.avatar_url, origin)} size={48} />
                {on && <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={12} color="#ffffff" /></View>}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={nameText}>{p.name}</Text>
                {!!personSubtitle(p) && <Text numberOfLines={1} style={subText}>{personSubtitle(p)}</Text>}
              </View>
            </Pressable> }} />
        {group && <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Button variant="secondary" title="Back" disabled={busy} onPress={() => { setGroup(false); setError('') }} />
          <Button title="Create group" accessibilityLabel={`Create group (${members.length} selected)`} loading={busy} disabled={!title.trim() || !members.length} onPress={() => void create()} />
        </View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>
}
