import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { errorMessage, origin } from '../core/api/client'
import { realtime } from '../core/realtime/socket'
import { listBlocks, type BlockedContact } from '../modules/messenger/api'
import { blockCopy, toggleBlock, type BlockTarget } from '../modules/messenger/blocking'
import { mediaUrl } from '../modules/messenger/media/url'
import { useResource } from '../shared/useResource'
import { useReconnectRetry } from '../shared/useReconnectRetry'
import { Button, ErrorState, useColors } from '../ui'
import { ChatAvatar } from './ChatAvatar'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

/**
 * "Block Khushwinder Singh?" / "Unblock …?" (personal "Block contact", BE-108; not the administrator "Block
 * messaging"). Needs a connection: a failure (offline included) is shown in the sheet and nothing changes.
 */
export function BlockContactSheet({ target, onClose, onDone }: { target: BlockTarget | null; onClose: () => void; onDone: (target: BlockTarget) => void }) {
  const c = useColors(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [shown, setShown] = useState(target)
  if (shown !== target) { setShown(target); setError('') }
  if (!target) return null
  const confirm = async () => {
    setBusy(true); setError('')
    const problem = await toggleBlock(target)
    setBusy(false)
    if (problem) setError(problem)
    else onDone(target)
  }
  return <Sheet visible onClose={() => { if (!busy) onClose() }} title={blockCopy.title(target)}>
    <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{blockCopy.body(target)}</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{error}</Text>}
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
      <Button variant="secondary" title="Cancel" disabled={busy} onPress={onClose} />
      <Button variant={target.blocked ? 'primary' : 'danger'} title={blockCopy.confirm(target)} loading={busy} onPress={() => void confirm()} />
    </View>
  </Sheet>
}

/** "You blocked this contact. Tap to unblock." in place of the composer. */
export function BlockedBanner({ onPress }: { onPress: () => void }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={blockCopy.banner} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderColor: c.border }}>
    <Icon name="ban" size={16} color={c.muted} />
    <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{blockCopy.banner}</Text>
  </Pressable>
}

/** Profile / contact info: "Block Khushwinder Singh" or "Unblock …", with its confirmation. */
export function BlockContactButton({ person, blocked, onChanged }: { person: { id: string; name: string }; blocked: boolean; onChanged: () => void }) {
  const c = useColors(); const [target, setTarget] = useState<BlockTarget | null>(null)
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={blocked ? `Unblock ${person.name}` : `Block ${person.name}`} onPress={() => setTarget({ id: person.id, name: person.name, blocked })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <Icon name="ban" size={18} color={blocked ? c.muted : c.danger} />
      <Text style={{ color: blocked ? c.text : c.danger, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 22 }}>{blocked ? `Unblock ${person.name}` : `Block ${person.name}`}</Text>
    </Pressable>
    <BlockContactSheet target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); onChanged() }} />
  </>
}

/** Profile → Privacy: the people I blocked, each with Unblock. */
export function BlockedContacts() {
  const c = useColors(); const [target, setTarget] = useState<BlockTarget | null>(null)
  const load = useCallback(() => listBlocks(), []); const resource = useResource<BlockedContact[]>(load, { keep: true })
  useReconnectRetry(!!resource.error, resource.refresh)
  // Blocked or unblocked on another device (or from a chat): follow.
  useEffect(() => realtime.on('CONTACT_BLOCK_CHANGED', resource.refresh), [resource.refresh])
  const rows = resource.value ?? []
  return <View style={{ gap: 8 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="ban" size={16} color={c.muted} /><Text accessibilityRole="header" style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 }}>Blocked contacts</Text></View>
    <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{'Blocked contacts can’t message you or see when you’re online. They aren’t notified.'}</Text>
    {resource.loading && !resource.value && <ActivityIndicator color={c.brand} />}
    {!!resource.error && <ErrorState message={errorMessage(resource.error)} onRetry={resource.refresh} />}
    {!!resource.value && !rows.length && <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>No blocked contacts.</Text>}
    {rows.length > 0 && <View accessibilityLabel="Blocked contacts list" style={{ borderWidth: 1, borderColor: c.border, borderRadius: 16, overflow: 'hidden' }}>
      {rows.map((r, index) => <View key={r.user.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: index ? 1 : 0, borderColor: c.border }}>
        <ChatAvatar name={r.user.name} seed={r.user.id} uri={mediaUrl(r.user.avatar_url, origin)} size={36} />
        <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20 }}>{r.user.name}</Text>
        <Button size="sm" variant="secondary" title="Unblock" accessibilityLabel={`Unblock ${r.user.name}`} onPress={() => setTarget({ id: r.user.id, name: r.user.name, blocked: true })} />
      </View>)}
    </View>}
    <BlockContactSheet target={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); resource.refresh() }} />
  </View>
}
