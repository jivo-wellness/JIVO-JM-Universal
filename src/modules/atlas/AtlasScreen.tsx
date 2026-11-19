import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View, type ViewStyle } from 'react-native'
import { router } from 'expo-router'
import { useSession } from '../../core/auth/Session'
import { ChatComposer } from '../../components/ChatComposer'
import { atlasTextOnlyActions, ATLAS_TEXT_ONLY_REASON } from './composer'
import { AtlasIcon } from '../../components/AtlasIcon'
import { Icon } from '../../components/Icon'

import { Button, EmptyState, Spinner, useColors, type Colors } from '../../ui'
import { AtlasMessageOptions, type Selection } from './AtlasMessageOptions'
import { AtlasAnswer } from './AtlasAnswer'
import { formatDateTime } from '../../shared/utils/format'
import { ATLAS_MAX_CHARS, answerView, canSend, counter, quote, type Ask } from './model'
import { useAtlasStatusEntry, useAtlasThread, useOffline } from './useAtlas'

const web = Platform.OS === 'web'
const pointer = (web ? { cursor: 'pointer' } : {}) as ViewStyle
const chatTint = (c: Colors) => web ? (c.dark ? 'rgba(2,6,23,0.4)' : 'rgba(239,234,226,0.6)') : c.chat
const time = (value: string | null) => { if (!value) return ''; const d = new Date(value); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/**
 * Ask Atlas: a private one-to-one thread with JIVO's business AI, laid out like a chat. Questions are on the
 * right, Atlas answers on the left. Text only (no attachments). Answers are shown only to the person who asked.
 */
export function AtlasScreen({ onBack }: { onBack?: () => void } = {}) {
  const { me } = useSession()
  if (!me) return <Spinner label="Loading Atlas" />
  return <AtlasThreadView key={me.id} user={me.id} onBack={onBack} />
}

function AtlasThreadView({ user, onBack }: { user: string; onBack?: () => void }) {
  const c = useColors()

  const status = useAtlasStatusEntry()
  const offline = useOffline()
  const allowed = !!status.value?.enabled && !!status.value.allowed
  const thread = useAtlasThread(user, allowed)
  const list = useRef<FlatList<Ask>>(null)
  const sending = useRef(false)
  const [pending, setPending] = useState<Ask | null>(null)
  const [failed, setFailed] = useState<{ text: string; parent: Ask | null } | null>(null)
  const [selected, setSelected] = useState<Selection | null>(null)
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<Ask | null>(null)
  const byId = useMemo(() => new Map(thread.asks.map(ask => [ask.id, ask])), [thread.asks])
  const count = counter(draft)
  // 429 retry_after: count down on the Retry button until the server accepts asks again.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (!thread.retryAt) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [thread.retryAt])
  const wait = thread.retryAt ? Math.max(0, Math.ceil((thread.retryAt - now) / 1000)) : 0
  const blockedLine = offline ? 'No internet' : null
  const sendDisabled = !allowed || offline || thread.sending || wait > 0 || !canSend(draft)

  const submit = async (text: string, parent: Ask | null) => {
    if (sending.current || !allowed || offline || thread.sending || wait > 0 || !canSend(text)) return
    sending.current = true
    setFailed(null); setDraft(''); setReplyTo(null)
    setPending({ id: -1, text, reply_to: parent?.id ?? null, state: 'sending', answer: null, with: null, error_message: null, created_at: new Date().toISOString(), answered_at: null, open: true })
    list.current?.scrollToOffset({ offset: 0, animated: false })
    const accepted = await thread.thread.send(text, parent?.id ?? null)
    setPending(null)
    sending.current = false
    if (!accepted) { setFailed({ text, parent }); setDraft(current => current || text) }
  }
  const send = () => submit(draft, replyTo)
  const items = pending && thread.sending ? [pending, ...thread.asks] : thread.asks
  const active = thread.asks.find(ask => ask.open)
  const activity = offline ? 'No internet' : active?.state === 'working' ? `${active.with || 'Atlas'} is working...` : active?.state === 'with_person' ? `With ${active.with || 'an Atlas agent'}` : active ? 'Waiting for Atlas...' : 'Ready to chat'


  const header = <View style={{ minHeight: 60, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.shell }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" onPress={() => onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/messenger')} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, ...pointer }}><Icon name="back" size={22} color={c.text} /></Pressable>
    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dark ? '#18232e' : '#ffffff' }}><AtlasIcon size={36} /></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 22, color: c.text }}>Atlas</Text>
      <Text numberOfLines={1} style={{ fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: c.muted }}>{activity}</Text>
    </View>
  </View>

  // Status gates: unknown (first load), disabled, not allowed. Cached asks still show while the status is unknown offline.
  if (!status.value && !(status.failed || offline) ) return <View style={{ flex: 1 }}>{header}<View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Checking Atlas" /></View></View>
  if (!status.value && thread.asks.length === 0) return <View style={{ flex: 1 }}>{header}<EmptyState title={offline ? 'You are offline' : 'Atlas is not reachable'} description={offline ? 'Connect to the internet to ask Atlas.' : 'JM could not check Atlas right now.'} action={offline ? undefined : <Button variant="secondary" size="sm" title="Try again" onPress={status.retry} />} /></View>
  if (status.value && !status.value.enabled) return <View style={{ flex: 1 }}>{header}<EmptyState title="Atlas is not available" description="Atlas has not been switched on for JM yet." /></View>
  if (status.value && !status.value.allowed) return <View style={{ flex: 1 }}>{header}<EmptyState title="You cannot ask Atlas" description={status.value.message ?? 'Your account is not set up for Atlas. Ask an administrator for access.'} /></View>

  const older = thread.hasMore ? <View style={{ alignItems: 'center', paddingVertical: 12 }}><Button variant="secondary" size="sm" title="Load older" loading={thread.loadingOlder} disabled={offline} onPress={() => void thread.thread.loadOlder()} /></View> : <View style={{ height: 12 }} />

  return <View style={{ flex: 1 }}>
    {header}
    <View style={{ flex: 1, backgroundColor: chatTint(c) }}>
      {!!thread.error && <Text accessibilityLiveRegion="polite" style={{ paddingHorizontal: 16, paddingVertical: 8, color: c.muted, fontSize: 12, lineHeight: 17, backgroundColor: c.panel, borderBottomWidth: 1, borderBottomColor: c.border }}>{thread.error}</Text>}
      {items.length === 0
        ? (thread.loading && !thread.loaded ? <View style={{ flex: 1, justifyContent: 'center' }}><Spinner label="Loading your questions" /></View>
          : <View style={{ paddingHorizontal: 28, paddingVertical: 48, gap: 8 }}><Text style={{ color: c.text, fontSize: 15, fontWeight: '600', textAlign: 'center' }}>Ask Atlas anything about JIVO&apos;s business</Text><Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>Sales, stock, orders, people... Atlas answers here, and only you can see the answers.</Text></View>)
        : <FlatList ref={list} inverted data={items} keyExtractor={ask => String(ask.id)} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
          ListFooterComponent={older}
          onEndReachedThreshold={0.2} onEndReached={() => { if (thread.hasMore && !thread.loadingOlder && !offline) void thread.thread.loadOlder() }}
          renderItem={({ item }) => <AskRow ask={item} parent={item.reply_to ? byId.get(item.reply_to) ?? null : null} c={c} canAct={allowed && !offline && !thread.sending}
            onReply={() => setReplyTo(item)} onOptions={(text, own) => setSelected({ ask: item, text, own })} onRetry={() => void submit(item.text, item.reply_to ? byId.get(item.reply_to) ?? null : null)} />} />}
    </View>
    <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 6, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.shell }}>
      {!!blockedLine && <Line icon="wifiOff" text={blockedLine} c={c} />}
      {!!thread.sendError && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1 }}><Line icon="alert" text={thread.sendError.message} c={c} danger /></View>
        {thread.sendError.retryable && <Button size="sm" variant="secondary" title={wait > 0 ? `Retry in ${wait} s` : 'Retry'} disabled={!failed || offline || thread.sending || wait > 0} onPress={() => { if (failed) void submit(failed.text, failed.parent) }} />}
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error" onPress={() => thread.thread.clearSendError()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="x" size={16} color={c.muted} /></Pressable>
      </View>}
      {replyTo && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: c.brand, borderRadius: 6, backgroundColor: c.panel }}>
        <View style={{ flex: 1, paddingVertical: 6 }}>
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, color: c.brand }}>Replying to Atlas</Text>
          <Text numberOfLines={1} style={{ fontSize: 13, color: c.muted }}>{quote(replyTo.answer || replyTo.text)}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel follow-up" onPress={() => setReplyTo(null)} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', ...pointer }}><Icon name="x" size={16} color={c.muted} /></Pressable>
      </View>}

    </View>
    <AtlasMessageOptions selected={selected} onClose={() => setSelected(null)} onReply={setReplyTo} onDeleted={id => thread.thread.remove(id)} />
    <ChatComposer
      attach={atlasTextOnlyActions}
      voiceUnavailableReason={ATLAS_TEXT_ONLY_REASON}
      footer={<View style={{ paddingHorizontal: 12, paddingBottom: 4, backgroundColor: c.shell }}><Text accessibilityLiveRegion="polite" accessibilityLabel={`${count.count} of ${ATLAS_MAX_CHARS} characters`} style={{ alignSelf: 'flex-end', fontSize: 11, color: count.over ? c.danger : c.muted }}>{count.over ? `Shorten your message to ${ATLAS_MAX_CHARS} characters. ` : ''}{count.label}</Text></View>}
      inputProps={{ value: draft, onChangeText: value => { setDraft(value); if (thread.sendError && !thread.sendError.retryable) thread.thread.clearSendError() }, placeholder: 'Ask Atlas', accessibilityLabel: 'Question for Atlas' }}
      disabled={!allowed} sendDisabled={sendDisabled} sendLabel="Send to Atlas" onSend={() => void send()}
    />
  </View>
}

