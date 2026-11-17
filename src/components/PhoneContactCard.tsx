import { useCallback, useEffect, useState } from 'react'
import { AccessibilityInfo, Linking, Platform, Pressable, Text, View } from 'react-native'
import { setStringAsync } from 'expo-clipboard'
import { api, errorMessage, origin } from '../core/api/client'
import type { Attachment } from '../modules/messenger/api'
import { attachmentDownloadPath } from '../modules/messenger/media/attachmentExport'
import { saveContact } from '../modules/messenger/media/saveContact'
import { mediaUrl } from '../modules/messenger/media/url'
import { parseVCardDetails, phoneKey, telHref, type ContactDetails, type ContactPhone } from '../modules/messenger/lib/vcard'
import { useResource } from '../shared/useResource'
import { useColors } from '../ui'
import { ChatAvatar } from './ChatAvatar'
import { Icon, type IconName } from './Icon'

const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null
/** Parsed cards by attachment id: the list recycles rows, and a card's file never changes. */
const cards = new Map<string, ContactDetails>()

/** The card's vCard text through the signed-in API (same access check as any download), first 20 000 characters. */
async function loadCard(id: string, downloadUrl: string): Promise<ContactDetails> {
  const known = cards.get(id)
  if (known) return known
  const text = (await api.get<string>(attachmentDownloadPath(downloadUrl), { responseType: 'text', transformResponse: [(data: unknown) => data] })).data
  const card = parseVCardDetails(String(text ?? '').slice(0, 20_000))
  if (cards.size > 200) cards.clear()
  cards.set(id, card)
  return card
}

function PhoneRow({ phone }: { phone: ContactPhone }) {
  const c = useColors(); const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer) }, [copied])
  const copy = () => void setStringAsync(phone.number).then(() => { setCopied(true); AccessibilityInfo.announceForAccessibility('Copied') }, () => {})
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 22 }}>
    <Icon name="phone" size={12} color={c.muted} />
    <Text numberOfLines={1} selectable style={{ flexShrink: 1, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{phone.number}</Text>
    {!!phone.label && <Text numberOfLines={1} style={{ flexShrink: 0, color: c.muted, opacity: 0.8, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 }}>{`· ${phone.label}`}</Text>}
    {/* 12px glyph, 32px hit box (hitSlop) so it is easy to tap on a phone without widening the row. */}
    <Pressable accessibilityRole="button" accessibilityLabel={`Copy ${phone.number}`} onPress={copy} hitSlop={8}
      style={({ pressed }) => [{ marginLeft: 2, padding: 4, borderRadius: 6, backgroundColor: pressed ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }, pointer]}>
      <Icon name={copied ? 'check' : 'copy'} size={13} color={copied ? c.brand : c.muted} />
    </Pressable>
  </View>
}

/**
 * Reference PhoneContactCard: a contact from someone's phone (a vCard file) as a card, not a file. Avatar with initials,
 * name, each distinct number once (with its type and a copy button), emails, then Call (the dialer, first number)
 * and Save contact (the phone's "Create contact" form; the browser build downloads the .vcf).
 */
export function PhoneContactCard({ attachment: a, onExport }: { attachment: Attachment; onExport: () => void }) {
  const c = useColors(); const line = c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const load = useCallback(() => loadCard(a.id, a.download_url), [a.id, a.download_url])
  const card = useResource(load)
  const [note, setNote] = useState('')
  // A card read before shows at once (no blank frame when the row is recycled or the message updates).
  const details = card.value ?? cards.get(a.id) ?? null
  const name = details?.name ?? a.name.replace(/\.vcf$/i, '')
  const phone = details?.phones[0]?.number
  const action = (title: string, label: string, icon: IconName, onPress: () => void) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [{ flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 4, paddingVertical: 4, backgroundColor: hovered || pressed ? (c.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') : 'transparent' }, pointer]}>
    <Icon name={icon} size={16} color={c.brand} /><Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20 }}>{title}</Text>
  </Pressable>
  const call = () => { if (phone) void Linking.openURL(telHref(phone)).catch(() => setNote('This device cannot make calls.')) }
  const save = () => {
    // Without a parsed card (the file could not be read) the export sheet still hands the .vcf to another app.
    if (!details) { onExport(); return }
    setNote('')
    void saveContact(details, mediaUrl(a.download_url, origin)).then(result => {
      if (result === 'denied') setNote('Allow JM to use your contacts in Settings to save this contact.')
    }, e => setNote(errorMessage(e)))
  }
  return <View accessibilityLabel={`Contact card: ${name}`} style={{ width: 256, maxWidth: '100%', paddingVertical: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <ChatAvatar name={name} seed={a.id} size={44} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 15, lineHeight: 20.625 }}>{name}</Text>
        {details?.phones.map(p => <PhoneRow key={phoneKey(p.number)} phone={p} />)}
        {details?.emails.map(e => <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="mail" size={12} color={c.muted} /><Text numberOfLines={1} style={{ flexShrink: 1, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{e}</Text></View>)}
        {!!card.error && <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>Contact card</Text>}
      </View>
    </View>
    {!!note && <Text accessibilityRole="alert" style={{ marginTop: 4, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16 }}>{note}</Text>}
    <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: line, flexDirection: 'row', gap: 4 }}>
      {!!phone && action('Call', `Call ${name}`, 'phone', call)}
      {action('Save contact', `Save contact ${name}`, 'download', save)}
    </View>
  </View>
}
