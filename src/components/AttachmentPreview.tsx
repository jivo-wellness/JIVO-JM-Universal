import { ImageViewer } from './ImageViewer'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { randomUUID } from 'expo-crypto'
import { errorMessage } from '../core/api/client'
import { uploadLimitError, type PickedFile } from '../modules/messenger/media/model'
import { pickDocuments, pickMedia } from '../modules/messenger/media/gallery'
import { MAX_FILES, acceptFiles, editable, extensionOf, fileKind, nextSelection, sendFilesLabel } from '../modules/messenger/media/selection'
import { formatBytes } from '../modules/messenger/lib/text'
import { useColors } from '../ui'
import { Icon } from './Icon'
import { AttachPage } from './attach/AttachPage'
import { ImageEditorPage } from './attach/ImageEditorPage'
import { VideoPreview } from './attach/VideoPreview'

const web = Platform.OS === 'web'
const pointer = web ? ({ cursor: 'pointer' } as object) : null
type Item = { key: string; file: PickedFile }
/** Where the files came from: "Add more" opens the same kind of chooser (the gallery after the camera, as in WhatsApp). */
export type AttachSource = 'media' | 'document' | 'camera'

/**
 * Reference MediaPreview ("send files" screen, WhatsApp style) as a full-screen page over the chat: the chosen file
 * large in the middle (photo, playable video, or a document card), Edit for photos (reference ImageEditor), a
 * caption, the strip of chosen files (× to remove, + to add more, up to 10) and Send with the file count.
 * Files go to the outbox on Send (saved on the device first, uploaded and scanned in the background).
 */
