import { OversightHeading, OversightHint } from './OversightUi'
import { MessageBubble } from '../../../components/MessagePresentation'
import { IconButton } from '../../../components/Icon'
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '../../../core/auth/Session'
import { api as client, errorMessage, origin } from '../../../core/api/client'
import { SensitiveRequestGuard } from '../../../shared/sensitive'
import { saveAttachment, validateAttachmentExportSize } from '../../messenger/media/export'
import { subscribeSensitiveView } from '../../../shared/sensitiveLifecycle'
import { useResource } from '../../../shared/useResource'
import { useCursor } from '../../../shared/useCursor'
import { Badge, PillTabs, SearchInput } from '../../../components/AdminUi'
import { ImageViewer } from '../../../components/ImageViewer'
import { Sheet } from '../../../components/Sheet'
import { Button, ListSection as Card, ErrorState, Field, Label, Spinner, useColors } from '../../../ui'
import { mediaUrl } from '../../messenger/media/url'
import { dayLabel } from '../../messenger/lib/text'
import type { Attachment, Message } from '../../messenger/api'
import * as api from './api'
import { useOversightRequest } from './OversightGate'

function Reason({ title, body, required = true, onClose, onConfirm }: { title: string; body: string; required?: boolean; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  return <Sheet visible title={title} description={body} onClose={() => { if (!busy) onClose() }} footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button title="Cancel" variant="secondary" disabled={busy} onPress={onClose} /><Button title="Confirm" variant="danger" disabled={busy || required && !reason.trim()} onPress={() => { setBusy(true); void onConfirm(reason.trim()).then(onClose).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} /></View>}><Field label={required ? 'Reason' : 'Reason (optional)'} value={reason} onChangeText={setReason} multiline maxLength={300} /><Label>Recorded in the oversight audit log.</Label>{!!error && <Label>{error}</Label>}</Sheet>
}
/** No ordinary chat hooks: opening this screen never sends read receipts, typing or reactions. */
export function OversightChat({ id, asPerson, focus, onBack }: { id: string; asPerson?: string; focus?: string; onBack: () => void }) {
  const request = useOversightRequest(); const { me } = useSession(); const c = useColors()
  const load = useCallback(() => request(() => asPerson ? api.getAsConversation(asPerson, id) : api.getConversation(id)), [request, asPerson, id]); const info = useResource(load)
  const historyLoad = useCallback(() => request(() => asPerson ? api.listAsMessages(asPerson, id, focus ? { around: focus } : {}) : api.listMessages(id, focus ? { around: focus } : {})), [request, asPerson, id, focus]); const history = useResource(historyLoad)
  const [extra, setExtra] = useState<Message[]>([]); const [older, setOlder] = useState<boolean | null>(null); const [newer, setNewer] = useState<boolean | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [action, setAction] = useState<{ title: string; body: string; run: (reason: string) => Promise<unknown> } | null>(null)
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null); const placed = useRef(false); const viewport = useWindowDimensions()
  const [tab, setTab] = useState('messages')
  const [image, setImage] = useState<{ uri: string; name: string } | null>(null)
  const mediaGuard = useRef(new SensitiveRequestGuard())
  useEffect(() => { const guard = mediaGuard.current; const off = subscribeSensitiveView(active => { guard.setActive(active); if (!active) setImage(null) }); return () => { guard.setActive(false); off() } }, [])
  const messages = [...new Map([...(history.value?.results ?? []), ...extra].map(m => [m.id, m])).values()].sort((a,b) => a.seq - b.seq)
  const moderate = !asPerson && !!me?.capabilities.includes('JM_OVERSIGHT_MODERATE')
  async function more(direction: 'older' | 'newer') {
    if (busy || !messages.length) return
    setBusy(true); setError('')
    const q = direction === 'older' ? { before_seq: messages[0].seq } : { after_seq: messages[messages.length - 1].seq }
    try { const page = await request(() => asPerson ? api.listAsMessages(asPerson, id, q) : api.listMessages(id, q)); setExtra(rows => [...rows, ...page.results]); if (direction === 'older') setOlder(page.has_more); else setNewer(page.has_more) } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  async function open(a: Attachment) {
    // Use the authenticated transport; external browsers do not share the native session.
    const path = a.kind === 'image' ? a.preview_url || a.download_url : a.download_url
    if (!path || !/^\/api\/jm\/oversight\/files\/[A-Za-z0-9_-]+\/(?:\?(?:v=(?:original|small|large)|download=1)(?:&(?:v=(?:original|small|large)|download=1))*)?$/.test(path)) { setError('This attachment has no audited preview link.'); return }
    const generation = mediaGuard.current.begin()
    try {
      const blob = await request(async () => (await client.get<Blob>(path.slice('/api/jm'.length), { responseType: 'blob', timeout: 120000 })).data)
      if (!mediaGuard.current.accepts(generation)) return
      validateAttachmentExportSize(blob.size)
      if (a.kind === 'image') {
        const uri = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error('This image could not be opened.')); reader.readAsDataURL(blob) })
        if (mediaGuard.current.accepts(generation)) setImage({ uri, name: a.name })
      } else await saveAttachment(blob, a.name, () => mediaGuard.current.accepts(generation))
    } catch (e) { if (mediaGuard.current.accepts(generation)) setError(errorMessage(e)) }

  }
  return <View style={{ gap: 18 }}><OversightHeading title={info.value?.title ?? 'Conversation'} detail={asPerson ? 'Viewing as this person - Read-only' : 'Conversation review - Every view is recorded'} onBack={onBack} /><PillTabs horizontal label="Conversation review" value={tab} onChange={setTab} options={[["messages", "Messages"], ["members", `Members${info.value?.members ? ` (${info.value.members.length})` : ''}`]]} />
    {!!(info.error || history.error || error) && <ErrorState message={error || errorMessage(info.error || history.error)} onRetry={() => { setError(''); info.refresh(); history.refresh() }} />}
    {tab === 'messages' && <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
    <ScrollView ref={scroller} nestedScrollEnabled style={{ height: viewport.height * 0.6, backgroundColor: c.dark ? '#0b141a' : '#efeae2' }} contentContainerStyle={{ paddingVertical: 10 }} onContentSizeChange={() => { if (!placed.current && messages.length && !focus) { scroller.current?.scrollToEnd({ animated: false }); placed.current = true } }}>
    {history.loading && <Spinner label="Loading messages" />}
    {(older ?? history.value?.has_more) && <View style={{ alignItems: 'center' }}><Button title="Show earlier messages" size="sm" variant="secondary" disabled={busy} onPress={() => void more('older')} /></View>}
    {messages.map((m, i) => {
      const own = !!asPerson && m.sender?.id === asPerson
      const tail = !i || messages[i - 1].sender?.id !== m.sender?.id || dayLabel(messages[i - 1].created_at) !== dayLabel(m.created_at)
      return <View key={m.id} onLayout={event => { if (focus === m.id && !placed.current) { const y = event.nativeEvent.layout.y; requestAnimationFrame(() => scroller.current?.scrollTo({ y: Math.max(0, y - 80), animated: false })); placed.current = true } }}>
      {(!i || dayLabel(messages[i-1].created_at) !== dayLabel(m.created_at)) && <View style={{ alignItems: 'center', paddingVertical: 8 }}><Text style={{ color: c.muted, backgroundColor: c.panel, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, fontSize: 12 }}>{dayLabel(m.created_at)}</Text></View>}
      {m.kind === 'system' ? <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 5 }}><Text style={{ color: c.muted, backgroundColor: c.panel, textAlign: 'center', fontSize: 12, lineHeight: 18, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }}>{m.system?.text || m.body}</Text></View> : <MessageBubble own={own} tail={tail} sender={!own && (info.value?.kind === 'group' || !asPerson) ? m.sender?.name : null} label={m.body || 'Message'} meta={{ createdAt: m.created_at, edited: !!m.edited_at, status: own ? m.status : undefined }} inlineMeta={false} selected={focus === m.id} forwarded={m.forwarded} reply={m.deleted ? null : m.reply_to} onJump={() => {}} chevron={moderate && !m.deleted} onActions={moderate && !m.deleted ? () => setAction({ title: 'Remove this message?', body: 'It is removed for everyone. The reason is recorded.', run: reason => api.moderateDelete(m.id, reason) }) : undefined}>
      {!!(m.deleted || m.body || m.poll || m.event || m.contact) && <Text style={{ color: c.text, fontSize: 15, lineHeight: 21, fontStyle: m.deleted ? 'italic' : 'normal' }}>{m.deleted ? 'This message was deleted' : m.body || m.poll?.question || m.event?.title || m.contact?.name}</Text>}
      {!m.deleted && m.attachments.map(a => <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={`Open ${a.name}`} disabled={a.status !== 'ready'} onPress={() => void open(a)}>{a.kind === 'image' && a.thumb_url?.startsWith('/api/jm/oversight/') ? <Image source={{ uri: mediaUrl(a.thumb_url, origin) ?? '', cache: 'reload' }} style={{ width: 220, maxWidth: '100%', height: 180, borderRadius: 8 }} resizeMode="cover" /> : <Label>{a.name} - {a.status}</Label>}</Pressable>)}
      {!m.deleted && m.poll?.options.map(o => <Label key={o.id}>{o.text}</Label>)}
      {!m.deleted && m.location && <Label>{m.location.name || m.location.address}</Label>}
      </MessageBubble>}</View>
    })}
    {(newer ?? history.value?.has_more_after) && <Button title="Show newer messages" size="sm" variant="secondary" disabled={busy} onPress={() => void more('newer')} />}
    </ScrollView><Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, padding: 12, textAlign: 'center', borderTopWidth: 1, borderColor: c.border }}>Read-only. Nothing is sent, marked as read or shown as typing.{moderate ? ' Hold a message to remove it.' : ''}</Text></View>}
    {tab === 'members' && info.value?.members && <Card>{info.value.members.map(member => <View key={member.user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: c.border }}><View style={{ flex: 1, minWidth: 0 }}><Label>{member.user.name}</Label><Text style={{ color: c.muted }}>{member.role}{member.left_at ? ` - Left ${new Date(member.left_at).toLocaleDateString()}` : ''}</Text></View>{moderate && info.value?.kind === 'group' && !member.left_at && <IconButton name="userMinus" label={`Remove ${member.user.name}`} onPress={() => setAction({ title: `Remove ${member.user.name}?`, body: 'They leave the group at once. The group sees that a moderator removed them.', run: reason => api.moderateRemoveMember(id, member.user.id, reason) })} />}</View>)}</Card>}
    {action && <Reason title={action.title} body={action.body} onClose={() => setAction(null)} onConfirm={async reason => { await request(() => action.run(reason)); setExtra([]); setOlder(null); setNewer(null); info.refresh(); history.refresh() }} />}
    {image && <Modal visible onRequestClose={() => setImage(null)} presentationStyle="fullScreen"><SafeAreaView style={{ flex: 1, backgroundColor: '#080d10' }}><Button title="Close image" variant="ghost" onPress={() => setImage(null)} /><ImageViewer uri={image.uri} name={image.name} /></SafeAreaView></Modal>}
  </View>
}
export function OversightVault({ id, onBack }: { id: string; onBack: () => void }) {
  const request = useOversightRequest(); const [q, setQ] = useState(''); const [vault, setVault] = useState<api.OversightVaultRow | null>(null)
  const load = useCallback(async (cursor?: string | null) => { const page = await request(() => api.listVaultEntries(id, q, cursor)); setVault(page.vault); return { results: page.results, next_cursor: page.cursor } }, [request,id,q]); const page = useCursor(load)
  return <View style={{ gap: 18 }}><OversightHeading title={vault?.name ?? 'Vault'} detail={vault ? `${vault.kind}${vault.owner ? ` - Owner: ${vault.owner.name}` : ''}` : 'Vault review'} onBack={onBack} />{vault?.frozen && <Badge tone="info">Frozen</Badge>}{vault?.archived && <Badge>Archived</Badge>}<SearchInput placeholder="Search entries" value={q} onChange={setQ} />
    {page.loading && <Spinner label="Loading entries" />}{!!page.error && <ErrorState message={page.error} onRetry={() => void page.refresh()} />}
    {!page.loading && !page.error && !page.items.length && <OversightHint>No entries found.</OversightHint>}
    {page.items.map(e => <Card key={e.id}><Label>{e.title}</Label><OversightHint>{[e.username,e.url,e.folder?.name].filter(Boolean).join(' - ')}</OversightHint><Secret entry={e} /></Card>)}
    {page.cursor && <Button title="Show more" variant="secondary" disabled={page.loading} onPress={() => void page.more()} />}
  </View>
}
function Secret({ entry }: { entry: api.OversightEntryRow }) {
  const request = useOversightRequest(); const [value, setValue] = useState<string | null>(null); const [asking, setAsking] = useState(false); const [notice, setNotice] = useState(''); const generation = useRef(0); const [expiresAt, setExpiresAt] = useState(0)
  useEffect(() => { const counter = generation; const off = subscribeSensitiveView(active => { if (!active) { counter.current++; setValue(null) } }); return () => { counter.current++; off() } }, [])
  useEffect(() => { if (value === null) return; const timer = setTimeout(() => setValue(null), Math.max(0, expiresAt - Date.now())); return () => clearTimeout(timer) }, [value, expiresAt])
  return <View style={{ gap: 8 }}><Label>{value ?? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}</Label>{value !== null && <Label>Hidden automatically after 30 seconds.</Label>}<View style={{ alignSelf: 'flex-start' }}><Button title={value !== null ? 'Hide' : 'Reveal'} variant="secondary" size="sm" onPress={() => value !== null ? setValue(null) : setAsking(true)} /></View>{!!notice && <Label>{notice}</Label>}
    {asking && <Reason title={`Reveal the password of ${entry.title}?`} body="The vault owner is told afterwards, and the other Super Administrators at once. Leave the reason empty to use your session's reason." required={false} onClose={() => setAsking(false)} onConfirm={async reason => { const token = ++generation.current; const r = await request(() => api.revealEntry(entry.id, reason)); if (token !== generation.current) return; if (r.status === 'pending') setNotice('Sent for approval. Another Super Administrator must approve it in Approvals.'); else { if (!Number.isFinite(r.expires_in) || r.expires_in <= 0) throw Error('This reveal has expired.'); setNotice(''); setExpiresAt(Date.now() + Math.min(30, r.expires_in) * 1000); setValue(r.value) } }} />}
  </View>
}
