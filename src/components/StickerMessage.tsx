import { useState } from 'react'
import { Image, Platform, Pressable, Text, View } from 'react-native'
import type { Attachment, ReactionSummary, ReplyPreview } from '../modules/messenger/api'
import { useColors } from '../ui'
import { Icon } from './Icon'
import { ForwardedLabel, MessageMeta, ReactionPill, ReplyQuote, type MessageDelivery } from './MessagePresentation'

const web = Platform.OS === 'web'
const SIZE = 160

/**
 * A sticker message (U-028), WhatsApp style: the transparent image alone, no bubble or tail; the time and ticks sit on
 * a small pill at its lower corner, and a forwarded label or quoted reply sits in a compact card above it.
 */
export function StickerBubble({ own, tail, sender = null, attachment, origin, label, meta, selected = false, onActions, forwarded = false, reply = null, onJump, reactions, onReactions, onOpen }: {
  own: boolean
  tail: boolean
  /** Group chats only, on the first message of a run. */
  sender?: string | null
  attachment: Attachment
  origin: string
  label: string
  meta: { createdAt: string; edited?: boolean; status?: MessageDelivery }
  selected?: boolean
  onActions?: () => void
  forwarded?: boolean
  reply?: ReplyPreview | null
  onJump?: (seq: number) => void
  reactions?: ReactionSummary[]
  onReactions?: () => void
  onOpen: () => void
}) {
  const c = useColors()
  const [failed, setFailed] = useState(false)
  const safe = (url: string | null) => url && url.startsWith('/') && !url.startsWith('//') ? `${origin}${url}` : null
  const uri = safe(attachment.preview_url) || safe(attachment.thumb_url)
  const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : 1
  const box = ratio >= 1 ? { width: SIZE, height: Math.round(SIZE / ratio) } : { width: Math.round(SIZE * ratio), height: SIZE }
  const pill = !!reactions?.length
  return <Pressable accessibilityLabel={label} onLongPress={onActions} delayLongPress={400}
    accessibilityActions={onActions ? [{ name: 'longpress', label: 'Message actions' }] : undefined} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'longpress') onActions?.() }}
    style={[{ flexDirection: 'row', justifyContent: own ? 'flex-end' : 'flex-start', paddingHorizontal: 14, paddingTop: tail ? 6 : 2, paddingBottom: pill ? 20 : 2, backgroundColor: selected ? c.successSoft : 'transparent' }, web ? ({ cursor: 'auto' } as object) : null]}>
    <View style={{ alignItems: own ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      {!!sender && <Text numberOfLines={1} style={{ marginBottom: 2, borderRadius: 8, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 1, color: c.brand, backgroundColor: c.incoming, fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18 }}>{sender}</Text>}
      {(forwarded || reply) && <View style={{ marginBottom: 4, maxWidth: 260, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: own ? c.outgoing : c.incoming }}>
        {forwarded && <ForwardedLabel />}
        {reply && <ReplyQuote reply={reply} own={own} onJump={onJump} />}
      </View>}
      <View>
        <Pressable accessibilityRole="button" accessibilityLabel="Sticker" onPress={onOpen} onLongPress={onActions} delayLongPress={400} style={web ? ({ cursor: 'pointer' } as object) : null}>
          {uri && !failed
            ? <Image accessible={false} source={{ uri }} onError={() => setFailed(true)} resizeMode="contain" style={box} />
            : <View style={{ ...box, alignItems: 'center', justifyContent: 'center' }}><Icon name="sticker" size={40} color={c.muted} /></View>}
        </Pressable>
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 2, ...(own ? { right: 0 } : { left: 0 }), borderRadius: 999, paddingHorizontal: 6, backgroundColor: c.dark ? 'rgba(15,23,42,0.75)' : 'rgba(255,255,255,0.9)' }}><MessageMeta {...meta} /></View>
        {pill && <ReactionPill reactions={reactions!} own={own} onPress={onReactions} />}
      </View>
    </View>
  </Pressable>
}
