import { createContext, useContext, useState, type ReactNode } from 'react'
import { Image, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { shadow, useColors } from '../ui'
import { clockTime, dayLabel, formatBytes, sameDay } from '../modules/messenger/lib/text'
import type { Attachment, DeliveryStatus, ReactionSummary, ReplyPreview } from '../modules/messenger/api'
import { Icon } from './Icon'
import { InlineAudio } from './MediaPlayback'
import { PhoneContactCard } from './PhoneContactCard'
import { isVCard } from '../modules/messenger/lib/vcard'

import { chatImageLayout } from '../modules/messenger/lib/imageLayout'

const web = Platform.OS === 'web'
const pointerStyle = web ? ({ cursor: 'pointer' } as object) : null

/** Chat image tile content: the image, or an image icon when there is no URL or it fails to load (never a blank box). */
function TileImage({ uri, name, quiet = false }: { uri: string | null; name: string; quiet?: boolean }) {
  const c = useColors()
  const [failed, setFailed] = useState<string | null>(null)
  // `quiet`: a video poster; without one the tile stays dark under its play button.
  if ((!uri || failed === uri) && quiet) return <View style={{ flex: 1 }} />
  if (!uri || failed === uri) return <View accessible accessibilityRole="image" accessibilityLabel={`${name} (preview unavailable)`} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="image" size={28} color={c.muted} /></View>
  return <Image accessibilityLabel={name} source={{ uri }} onError={() => setFailed(uri)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
}

export type MessageDelivery = DeliveryStatus | 'sending' | 'queued' | 'failed' | null
export function MessageTicks({ status, onMedia = false }: { status: MessageDelivery; onMedia?: boolean }) {
  const c = useColors()
  if (!status) return null
  const label = status === 'sending' ? 'Sending' : status === 'queued' ? 'Waiting for the network' : status === 'failed' ? 'Not sent' : status[0].toUpperCase() + status.slice(1)
  const muted = onMedia ? '#ffffff' : c.muted
  return <View accessible accessibilityRole="image" accessibilityLabel={label}>
    {status === 'sending' || status === 'queued' || status === 'failed' ? <Icon name={status === 'failed' ? 'alert' : 'clock'} size={14} color={status === 'failed' ? (onMedia ? '#fca5a5' : c.danger) : muted} /> : <Image accessible={false} source={status === 'sent' ? require('../../assets/icons/ReceiptSent.png') : require('../../assets/icons/ReceiptDouble.png')} style={{ width: 18, height: 11, tintColor: status === 'read' ? (onMedia ? '#7dd3fc' : '#0ea5e9') : muted }} />}
  </View>
}
/** Reference bubble footer: 11px muted "edited · time · ticks", gap 4. `onMedia`: white, for the pill over a photo. */
export function MessageMeta({ createdAt, edited = false, status = null, onMedia = false }: { createdAt: string; edited?: boolean; status?: MessageDelivery; onMedia?: boolean }) {
  const c = useColors(); const color = onMedia ? '#ffffff' : c.muted
  return <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4 }}>
    {edited && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, color }}>edited</Text>}
    <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'], color }}>{clockTime(createdAt)}</Text>
    <MessageTicks status={status} onMedia={onMedia} />
  </View>
}
type Meta = { createdAt: string; edited?: boolean; status?: MessageDelivery }
/** Set by a MessageBubble drawn with `metaOverlay`: the footer to draw over the last photo/video tile. */
const OverlayMeta = createContext<Meta | null>(null)
/**
 * WhatsApp: a message that is only photos/videos (no caption, no other attachment) shows its time and ticks on a
 * dark pill over the image's lower right corner instead of a footer line under it.
 */
