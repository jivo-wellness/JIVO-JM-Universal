import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { router, useLocalSearchParams, type Href } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { useSession } from '../core/auth/Session'
import { errorMessage, origin } from '../core/api/client'
import { listConversations, openDirect, searchPeople, type ConversationItem } from '../modules/messenger/api'
import { enqueueFiles, outbox } from '../modules/messenger/outbox'
import { mediaUrl } from '../modules/messenger/media/url'
import { fileKind } from '../modules/messenger/media/selection'
import type { PickedFile } from '../modules/messenger/media/model'
import { incomingShareGeneration, incomingStorage, onIncomingShareChange } from '../modules/sharing/incoming'
import { chatTarget, peopleWithoutChats, personTarget, shareSummary, toggleTarget, unshareableReason, type IncomingShare, type ShareTarget } from '../modules/sharing/model'
import { sendShare, shareFailureMessage, type ShareSendDeps } from '../modules/sharing/send'
import { SHARE_MAX_TEXT, shareIntakeMessage } from '../modules/sharing/shareTarget'
import { landingRoute } from '../shared/authNavigation'
import { useCursor } from '../shared/useCursor'
import { Button, ErrorState, useColors } from '../ui'
import { AttachmentPreview } from './AttachmentPreview'
import { AttachPage } from './attach/AttachPage'
import { ChatAvatar } from './ChatAvatar'
import { personSubtitle, pickerRows } from './conversationPickerModel'
import { Icon } from './Icon'

const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as object
type Loaded = { status: 'loading' } | { status: 'none' } | { status: 'failed'; message: string; id?: string } | { status: 'ready'; share: IncomingShare }
type Row = { type: 'section'; key: string; title: string } | { type: 'target'; key: string; target: ShareTarget; subtitle: string; reason: string | null; avatar: { name: string; seed: string; uri?: string | null; group: boolean } }

function useDebounced(value: string, ms = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => { const t = setTimeout(() => setDebounced(value), ms); return () => clearTimeout(t) }, [value, ms])
  return debounced
}
/** Browser shares are File objects: give them object URLs for the previews while the page is open. */
function withPreviewUris(share: IncomingShare): { share: IncomingShare; release: () => void } {
  if (!web || typeof URL === 'undefined' || !URL.createObjectURL) return { share, release: () => {} }
  const urls: string[] = []
  const files = share.files.map(file => { if (file.uri || !file.file) return file; const uri = URL.createObjectURL(file.file); urls.push(uri); return { ...file, uri } })
  return { share: { ...share, files }, release: () => urls.forEach(url => URL.revokeObjectURL(url)) }
}

/**
 * Share into JM (U-036), WhatsApp style: "Send to…" (search, recent chats, people on JM; one or up to five chats),
 * then for files the attachment preview page (caption, thumbnails, remove, image editor, add more) and Send; text and
 * links are edited and sent from the "Send to…" page itself. Everything goes through the outbox, so it is saved on the
 * device first and sent in the background, like a message typed in the chat.
 */
