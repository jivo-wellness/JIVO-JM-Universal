import { useEffect, useRef, useState } from 'react'
import { api, errorMessage, origin } from '../core/api/client'
import { deleteMessage, getConversation, getWindow, type Message, type MessageWindow, type Attachment } from '../modules/messenger/api'
import { chatLock } from '../modules/messenger/chatLock'
import { exportMessageAttachment } from '../modules/messenger/media/attachmentExport'
import { validateAttachmentExportSize } from '../modules/messenger/media/export'
import { saveGallery } from '../modules/messenger/media/saveGallery'
import { MediaSwipe } from './MediaSwipe'
import { Image, Modal, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { clockTime, dayLabel } from '../modules/messenger/lib/text'
import { mediaUrl } from '../modules/messenger/media/url'
import { Icon, type IconName } from './Icon'
import { ImageViewer } from './ImageViewer'
import { ViewerVideo } from './MediaPlayback'

/** One photo or video of the open chat, with who sent it and when (WhatsApp's viewer header). */
export interface ViewerItem { attachment: Attachment; message: string; sender: string; createdAt: string; seq?: number }

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
export function ChatMediaViewer({ items, index, onIndex, onClose, onShare, onForward, onDeleted, conversation }: { onDeleted: (message: Message, scope: 'me' | 'everyone') => void; conversation: string; onForward: (item: ViewerItem) => void; items: ViewerItem[]; index: number; onIndex: (index: number) => void; onClose: () => void; onShare: (item: ViewerItem) => void }) {
  const [menu, setMenu] = useState(false); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Message | null>(null)
  const active = useRef(true); const abort = useRef<AbortController | null>(null)
  useEffect(() => { active.current = true; return () => { active.current = false; abort.current?.abort() } }, [])
  const inset = useSafeAreaInsets()
  const item = items[index]
  const hasPrevious = index > 0; const hasNext = index < items.length - 1
  const previous = hasPrevious ? () => onIndex(index - 1) : undefined
  const next = hasNext ? () => onIndex(index + 1) : undefined
  useEffect(() => {
    for (const nearby of [items[index - 1], items[index + 1]]) {
      if (nearby?.attachment.kind !== 'image') continue
      const url = mediaUrl(nearby.attachment.preview_url || nearby.attachment.download_url, origin)
      if (url) void Image.prefetch(url).catch(() => {})
    }
  }, [items, index])
  if (!item) return null
  const a = item.attachment
  const prepareDelete = async () => {
    setMenu(false); setBusy(true); setNotice('')
    try {
      const page = await getWindow(conversation, { around: item.seq })
      const message = page.results.find(m => m.id === item.message && !m.deleted && m.attachments.some(file => file.id === a.id))
      if (!message) throw Error('This image is no longer available.')
      if (message.attachments.length !== 1) throw Error('This older message contains multiple files. Individual deletion is unavailable for this message; delete it from the chat to remove all its files.')
      if (active.current) setDeleting(message)
    } catch (e) { if (active.current) setNotice(errorMessage(e)) }
    finally { if (active.current) setBusy(false) }
  }
  const remove = async (scope: 'me' | 'everyone') => {
    if (!deleting || busy) return
    setBusy(true); setNotice('')
    try {
      await deleteMessage(deleting.id, scope)
      if (active.current) { onDeleted(deleting, scope); onClose() }
    } catch (e) { if (active.current) setNotice(errorMessage(e)) }
    finally { if (active.current) setBusy(false) }
  }
  const uri = a.kind === 'image' ? mediaUrl(a.mime === 'image/gif' ? a.download_url : a.preview_url || a.download_url, origin) : null
  const save = async () => {
    if (busy) return
    setBusy(true); setMenu(false); setNotice('')
    const controller = new AbortController(); abort.current = controller
    try {
      await exportMessageAttachment({ message: item.message, attachment: a.id }, controller.signal, () => active.current, {
        window: async () => { const detail = await getConversation(conversation); if (detail.locked && !chatLock.snapshot().unlocked) throw Error('Unlock this chat before saving.'); return (await api.get<MessageWindow>(`/conversations/${conversation}/messages/`, { params: { around: item.seq }, signal: controller.signal })).data },
        download: async path => (await api.get<Blob>(path, { responseType: 'blob', signal: controller.signal, timeout: 120000 })).data,
        validate: validateAttachmentExportSize, save: saveGallery,
      }); if (active.current) setNotice('Saved to gallery')
    } catch (e) { if (active.current) setNotice(errorMessage(e)) } finally { if (active.current) setBusy(false) }
  }
  const when = `${dayLabel(item.createdAt)}, ${clockTime(item.createdAt)}`
  return <Modal visible onRequestClose={() => { if (busy) return; if (deleting) setDeleting(null); else if (menu) setMenu(false); else onClose() }} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent>
    <View style={{ flex: 1, backgroundColor: '#000000', paddingTop: inset.top, paddingBottom: inset.bottom }}>
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
        <TopButton icon="back" label="Close image" onPress={onClose} />
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}>
          <Text numberOfLines={1} style={{ color: '#ffffff', fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 16, lineHeight: 22 }}>{item.sender}</Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{when}</Text>
        </View>
        {items.length > 1 && <Text accessibilityLiveRegion="polite" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'], paddingHorizontal: 4 }}>{`${index + 1} of ${items.length}`}</Text>}
        <TopButton icon="moreVertical" label="Media options" onPress={() => setMenu(v => !v)} />
      </View>
      {(busy || notice) && <Text accessibilityLiveRegion="polite" style={{ color: 'white', padding: 12 }}>{busy ? 'Please wait…' : notice}</Text>}
      <View style={{ flex: 1 }}>
        {a.kind === 'image'
          ? uri ? <ImageViewer key={a.id} uri={uri} name={a.name} previous={previous} next={next} /> : <Text style={{ color: '#ffffff', textAlign: 'center', padding: 24 }}>This image URL is unsupported.</Text>
          : <MediaSwipe previous={previous} next={next}><ViewerVideo key={a.id} attachment={a} /></MediaSwipe>}
        {web && hasPrevious && <SideButton side="left" label="Previous photo" onPress={() => onIndex(index - 1)} />}
        {web && hasNext && <SideButton side="right" label="Next photo" onPress={() => onIndex(index + 1)} />}
      </View>
      {menu && <><Pressable accessibilityLabel="Close media options" onPress={() => setMenu(false)} style={{ position: 'absolute', inset: 0 }} /><View style={{ position: 'absolute', top: inset.top + 52, right: 12, width: 210, backgroundColor: '#1e293b', borderRadius: 12, paddingVertical: 8 }}>
        <MenuAction icon="download" label="Save to gallery" disabled={busy} onPress={() => void save()} />
        <MenuAction icon="forward" label="Forward" disabled={busy} onPress={() => { setMenu(false); onForward(item) }} />
        <MenuAction icon="share2" label="Share" disabled={busy} onPress={() => { setMenu(false); onShare(item) }} />
        <MenuAction icon="trash2" label="Delete" disabled={busy} onPress={() => void prepareDelete()} />
      </View></>}
      {deleting && <><View style={{ position: 'absolute', inset: 0, backgroundColor: '#00000088' }} /><View accessibilityViewIsModal style={{ position: 'absolute', bottom: inset.bottom, left: 0, right: 0, backgroundColor: '#1e293b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '600', marginBottom: 12 }}>Delete this {a.kind === 'video' ? 'video' : 'image'}?</Text>
        {!!deleting.body && <Text style={{ color: '#cbd5e1', marginBottom: 12 }}>Its caption will also be deleted.</Text>}
        <MenuAction icon="trash2" label="Delete for me" disabled={busy} onPress={() => void remove('me')} />
        {deleting.can.delete_for_everyone && <MenuAction icon="trash2" label="Delete for everyone" disabled={busy} onPress={() => void remove('everyone')} />}
        <MenuAction icon="x" label="Cancel" disabled={busy} onPress={() => setDeleting(null)} />
      </View></>}
    </View>
  </Modal>
}

function MenuAction({ icon, label, disabled, onPress }: { icon: IconName; label: string; disabled: boolean; onPress: () => void }) {
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: 16, alignItems: 'center', padding: 16, backgroundColor: pressed ? '#334155' : 'transparent' })}><Icon name={icon} color="white" size={20} /><Text style={{ color: 'white', fontSize: 15 }}>{label}</Text></Pressable>
}