export function AttachmentPreview({ initialFiles, source = 'document', notice: initialNotice = '', initialCaption, onClose, onSend }: {
  initialFiles: PickedFile[]; source?: AttachSource; notice?: string; initialCaption: string; conversation: string; onClose: () => void
  onSend: (files: Item[], caption: string, clientId: string) => Promise<void>
}) {
  const c = useColors(); const inset = useSafeAreaInsets()
  const [items, setItems] = useState<Item[]>(() => initialFiles.map(file => ({ key: randomUUID(), file })))
  const owned = useRef(items); const alive = useRef(true); const operation = useRef(false)
  const [selected, setSelected] = useState(items[0]?.key ?? '')
  const [caption, setCaption] = useState(initialCaption)
  const [editing, setEditing] = useState<Item | null>(null); const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(initialNotice)
  const clientId = useRef(randomUUID())
  const current = items.find(i => i.key === selected) ?? items[0]
  function update(next: Item[]) { owned.current = next; setItems(next); clientId.current = randomUUID() }
  async function dispose(item: Item) { await Promise.resolve(item.file.dispose?.()).catch(() => {}) }
  useEffect(() => { alive.current = true; return () => { alive.current = false; for (const item of owned.current) void dispose(item) } }, [])
  async function addMore() {
    if (operation.current || owned.current.length >= MAX_FILES) return
    operation.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const room = MAX_FILES - owned.current.length
      const files = source === 'document' ? await pickDocuments(room) : await pickMedia(room)
      if (!alive.current) { for (const file of files) await file.dispose?.(); return }
      const { accepted, rejected, notice: why } = acceptFiles(owned.current.length, files)
      for (const file of rejected) await Promise.resolve(file.dispose?.()).catch(() => {})
      if (why) setNotice(why)
      if (!accepted.length) return
      const added = accepted.map(file => ({ key: randomUUID(), file }))
      update([...owned.current, ...added]); setSelected(added[0].key)
    } catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { operation.current = false; if (alive.current) setBusy(false) }
  }
  function remove(item: Item) {
    if (operation.current) return
    void dispose(item)
    const next = nextSelection(owned.current.map(i => i.key), item.key, current?.key ?? item.key)
    update(owned.current.filter(i => i.key !== item.key))
    if (!next) onClose(); else setSelected(next)
  }
  async function send() {
    if (operation.current || !owned.current.length) return
    operation.current = true; setBusy(true); setError('')
    try {
      for (const item of owned.current) { const invalid = uploadLimitError(item.file); if (invalid) throw Error(`${item.file.name}: ${invalid}`) }
      setStatus('Preparing to send...')
      await onSend(owned.current, caption, clientId.current)
    } catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { operation.current = false; if (alive.current) { setBusy(false); setStatus('') } }
  }
  function applyEdit(old: Item, file: PickedFile) {
    const key = randomUUID()
    update(owned.current.map(i => (i.key === old.key ? { key, file } : i))); setSelected(key); setEditing(null); void dispose(old)
  }

  if (!current) return null
  const kind = fileKind(current.file)
  return <>
    <AttachPage title={current.file.name} onBack={() => { if (!busy) onClose() }} backIcon="x" backLabel="Close and discard files" backDisabled={busy} scroll={false} background={c.dark ? '#0b141a' : '#efeae2'}
      right={editable(current.file) ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${current.file.name}`} disabled={busy} onPress={() => setEditing(current)}
        style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 20, marginRight: 4, backgroundColor: pressed ? c.hover : 'transparent', opacity: busy ? 0.5 : 1 }, pointer]}>
        <Icon name="pencil" size={20} color={c.text} /><Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14 }}>Edit</Text>
      </Pressable> : undefined}>
      <View style={{ flex: 1, minHeight: 120, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'image' ? <ImageViewer key={current.key} uri={current.file.uri} name={current.file.name} previous={!busy && items.indexOf(current) > 0 ? () => setSelected(items[items.indexOf(current) - 1].key) : undefined} next={!busy && items.indexOf(current) < items.length - 1 ? () => setSelected(items[items.indexOf(current) + 1].key) : undefined} />
          : kind === 'video' ? <VideoPreview key={current.key} uri={current.file.uri} label={`Video ${current.file.name}`} />
            : <View style={{ width: 288, maxWidth: '100%', alignItems: 'center', gap: 12, padding: 32, borderRadius: 16, backgroundColor: c.panel, boxShadow: '0 10px 30px rgba(0,0,0,0.12)' }}>
              <View style={{ width: 80, height: 96, borderRadius: 12, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="fileText" size={40} color={c.brand} />
                <View style={{ position: 'absolute', bottom: -8, borderRadius: 4, backgroundColor: c.brandFill, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: '#ffffff', fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 10 }}>{extensionOf(current.file.name)}</Text></View>
              </View>
              <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, textAlign: 'center', marginTop: 4 }}>{current.file.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{formatBytes(current.file.size)}</Text>
            </View>}
      </View>
      {busy && <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, padding: 8 }}><ActivityIndicator color={c.brand} /><Text style={{ color: c.text }}>{status || 'Opening files…'}</Text></View>}
      {!!(error || notice) && <Text accessibilityRole="alert" style={{ color: error ? c.danger : c.text, paddingHorizontal: 16, paddingBottom: 8, textAlign: 'center', fontSize: 13 }}>{error || notice}</Text>}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, alignItems: 'center' }}>
        <TextInput selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent" accessibilityLabel="Attachment caption" placeholder="Add a caption" placeholderTextColor={c.muted} value={caption} onChangeText={v => { setCaption(v); clientId.current = randomUUID() }} editable={!busy} maxLength={4000} multiline
          style={[{ width: '100%', maxWidth: 672, minHeight: 48, maxHeight: 120, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, backgroundColor: c.dark ? '#0f172a' : '#ffffff', borderWidth: 1, borderColor: c.border, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 13, textAlignVertical: 'center' }, web ? ({ outlineStyle: 'none' } as object) : null]} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: Math.max(12, inset.bottom + 8), borderTopWidth: 1, borderColor: c.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Chosen files" contentContainerStyle={{ gap: 8, paddingVertical: 6, paddingHorizontal: 4 }} style={{ flex: 1 }}>
          {items.map(item => {
            const k = fileKind(item.file); const on = item.key === current.key
            return <View key={item.key}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Show ${item.file.name}`} accessibilityState={{ selected: on }} disabled={busy} onPress={() => setSelected(item.key)}
                style={[{ width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderColor: on ? c.brand : 'transparent', backgroundColor: k === 'video' ? '#111827' : c.panel, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, pointer]}>
                {k === 'image' ? <Image source={{ uri: item.file.uri }} style={{ width: '100%', height: '100%' }} />
                  : k === 'video' ? <Icon name="play" size={22} color="#ffffff" />
                    : <View style={{ alignItems: 'center', gap: 2 }}><Icon name="fileText" size={20} color={c.muted} /><Text style={{ color: c.muted, fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 9 }}>{extensionOf(item.file.name)}</Text></View>}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.file.name}`} disabled={busy} onPress={() => remove(item)} hitSlop={8}
                style={[{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }, pointer]}><Icon name="x" size={12} color="#ffffff" /></Pressable>
            </View>
          })}
          {items.length < MAX_FILES && <Pressable accessibilityRole="button" accessibilityLabel="Add more files" disabled={busy} onPress={() => void addMore()}
            style={[{ width: 56, height: 56, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: c.dark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.2)', alignItems: 'center', justifyContent: 'center' }, pointer]}><Icon name="plus" size={24} color={c.muted} /></Pressable>}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel={error ? 'Retry sending files' : sendFilesLabel(items.length)} disabled={busy} onPress={() => void send()}
          style={({ pressed }) => [{ width: 56, height: 56, borderRadius: 28, backgroundColor: pressed ? c.primaryHover : c.primary, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1, boxShadow: '0 6px 16px rgba(0,0,0,0.2)' }, pointer]}>
          <Icon name={error ? 'refreshCw' : 'sendHorizontal'} size={24} color="#ffffff" />
          <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }}><Text style={{ color: '#0f172a', fontFamily: 'Inter_700Bold', fontWeight: '700', fontSize: 12 }}>{items.length}</Text></View>
        </Pressable>
      </View>
    </AttachPage>
    {editing && <ImageEditorPage asset={editing.file} onCancel={() => setEditing(null)} onApply={file => applyEdit(editing, file)} />}
  </>
}
