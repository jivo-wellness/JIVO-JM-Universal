import { useCallback, useRef, useState } from 'react'
import { Share, Text, View } from 'react-native'
import { setStringAsync } from 'expo-clipboard'
import { randomUUID } from 'expo-crypto'
import { api, errorMessage } from '../../core/api/client'
import { listConversations, sendMessage } from '../messenger/api'
import { useCursor } from '../../shared/useCursor'
import { Sheet } from '../../components/Sheet'
import { AttachPage, ListRow, SearchBar } from '../../components/attach/AttachPage'
import { Icon, type IconName } from '../../components/Icon'
import { Button, useColors } from '../../ui'
import type { Ask } from './model'
export type Selection = { ask: Ask; text: string; own: boolean }
export function AtlasMessageOptions({ selected, onClose, onReply, onDeleted }: { selected: Selection | null; onClose: () => void; onReply: (ask: Ask) => void; onDeleted: (id: number) => void }) {
  const c = useColors()
  const [mode, setMode] = useState('menu'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const close = () => { onClose(); setMode('menu'); setError('') }
  const run = async (action: () => Promise<unknown>) => { setBusy(true); setError(''); try { await action(); close() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) } }
  if (!selected) return null
  if (mode === 'forward') return <AtlasForward selected={selected} onClose={close} />
  const row = (icon: IconName, title: string, onPress: () => void) => <ListRow key={title} title={title} leading={<Icon name={icon} size={20} />} onPress={onPress} disabled={busy} />
  return <Sheet visible title={mode === 'info' ? 'Message info' : mode === 'delete' ? 'Delete this Atlas exchange?' : 'Message options'} onClose={close} closeDisabled={busy}>
    <Text numberOfLines={3} style={{ color: c.muted, paddingBottom: 12 }}>{selected.text}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger }}>{error}</Text>}
    {mode === 'menu' && <>
      {row('reply', 'Reply', () => { onReply(selected.ask); close() })}
      {row('copy', 'Copy', () => void run(() => setStringAsync(selected.text)))}
      {row('forward', 'Forward', () => setMode('forward'))}
      {row('share2', 'Share', () => void run(() => Share.share({ message: selected.text })))}
      {row('info', 'Info', () => setMode('info'))}
      {row('trash2', 'Delete for me', () => setMode('delete'))}
    </>}
    {mode === 'info' && <View style={{ gap: 12 }}>{[['Status', selected.ask.state], ['Asked', new Date(selected.ask.created_at).toLocaleString()], ['Answered', selected.ask.answered_at ? new Date(selected.ask.answered_at).toLocaleString() : 'Not yet'], ['Agent', selected.ask.with || 'Atlas']].map(([label, value]) => <View key={label}><Text style={{ color: c.muted }}>{label}</Text><Text style={{ color: c.text }}>{value}</Text></View>)}</View>}
    {mode === 'delete' && <><Text style={{ color: c.muted }}>This removes the question and its reply from your JM history. It does not cancel the Atlas job or erase the copy stored by Atlas.</Text><Button title="Delete for me" disabled={busy} onPress={() => void run(async () => { await api.delete(`/atlas/asks/${selected.ask.id}/`); onDeleted(selected.ask.id) })} /></>}
  </Sheet>
}
function AtlasForward({ selected, onClose }: { selected: Selection; onClose: () => void }) {
  const c = useColors(); const [query, setQuery] = useState(''); const [target, setTarget] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const ids = useRef(new Map<string, string>())
  const load = useCallback((cursor?: string | null) => listConversations('all', query, cursor), [query]); const page = useCursor(load)
  return <AttachPage title="Forward to..." onBack={onClose} footer={<Button title="Forward message" disabled={!target || busy} onPress={() => { setBusy(true); setError(''); if (!ids.current.has(target)) ids.current.set(target, randomUUID()); void sendMessage(target, { client_id: ids.current.get(target)!, body: `Forwarded from Atlas chat\n\n${selected.text}` }).then(onClose).catch(e => setError(errorMessage(e))).finally(() => setBusy(false)) }} />}>
    <SearchBar value={query} onChangeText={setQuery} placeholder="Search chats" label="Search chats to forward to" />
    {!!(error || page.error) && <Text style={{ color: c.danger }}>{error || page.error}</Text>}
    {page.items.filter(item => item.can.send).map(item => <ListRow key={item.id} title={item.title} leading={<Icon name={target === item.id ? 'check' : 'chat'} />} onPress={() => setTarget(item.id)} />)}
    {page.cursor && <Button title="More chats" variant="secondary" onPress={() => void page.more()} />}
  </AttachPage>
}