export function overlaysMeta(items: Attachment[]): boolean {
  return items.length > 0 && items.every(a => a.status === 'ready' && (a.kind === 'image' || a.kind === 'video'))
}
/** rgba(0,0,0,0.55) keeps the white 11px time at >= 4.5:1 even over a white photo (blended #737373). */
function MediaMetaPill({ meta }: { meta: Meta }) {
  return <View pointerEvents="none" style={{ position: 'absolute', right: 6, bottom: 6, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}><MessageMeta {...meta} onMedia /></View>
}
/** Width of the bubble's footer ("edited · 14:05 ✓✓") once measured; 0 until then. */
const MetaWidth = createContext(0)
/** First-frame guess for the footer width (11px Inter digits ~6.4px, "edited " ~36px, ticks 18px + 4px gap). */
export function estimateMetaWidth({ createdAt, edited = false, status = null }: { createdAt: string; edited?: boolean; status?: MessageDelivery }): number {
  return Math.ceil(clockTime(createdAt).length * 6.4 + (edited ? 40 : 0) + (status ? 22 : 0))
}
/**
 * Inline box at the end of the message text, exactly as wide as the footer (measured by the bubble). The footer is
 * drawn over the bubble's bottom-right corner; this box keeps the last line clear of it, so the time sits on the
 * last line when it fits and the text gets one more line when it does not (WhatsApp; the reference floats it right).
 * An inline View (not padding characters) so the room is exact on Android, iOS and web whatever the font metrics.
 */
export function MessageMetaSpacer(meta: { createdAt: string; edited?: boolean; status?: MessageDelivery }) {
  const measured = useContext(MetaWidth)
  return <View accessible={false} importantForAccessibility="no" aria-hidden pointerEvents="none" style={{ width: (measured || estimateMetaWidth(meta)) + 8, height: 2 }} />
}
/** Put before the day's first message, outside its left/right bubble alignment. */
export function MessageDay({ createdAt, previousAt }: { createdAt: string; previousAt?: string }) {
  const c = useColors()
  if (previousAt && sameDay(createdAt, previousAt)) return null
  return <View style={{ alignItems: 'center', paddingVertical: 8 }}><View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 2, backgroundColor: c.dark ? '#1e293b' : '#ffffff', boxShadow: shadow.sm }}><Text style={{ color: c.muted, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16 }}>{dayLabel(createdAt)}</Text></View></View>
}
/** Shown above the first message once the whole visible history is loaded. */
export function HistoryStart({ visibleFrom }: { visibleFrom: number }) {
  const c = useColors()
  return <View style={{ height: 32, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{visibleFrom > 1 ? 'Earlier messages are not shown' : 'Beginning of the conversation'}</Text></View>
}
export function SystemNotice({ children }: { children: ReactNode }) {
  const c = useColors()
  return <View style={{ alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4 }}><View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, textAlign: 'center' }}>{children}</Text></View></View>
}

/** Reference "Forwarded" label: 12px italic muted with the forward arrow, above the content. */
export function ForwardedLabel() {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}><Icon name="forward" size={12} color={c.muted} /><Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontStyle: 'italic', fontSize: 12, lineHeight: 16 }}>Forwarded</Text></View>
}

/** Reference Quote: 4px left bar, rounded-lg, 10/6 padding, xs text; own bubbles get a white bar on black/10. */
export function ReplyQuote({ reply, own, onJump }: { reply: ReplyPreview; own: boolean; onJump?: (seq: number) => void }) {
  const c = useColors()
  const jump = reply.seq !== null && onJump ? () => onJump(reply.seq!) : undefined
  return <Pressable accessibilityRole="button" accessibilityLabel={`Replied message from ${reply.sender_name ?? 'someone'}`} disabled={!jump} onPress={jump}
    style={[{ marginBottom: 4, borderLeftWidth: 4, borderColor: own ? 'rgba(255,255,255,0.6)' : c.brand, backgroundColor: own ? 'rgba(0,0,0,0.1)' : c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }, jump ? pointerStyle : null]}>
    <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16 }}>{reply.sender_name ?? ''}</Text>
    <Text numberOfLines={2} style={{ color: c.text, fontFamily: 'Inter_400Regular', fontStyle: reply.deleted ? 'italic' : 'normal', fontSize: 12, lineHeight: 16 }}>{reply.preview}</Text>
  </Pressable>
}

/** Reference deleted text: ban glyph + italic muted 15px. */
export function DeletedText({ own, moderator = false }: { own: boolean; moderator?: boolean }) {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Icon name="ban" size={14} color={c.muted} />
    <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontStyle: 'italic', fontSize: 15, lineHeight: 20 }}>{moderator ? 'Removed by a moderator' : own ? 'You deleted this message' : 'This message was deleted'}</Text>
  </View>
}

