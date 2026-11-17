import { Modal, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { origin } from '../core/api/client'
import type { Attachment } from '../modules/messenger/api'
import { clockTime, dayLabel } from '../modules/messenger/lib/text'
import { mediaUrl } from '../modules/messenger/media/url'
import { Icon, type IconName } from './Icon'
import { ImageViewer } from './ImageViewer'
import { ViewerVideo } from './MediaPlayback'

/** One photo or video of the open chat, with who sent it and when (WhatsApp's viewer header). */
export interface ViewerItem { attachment: Attachment; message: string; sender: string; createdAt: string }

const web = Platform.OS === 'web'
const pointer = web ? ({ cursor: 'pointer' } as object) : null

function TopButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.12)' : 'transparent' }, pointer]}>
    <Icon name={icon} size={22} color="#ffffff" />
  </Pressable>
}
function SideButton({ side, label, onPress }: { side: 'left' | 'right'; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
    style={({ pressed }) => [{ position: 'absolute', top: '50%', marginTop: -20, [side]: 8, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)' }, pointer]}>
    <Icon name={side === 'left' ? 'chevronLeft' : 'chevronRight'} size={24} color="#ffffff" />
  </Pressable>
}

/**
 * Full-screen photos and videos of the open chat (reference ImageViewer, WhatsApp header): swipe or the side arrows
 * (photos; videos keep their touches for the player controls, so they get the side arrows) for the previous / next item, "N of M", sender and time, Back (and Android Back) to close, and Save/share through
 * the existing export sheet. Photos pinch-zoom (ImageViewer); videos play with the system controls.
 */
export function ChatMediaViewer({ items, index, onIndex, onClose, onShare }: { items: ViewerItem[]; index: number; onIndex: (index: number) => void; onClose: () => void; onShare: (item: ViewerItem) => void }) {
  const inset = useSafeAreaInsets()
  const item = items[index]
  const hasPrevious = index > 0; const hasNext = index < items.length - 1
  const previous = hasPrevious ? () => onIndex(index - 1) : undefined
  const next = hasNext ? () => onIndex(index + 1) : undefined
  if (!item) return null
  const a = item.attachment
  const uri = a.kind === 'image' ? mediaUrl(a.preview_url || a.download_url, origin) : null
  const when = `${dayLabel(item.createdAt)}, ${clockTime(item.createdAt)}`
  return <Modal visible onRequestClose={onClose} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent>
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: inset.top, paddingBottom: inset.bottom }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
        <TopButton icon="back" label="Close image" onPress={onClose} />
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}>
          <Text numberOfLines={1} style={{ color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 22 }}>{item.sender}</Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{when}</Text>
        </View>
        {items.length > 1 && <Text accessibilityLiveRegion="polite" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'], paddingHorizontal: 4 }}>{`${index + 1} of ${items.length}`}</Text>}
        <TopButton icon="download" label={`Save or share ${a.name}`} onPress={() => onShare(item)} />
      </View>
      <View style={{ flex: 1 }}>
        {a.kind === 'image'
          ? uri ? <ImageViewer key={a.id} uri={uri} name={a.name} previous={previous} next={next} /> : <Text style={{ color: '#ffffff', textAlign: 'center', padding: 24 }}>This image URL is unsupported.</Text>
          : <View style={{ flex: 1 }}><ViewerVideo key={a.id} attachment={a} /></View>}
        {(web || a.kind !== 'image') && hasPrevious && <SideButton side="left" label="Previous photo" onPress={() => onIndex(index - 1)} />}
        {(web || a.kind !== 'image') && hasNext && <SideButton side="right" label="Next photo" onPress={() => onIndex(index + 1)} />}
      </View>
    </View>
  </Modal>
}