function Line({ icon, text, c, danger = false }: { icon: 'wifiOff' | 'alert'; text: string; c: Colors; danger?: boolean }) {
  return <View accessibilityRole={web ? 'alert' : undefined} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Icon name={icon} size={14} color={danger ? c.danger : c.muted} />
    <Text accessibilityLiveRegion="polite" style={{ flex: 1, fontSize: 12, lineHeight: 17, color: danger ? c.danger : c.muted }}>{text}</Text>
  </View>
}

/** One ask (right) and Atlas's reply or progress line (left). Rendered inside an inverted list, newest at the bottom. */
export function AskRow({ ask, parent, c, canAct, onRetry, onOptions }: { ask: Ask; parent: Ask | null; c: Colors; canAct: boolean; onReply: () => void; onRetry: () => void; onOptions?: (text: string, own: boolean) => void }) {
  const view = answerView(ask)
  const [lines, setLines] = useState(10)
  const [long, setLong] = useState(false)
  const answered = ask.state === 'done' && !!ask.answer?.trim()
  const answer = ask.answer?.trim() || (view.tone !== 'pending' ? view.text : '')
  return <View style={{ gap: 10, paddingVertical: 8 }}>
    <Pressable onLongPress={() => ask.id > 0 && onOptions?.(ask.text, true)} delayLongPress={500} style={{ maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderTopRightRadius: 4, alignSelf: 'flex-end', backgroundColor: c.outgoing }}>
      {parent && <View style={{ marginBottom: 6, padding: 8, borderLeftWidth: 3, borderLeftColor: c.brand, backgroundColor: c.hover }}><Text numberOfLines={2} style={{ color: c.muted, fontSize: 12 }}>{quote(parent.answer || parent.text)}</Text></View>}
      <Text numberOfLines={lines} onTextLayout={e => { if (e.nativeEvent.lines.length >= lines) setLong(true) }} style={{ fontSize: 15, lineHeight: 22, color: c.text }}>{ask.text}</Text>
      {long && <Pressable onPress={() => { setLines(n => n + 10); setLong(false) }}><Text style={{ color: c.brand, paddingVertical: 4 }}>Read more</Text></Pressable>}
      <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}><Text accessibilityLabel={`Asked ${formatDateTime(ask.created_at)}`} style={{ fontSize: 11, color: c.muted }}>{time(ask.created_at)}</Text><View accessibilityLabel={answered ? 'Answered by Atlas' : ask.state === 'sending' ? 'Sending' : 'Delivered to Atlas; read receipt unavailable'}><Icon name={(ask.delivered ?? ask.state !== 'sending') ? 'checks' : 'clock'} size={15} color={answered ? '#38bdf8' : c.muted} /></View></View>
    </Pressable>
    {ask.open && <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 }}><ActivityIndicator size="small" color={c.brand} /><Text style={{ color: c.muted, fontSize: 13 }}>{ask.state === 'sending' ? 'Sending...' : ask.state === 'queued' ? 'Received' : ask.state === 'with_person' ? `With ${ask.with || 'an Atlas agent'}` : 'Processing...'}</Text></View>}
    {!!answer && <Pressable onLongPress={() => onOptions?.(answer, false)} delayLongPress={500} accessibilityHint="Long press for message options" style={{ alignSelf: 'stretch', padding: 14, borderRadius: 16, borderTopLeftRadius: 4, backgroundColor: c.incoming }}>
      <Text style={{ color: c.brand, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{ask.with || 'Atlas'}{view.note ? ` - ${view.note}` : ''}</Text>
      <AtlasAnswer text={answer} />
      <Text style={{ alignSelf: 'flex-end', fontSize: 11, color: c.muted, marginTop: 6 }}>{time(ask.answered_at)}</Text>
    </Pressable>}
    {view.retry && <Button variant="secondary" size="sm" title="Retry" disabled={!canAct} onPress={onRetry} />}
  </View>
}
