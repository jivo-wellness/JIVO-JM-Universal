import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { glass, useColors } from '../../ui'
import { Icon, type IconName } from '../Icon'

const web = Platform.OS === 'web'

export type AttachActions = {
  canSendFile: boolean
  /** Reference AttachAllowed (JM_LOCATION_SHARE, JM_CONTACT_SHARE, JM_POLL_CREATE, JM_EVENT_CREATE); all allowed when omitted. */
  allowed?: { location: boolean; contact: boolean; poll: boolean; event: boolean }
  onDocument: () => void
  onMedia: () => void
  onCamera: () => void
  onLocation: () => void
  onContact: () => void
  onPoll: () => void
  onEvent: () => void
}
type Key = keyof Omit<AttachActions, 'canSendFile' | 'allowed'>
/** Reference AttachMenu items, in its order and colours (violet-500, sky-500, rose-500, emerald-600, teal-600, amber-500, pink-500). */
export const attachItems: { key: Key; label: string; icon: IconName; tone: string; gate: 'file' | 'location' | 'contact' | 'poll' | 'event' }[] = [
  { key: 'onDocument', label: 'Document', icon: 'fileText', tone: '#8b5cf6', gate: 'file' },
  { key: 'onMedia', label: 'Photos & videos', icon: 'image', tone: '#0ea5e9', gate: 'file' },
  { key: 'onCamera', label: 'Camera', icon: 'camera', tone: '#f43f5e', gate: 'file' },
  { key: 'onLocation', label: 'Location', icon: 'mapPin', tone: '#059669', gate: 'location' },
  { key: 'onContact', label: 'Contact', icon: 'user', tone: '#0d9488', gate: 'contact' },
  { key: 'onPoll', label: 'Poll', icon: 'barChart3', tone: '#f59e0b', gate: 'poll' },
  { key: 'onEvent', label: 'Event', icon: 'calendarDays', tone: '#ec4899', gate: 'event' },
]
export const attachDisabled = (actions: Pick<AttachActions, 'canSendFile' | 'allowed'>, gate: (typeof attachItems)[number]['gate']) =>
  gate === 'file' ? !actions.canSendFile : actions.allowed ? !actions.allowed[gate] : false

/**
 * The attach card above the composer: a vertical list of boxed rows (coloured round icon + label, full card width),
 * the reference AttachMenu's list in its items, colours, order and permissions. Each item opens its own full-screen
 * page. Phones: the card spans the composer width (8px margins); wider screens: 320px from the message box's left edge.
 */
export function AttachMenu({ anchor, actions, onClose }: { anchor: { x: number; y: number }; actions: AttachActions; onClose: () => void }) {
  const c = useColors(); const { width, height } = useWindowDimensions()
  const phone = width < 768
  const cardWidth = Math.min(288, width - 24)
  const left = phone ? width - cardWidth - 12 : Math.max(8, Math.min(anchor.x, width - cardWidth - 8))
  const bottom = Math.max(8, height - anchor.y + 8)
  return <Modal transparent visible onRequestClose={onClose} animationType="fade" statusBarTranslucent navigationBarTranslucent>
    <Pressable accessibilityLabel="Close attach menu" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, ...(web ? { cursor: 'default' } : {}) } as object} />
    <View accessibilityRole="menu" accessibilityLabel="Attach" style={[glass(c, 4), { position: 'absolute', left, bottom, width: cardWidth, maxHeight: height - bottom - 8, borderWidth: 1, borderRadius: 18, overflow: 'hidden' }]}>
      <ScrollView bounces={false} contentContainerStyle={{ padding: 8, gap: 6 }}>
        {attachItems.map(item => {
          const disabled = attachDisabled(actions, item.gate)
          return <Pressable key={item.key} accessibilityRole="menuitem" accessibilityLabel={item.label} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { onClose(); actions[item.key]() }}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 26, borderWidth: 0, borderColor: c.border, opacity: disabled ? 0.45 : 1, backgroundColor: (hovered || pressed) && !disabled ? `${item.tone}18` : 'transparent' }, web ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as object) : null]}>
            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: item.tone }}><Icon name={item.icon} size={20} color="#ffffff" /></View>
            <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 }}>{item.label}</Text>
          </Pressable>
        })}
      </ScrollView>
    </View>
  </Modal>
}