/** Reference FileChip: rounded-[10px] black/5 row, 36px extension tile, name + size, download mark. */
export function FileChip({ attachment: a, label, onPress }: { attachment: Attachment; label: string; onPress?: () => void }) {
  const c = useColors()
  const ext = (a.name.split('.').pop() ?? '').slice(0, 4).toUpperCase()
  const detail = a.status === 'ready' ? formatBytes(a.size) : a.status === 'rejected' ? (a.reject_reason || 'Rejected') : 'Checking file…'
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress}
    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.dark ? (pressed || hovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.1)') : (pressed || hovered ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)') }, onPress ? pointerStyle : null]}>
    <View style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.7)' }}><Text style={{ color: c.muted, fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 10, lineHeight: 14 }}>{ext}</Text></View>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{a.name}</Text>
      <Text numberOfLines={1} style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{detail}</Text>
    </View>
    {a.status === 'ready' && <Icon name="download" size={16} color={c.muted} />}
  </Pressable>
}

/** Audio / video row in the reference player's footprint: round play button, waveform bars, length. */
export function MediaChip({ attachment: a, own, label, onPress }: { attachment: Attachment; own: boolean; label: string; onPress?: () => void }) {
  const c = useColors()
  const seconds = Math.round((a.duration_ms ?? 0) / 1000)
  const bars = [6, 10, 14, 8, 16, 12, 7, 15, 10, 13, 6, 11, 16, 9, 12, 7, 14, 10, 8, 12, 6, 9]
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={!onPress} onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, width: 240, maxWidth: '100%', paddingVertical: 4 }, onPress ? pointerStyle : null]}>
    <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: own ? '#059669' : c.brand }}><View style={{ marginLeft: 2 }}><Icon name="play" size={16} color="#ffffff" /></View></View>
    {a.kind === 'audio'
      ? <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, height: 20 }}>{bars.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: c.dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)' }} />)}</View>
      : <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{a.name}</Text>}
    {a.kind === 'audio' && <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</Text>}
  </Pressable>
}

/**
 * Reference Attachments: images (one sized to its ratio, several as 136px tiles in a 280px grid), media rows, phone
 * contact cards (ready .vcf files, reference PhoneContactCard), file chips.
 * Thumbnails must be same-origin paths; `origin` is prefixed. Labels keep the existing test hooks.
 */
export function MessageAttachments({ items, own, origin, onImage, onMedia, onExport }: { items: Attachment[]; own: boolean; origin: string; onImage: (a: Attachment) => void; onMedia: (a: Attachment) => void; onExport: (a: Attachment) => void }) {
  const c = useColors()
  // Photos and videos share the tile grid (WhatsApp); a video opens the chat's media viewer through `onMedia`.
  const tiles = items.filter(a => (a.kind === 'image' || a.kind === 'video') && a.status === 'ready')
  const rest = items.filter(a => !tiles.includes(a))
  const overlay = useContext(OverlayMeta)
  const safe = (url: string | null) => url && url.startsWith('/') && !url.startsWith('//') ? `${origin}${url}` : null
  const { width } = useWindowDimensions()
  const layout = chatImageLayout(width, tiles.length)
  return <View style={{ gap: 6, marginTop: overlay ? 0 : 2, marginBottom: 0 }}>
    {tiles.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, width: layout.width, maxWidth: '100%' }}>
      {tiles.slice(0, 4).map((a, i) => { const uri = (a.mime === 'image/gif' ? safe(a.download_url) : null) || safe(a.preview_url) || safe(a.thumb_url); const video = a.kind === 'video'
        // A lone video without a poster frame is drawn 16:9 rather than as a tall empty photo box.
        const box = video && !uri && tiles.length === 1 ? { width: layout.box.width, height: Math.round(layout.box.width * 9 / 16) } : layout.box
        return <Pressable key={a.id} accessibilityRole="button" accessibilityLabel={video ? `Open media ${a.name}` : `View image ${a.name}`} onPress={() => video ? onMedia(a) : onImage(a)} style={[{ ...box, maxWidth: '100%', overflow: 'hidden', borderRadius: overlay ? 8 : 10, backgroundColor: video ? '#0f172a' : c.neutral }, pointerStyle]}>
          {video ? <><TileImage uri={uri} name={a.name} quiet />
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}><View style={{ marginLeft: 3 }}><Icon name="play" size={22} color="#ffffff" /></View></View>
            </View></> : <TileImage uri={uri} name={a.name} />}
          {i === 3 && tiles.length > 4 && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#ffffff', fontSize: 32, fontFamily: 'Inter_600SemiBold' }}>+{tiles.length - 4}</Text></View>}
          {overlay && rest.length === 0 && i === Math.min(tiles.length, 4) - 1 && <MediaMetaPill meta={overlay} />}
        </Pressable> })}
    </View>}
    {rest.map(a => a.status === 'ready' && a.kind === 'audio'
      ? <InlineAudio key={a.id} attachment={a} />
      : a.status === 'ready' && isVCard(a) ? <PhoneContactCard key={a.id} attachment={a} onExport={() => onExport(a)} />
      : <FileChip key={a.id} attachment={a} label={`Export attachment ${a.name}`} onPress={a.status === 'ready' ? () => onExport(a) : undefined} />)}
  </View>
}