export function ShareFlow() {
  const { me } = useSession(); const c = useColors()
  const params = useLocalSearchParams<{ shareError?: string }>()
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const release = useRef<() => void>(() => {})
  // The share on screen: a reload for the same share (app back in front) keeps the page and what was chosen.
  const shown = useRef<string | null>(null)
  const owner = me?.id ?? ''
  const allowed = (me?.capabilities ?? []).includes('JM_ACCESS')
  const leave = useCallback(() => router.replace(landingRoute(me?.capabilities ?? []) as Href), [me?.capabilities])

  const load = useCallback(async () => {
    if (!owner) return
    const generation = incomingShareGeneration()
    try {
      await incomingStorage.capture().catch(() => false)
      const share = await incomingStorage.read(owner)
      if (generation !== incomingShareGeneration()) return
      // Sent or discarded in the meantime: this page is already leaving.
      if (!share) { if (!shown.current) setLoaded({ status: 'none' }); return }
      if (shown.current === share.id) return
      shown.current = share.id
      release.current(); const view = withPreviewUris(share); release.current = view.release
      setLoaded(share.error ? { status: 'failed', message: share.error, id: share.id } : { status: 'ready', share: view.share })
    } catch (error) { if (generation === incomingShareGeneration()) setLoaded({ status: 'failed', message: errorMessage(error) }) }
  }, [owner])
  useEffect(() => {
    void Promise.resolve().then(load)
    const off = onIncomingShareChange(() => { void load() })
    return () => { off(); release.current() }
  }, [load])

  async function discard(id?: string) {
    try { await incomingStorage.clear(id) } catch { /* the next sign-out or share removes it */ }
    leave()
  }

  if (!allowed) return <Notice title="Share to JM" message="Chats aren't turned on for your account, so this can't be sent from JM." action="Close" onAction={() => { const id = loaded.status === 'ready' ? loaded.share.id : loaded.status === 'failed' ? loaded.id : undefined; if (id) void discard(id); else leave() }} />
  if (loaded.status === 'loading') return <AttachPage title="Share to JM" onBack={leave} backIcon="x" backLabel="Close" scroll={false}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}><ActivityIndicator color={c.brand} /><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14 }}>Preparing what you shared…</Text></View>
  </AttachPage>
  if (loaded.status === 'failed') return <Notice title="Share to JM" message={loaded.message} action="Close" onAction={() => { if (loaded.id) void discard(loaded.id); else leave() }} />
  if (loaded.status === 'none') return <Notice title="Share to JM" message={params.shareError ? shareIntakeMessage(params.shareError) : 'Nothing to share. Share photos, videos, files or text from another app and choose JM.'} action="Go to chats" onAction={leave} />
  return <SendTo key={loaded.share.id} share={loaded.share} owner={owner} onDiscard={() => void discard(loaded.share.id)} />
}

function Notice({ title, message, action, onAction }: { title: string; message: string; action: string; onAction: () => void }) {
  const c = useColors()
  return <AttachPage title={title} onBack={onAction} backIcon="x" backLabel={action}>
    <View style={{ padding: 24, gap: 16, alignItems: 'center' }}>
      <Icon name="share" size={32} color={c.muted} />
      <Text accessibilityRole="alert" style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 480 }}>{message}</Text>
      <Button title={action} onPress={onAction} />
    </View>
  </AttachPage>
}