/** Reference ReactionPill: on the bubble's lower edge, white pill ringed in the chat background, top 3 emoji + total. */
export function ReactionPill({ reactions, own, onPress }: { reactions: ReactionSummary[]; own: boolean; onPress?: () => void }) {
  const c = useColors()
  const total = reactions.reduce((n, r) => n + r.count, 0)
  const top = [...reactions].sort((a, b) => b.count - a.count).slice(0, 3)
  const mine = reactions.some(r => r.me)
  return <Pressable accessibilityRole="button" accessibilityLabel={`Reactions: ${reactions.map(r => `${r.emoji} ${r.count}`).join(', ')}${mine ? ', including you' : ''}`} disabled={!onPress} onPress={onPress}
    style={[{ position: 'absolute', top: '100%', marginTop: -6, ...(own ? { right: 8 } : { left: 8 }), height: 26, flexDirection: 'row', alignItems: 'center', gap: 1, borderRadius: 999, paddingHorizontal: 5, borderWidth: 2, borderColor: c.dark ? '#020617' : '#efeae2', backgroundColor: mine ? (c.dark ? '#1d3b2e' : c.successSoft) : (c.dark ? '#1e293b' : '#ffffff'), boxShadow: shadow.sm }, pointerStyle]}>
    {top.map(r => <Text key={r.emoji} style={{ fontSize: 14, lineHeight: 16 }}>{r.emoji}</Text>)}
    {total > 1 && <Text style={{ marginLeft: 2, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{total}</Text>}
  </Pressable>
}

/**
 * WhatsApp-style bubble in JM's colours: 10px corners, and the first bubble of a run gets a tail at its top outer
 * corner (that corner square). Runs sit 2px apart, 8px between runs. At most 80% / 544px wide. The footer
 * (edited, time, ticks) sits inside the bottom-right corner; text bubbles keep it on the last line via
 * MessageMetaSpacer. The options chevron appears on hover or keyboard focus (web pointer); phones hold the message.
 * Optional forwarded / reply / reactions props draw the reference's label, quote and reaction pill.
 */
export function MessageBubble({ own, tail = true, sender, label, meta, inlineMeta, metaOverlay = false, selected = false, onActions, actionsDisabled = false, chevron = true, forwarded = false, reply = null, onJump, reactions, onReactions, onSender, children }: {
  own: boolean
  /** First message of a run (same sender, same day): draw the tail and the gap above. */
  tail?: boolean
  /** Group chats only, on the first message of a run. */
  sender?: string | null
  label: string
  meta: { createdAt: string; edited?: boolean; status?: MessageDelivery }
  /** True when the content ends with MessageMetaSpacer, so the footer overlays its last line. */
  inlineMeta: boolean
  /** Only photos/videos, no caption (`overlaysMeta`): a 3px frame and the footer as a pill over the last tile. */
  metaOverlay?: boolean
  selected?: boolean
  onActions?: () => void
  actionsDisabled?: boolean
  /** The hover options arrow; off for deleted messages, which still open actions on hold. */
  chevron?: boolean
  /** Live messages only: the "Forwarded" label above the content. */
  forwarded?: boolean
  /** Live messages only: the quoted message. */
  reply?: ReplyPreview | null
  onJump?: (seq: number) => void
  /** Live messages only: drawn as the reference pill on the bubble's lower edge. */
  reactions?: ReactionSummary[]
  onReactions?: () => void
  onSender?: () => void
  children: ReactNode
}) {
  const c = useColors(); const [hover, setHover] = useState(false); const [focus, setFocus] = useState(false); const [metaWidth, setMetaWidth] = useState(0)
  const background = own ? c.outgoing : c.incoming
  const pill = !!reactions?.length
  const footer = <MessageMeta {...meta} />
  return <Pressable accessibilityLabel={label} onLongPress={onActions} delayLongPress={400} onHoverIn={() => setHover(true)} onHoverOut={() => setHover(false)}
    accessibilityActions={onActions ? [{ name: 'longpress', label: 'Message actions' }] : undefined} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') onActions?.() }}
    style={[{ flexDirection: 'row', justifyContent: own ? 'flex-end' : 'flex-start', paddingHorizontal: 14, paddingTop: tail ? 10 : 3, paddingBottom: pill ? 22 : 3, backgroundColor: selected ? c.successSoft : 'transparent' }, web ? ({ cursor: 'auto' } as object) : null]}>
    <View style={{ maxWidth: '80%' }}>
      <View style={{ maxWidth: 544, minWidth: inlineMeta || metaOverlay ? undefined : metaWidth + 18, borderRadius: 10, ...(tail ? own ? { borderTopRightRadius: 0 } : { borderTopLeftRadius: 0 } : {}), ...(metaOverlay ? { padding: 3 } : { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }), backgroundColor: background, boxShadow: shadow.sm }}>
        {tail && <View accessible={false} pointerEvents="none" style={{ position: 'absolute', top: 0, width: 0, height: 0, borderTopWidth: 11, borderTopColor: background, ...(own ? { right: -8, borderRightWidth: 8, borderRightColor: 'transparent' } : { left: -8, borderLeftWidth: 8, borderLeftColor: 'transparent' }) }} />}
        {(!!sender || forwarded || !!reply) && <View style={metaOverlay ? { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 3 } : undefined}>
          {!!sender && <Text numberOfLines={1} accessibilityRole={onSender ? 'button' : undefined} onPress={onSender} style={[{ color: c.brand, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, marginBottom: 1 }, onSender ? pointerStyle : null]}>{sender}</Text>}
          {forwarded && <ForwardedLabel />}
          {reply && <ReplyQuote reply={reply} own={own} onJump={onJump} />}
        </View>}
        <MetaWidth.Provider value={metaWidth}><OverlayMeta.Provider value={metaOverlay ? meta : null}>{children}</OverlayMeta.Provider></MetaWidth.Provider>
        {metaOverlay ? null : inlineMeta
          ? <View onLayout={e => { const w = Math.ceil(e.nativeEvent.layout.width); if (w !== metaWidth) setMetaWidth(w) }} style={{ position: 'absolute', right: 9, bottom: 4 }}>{footer}</View>
          : <View onLayout={e => { const w = Math.ceil(e.nativeEvent.layout.width); if (w !== metaWidth) setMetaWidth(w) }} style={{ alignSelf: 'flex-end', marginTop: 2, marginBottom: -2 }}>{footer}</View>}
        {web && chevron && onActions && <Pressable accessibilityRole="button" accessibilityLabel="Message actions" disabled={actionsDisabled} onPress={onActions} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={[{ position: 'absolute', right: 4, top: 4, zIndex: 10, padding: 2, borderRadius: 999, backgroundColor: background, opacity: hover || focus ? 1 : 0 }, pointerStyle]}>
          <Icon name="down" size={16} color={c.muted} />
        </Pressable>}
        {pill && <ReactionPill reactions={reactions!} own={own} onPress={onReactions} />}
      </View>
    </View>
  </Pressable>
}