function SendTo({ share, owner, onDiscard }: { share: IncomingShare; owner: string; onDiscard: () => void }) {
  const c = useColors(); const { me } = useSession()
  const hasFiles = share.files.length > 0
  const [search, setSearch] = useState(''); const query = useDebounced(search.trim())
  const [targets, setTargets] = useState<ShareTarget[]>([])
  const [text, setText] = useState(share.text)
  const [stage, setStage] = useState<'pick' | 'preview'>('pick')
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  // Chats that already have the share (kept across retries) and stable message ids per content and chat.
  const done = useRef(new Map<string, ConversationItem>()); const ids = useRef(new Map<string, string>())
  const textSeed = useRef(randomUUID())
  const loadChats = useCallback((cursor?: string | null) => listConversations('all', query, cursor), [query])
  const loadPeople = useCallback((cursor?: string | null) => searchPeople(query, cursor), [query])
  const chats = useCursor(loadChats); const people = useCursor(loadPeople)

  const listed = chats.items.filter(chat => !chat.left && !chat.locked && !chat.archived_at)
  const { self, people: directory } = pickerRows(people.items, me, query, false)
  const persons = peopleWithoutChats([...(self ? [self] : []), ...directory], chats.items, me?.id)
  const row = (target: ShareTarget, subtitle: string, reason: string | null, avatar: Extract<Row, { type: 'target' }>['avatar']): Row => ({ type: 'target', key: target.key, target, subtitle, reason, avatar })
  const rows: Row[] = [
    ...(listed.length ? [{ type: 'section' as const, key: 's:chats', title: query ? 'Chats' : 'Recent chats' }] : []),
    ...listed.map(chat => row(chatTarget(chat), chat.kind === 'group' ? `${chat.member_count} members` : chat.is_self ? 'Message yourself' : chat.peer ? personSubtitle(chat.peer) : '', unshareableReason(chat, hasFiles),
      { name: chat.title || chat.peer?.name || 'Chat', seed: chat.peer?.id ?? chat.id, uri: mediaUrl(chat.avatar_url ?? chat.peer?.avatar_url, origin), group: chat.kind === 'group' })),
    ...(persons.length ? [{ type: 'section' as const, key: 's:people', title: query ? 'People' : 'People on JM' }] : []),
    ...persons.map(person => { const you = person.id === me?.id
      return row(personTarget(person, you ? `${person.name} (You)` : person.name), you ? 'Message yourself' : personSubtitle(person), person.is_active ? null : 'Inactive account',
        { name: person.name, seed: person.id, uri: mediaUrl(person.avatar_url, origin), group: false }) }),
  ]
  const chosen = new Set(targets.map(target => target.key))

  function toggle(target: ShareTarget) {
    if (busy) return
    const next = toggleTarget(targets, target); setTargets(next.list); setNotice(next.notice); setError('')
  }
  const deps = (seed: string): ShareSendDeps => ({
    openDirect: id => openDirect(id),
    enqueueText: (who, conversation, payload) => outbox.enqueue(who, conversation, payload),
    enqueueFiles: (who, conversation, payload, files) => enqueueFiles(who, conversation, payload, files),
    clientId: conversation => { const key = seed + ':' + conversation; let id = ids.current.get(key); if (!id) { id = randomUUID(); ids.current.set(key, id) } return id },
    message: errorMessage,
  })
  /** Queues the share for every chosen chat; throws the sentence to show if any chat did not take it. */
  async function deliver(body: string, files: { key: string; file: PickedFile }[], seed: string) {
    const generation = incomingShareGeneration()
    const result = await sendShare(deps(seed), { owner, targets, body, files, done: done.current })
    if (generation !== incomingShareGeneration()) throw Error('You signed out, so nothing more was sent.')
    if (result.failed.length) throw Error(shareFailureMessage(result))
    try { await incomingStorage.clear(share.id) } catch { /* the outbox has its own copies; the next share or sign-out removes these */ }
    const sent = result.sent
    router.replace((sent.length === 1 ? { pathname: '/messenger', params: { conversation: sent[0].id } } : '/messenger') as Href)
  }
  async function sendText() {
    if (busy || !targets.length) return
    setBusy(true); setError('')
    try { await deliver(text, [], textSeed.current) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const names = targets.map(target => target.title).join(', ')
  const media = share.files.every(file => fileKind(file) !== 'file')

  const footer = targets.length || !hasFiles ? <View style={{ gap: 10 }}>
    {!hasFiles && <TextInput accessibilityLabel="Message" placeholder="Message" placeholderTextColor={c.muted} value={text} maxLength={SHARE_MAX_TEXT} multiline editable={!busy}
      onChangeText={value => { setText(value); textSeed.current = randomUUID() }} selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent"
      style={[{ minHeight: 44, maxHeight: 140, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, backgroundColor: c.dark ? '#0f172a' : '#ffffff', borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, textAlignVertical: 'center' }, web ? ({ outlineStyle: 'none' } as object) : null]} />}
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }}>{error}</Text>}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text numberOfLines={2} accessibilityLabel={targets.length ? `Sending to ${names}` : 'No chat chosen'} style={{ flex: 1, minWidth: 0, color: targets.length ? c.text : c.muted, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{targets.length ? names : 'Choose up to 5 chats'}</Text>
      {busy && <ActivityIndicator color={c.brand} />}
      <Pressable accessibilityRole="button" accessibilityLabel={hasFiles ? `Next: review ${share.files.length === 1 ? 'the file' : `${share.files.length} files`}` : error ? 'Retry sending' : `Send to ${targets.length} ${targets.length === 1 ? 'chat' : 'chats'}`}
        accessibilityState={{ disabled: busy || !targets.length || (!hasFiles && !text.trim()) }} disabled={busy || !targets.length || (!hasFiles && !text.trim())}
        onPress={() => { if (hasFiles) { setError(''); setStage('preview') } else void sendText() }}
        style={({ pressed }) => [{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? c.primaryHover : c.primary, opacity: busy || !targets.length || (!hasFiles && !text.trim()) ? 0.5 : 1 }, pointer]}>
        <Icon name={hasFiles ? 'chevronRight' : error ? 'refreshCw' : 'sendHorizontal'} size={24} color="#ffffff" />
      </Pressable>
    </View>
  </View> : undefined

  const summary = shareSummary(share)
  const below = <View style={{ paddingHorizontal: 16, paddingBottom: 10, gap: 4 }}>
    {!!summary && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name={hasFiles ? (media ? 'image' : 'fileText') : 'messageCircle'} size={14} color={c.muted} /><Text numberOfLines={1} style={{ flex: 1, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{summary}</Text></View>}
    {!!(share.notice || notice) && <Text accessibilityRole="alert" style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }}>{[notice, share.notice].filter(Boolean).join(' ')}</Text>}
  </View>
  const loading = chats.loading || people.loading
  const failed = chats.error || people.error

  return <>
    <AttachPage title="Send to…" onBack={() => { if (!busy) onDiscard() }} backIcon="x" backLabel="Cancel sharing" backDisabled={busy} scroll={false}
      search={{ value: search, onChangeText: setSearch, placeholder: 'Search chats and people', label: 'Search chats and people' }} below={below} footer={footer}>
      <FlatList accessibilityLabel="Chats and people" data={rows} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}
        onEndReachedThreshold={0.5} onEndReached={() => { if (chats.cursor && !chats.loading) void chats.more(); else if (people.cursor && !people.loading) void people.more() }}
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 24 }} color={c.brand} accessibilityLabel="Loading chats" />
          : failed ? <ErrorState message={failed} onRetry={() => { void chats.refresh(); void people.refresh() }} />
            : <Text style={{ padding: 24, textAlign: 'center', color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14 }}>No chats or people match.</Text>}
        ListFooterComponent={rows.length && loading ? <ActivityIndicator style={{ marginVertical: 12 }} color={c.brand} /> : undefined}
        renderItem={({ item }) => {
          if (item.type === 'section') return <Text accessibilityRole="header" style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, color: c.muted, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{item.title}</Text>
          const on = chosen.has(item.key); const disabled = busy || !!item.reason
          return <Pressable accessibilityRole="checkbox" accessibilityLabel={item.target.title} accessibilityHint={item.reason ?? undefined} accessibilityState={{ checked: on, disabled }} aria-checked={on} disabled={disabled} onPress={() => toggle(item.target)}
            style={({ pressed }) => [{ minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: on ? c.successSoft : pressed ? c.hover : 'transparent', opacity: item.reason ? 0.5 : 1 }, pointer]}>
            <View>
              <ChatAvatar name={item.avatar.name} seed={item.avatar.seed} uri={item.avatar.uri} group={item.avatar.group} size={46} />
              {on && <View style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, borderWidth: 2, borderColor: c.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={12} color="#ffffff" /></View>}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 16, lineHeight: 22 }}>{item.target.title}</Text>
              {!!(item.reason || item.subtitle) && <Text numberOfLines={1} style={{ color: item.reason ? c.danger : c.muted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }}>{item.reason || item.subtitle}</Text>}
            </View>
          </Pressable>
        }} />
    </AttachPage>
    {stage === 'preview' && <AttachmentPreview initialFiles={share.files} source={media ? 'media' : 'document'} initialCaption={share.text} conversation="" notice={names ? `Sending to ${names}` : ''}
      onClose={() => setStage('pick')} onSend={(files, caption, clientId) => deliver(caption, files, clientId)} />}
  </>
}
