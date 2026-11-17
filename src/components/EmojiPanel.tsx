import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef } from 'react'
import { FlatList, Image, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions, type ImageSourcePropType } from 'react-native'
import type { PickedFile } from '../modules/messenger/media/model'
import { favouriteFile, favouriteStickers } from '../modules/messenger/stickers/favourites'
import { searchPack } from '../modules/messenger/stickers/model'
import { jmPack, packStickerFile } from '../modules/messenger/stickers/pack'
import { emojiSections, parseRecents, pushRecent, searchEmoji, type EmojiSection } from '../modules/messenger/lib/emoji'
import { emojiRecentsStorage } from '../modules/messenger/emojiRecentsStorage'
import { useColors } from '../ui'
import { Icon } from './Icon'

const CELL = 44
const HEADER = 30
const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null
/** Category bar glyphs (WhatsApp draws line icons; the theme has no animal/food icons, so the bar uses the emoji, dimmed when not selected). */
const glyphs: Record<string, string> = { recent: '🕘', smileys: '😀', animals: '🐻', food: '🍔', activity: '⚽', travel: '🚗', objects: '💡', symbols: '❤️', flags: '🏳️' }

// Recently used emoji: shared by every chat, loaded once, written after each pick.
let recentCache: string[] | null = null
const recentListeners = new Set<(value: string[]) => void>()
function useRecents(): string[] {
  const [value, setValue] = useState<string[]>(recentCache ?? [])
  useEffect(() => {
    recentListeners.add(setValue)
    if (recentCache === null) void emojiRecentsStorage.read().then(raw => { if (recentCache === null) { recentCache = parseRecents(raw); recentListeners.forEach(fn => fn(recentCache!)) } })
    return () => { recentListeners.delete(setValue) }
  }, [])
  return value
}
export function rememberEmoji(emoji: string) {
  recentCache = pushRecent(recentCache ?? [], emoji)
  recentListeners.forEach(fn => fn(recentCache!))
  void emojiRecentsStorage.write(JSON.stringify(recentCache))
}

type Row = { type: 'header'; key: string; label: string; section: string } | { type: 'row'; key: string; emojis: string[]; section: string }
function rowsFor(sections: EmojiSection[], columns: number): Row[] {
  const rows: Row[] = []
  for (const s of sections) {
    if (!s.emojis.length) continue
    rows.push({ type: 'header', key: 'h-' + s.key, label: s.label, section: s.key })
    for (let i = 0; i < s.emojis.length; i += columns) rows.push({ type: 'row', key: `${s.key}-${i}`, emojis: s.emojis.slice(i, i + columns).map(e => e.emoji), section: s.key })
  }
  return rows
}

function offsetsFor(rows: Row[]): number[] {
  const offsets: number[] = []; let y = 0
  for (const r of rows) { offsets.push(y); y += r.type === 'header' ? HEADER : CELL }
  return offsets
}

function EmojiCell({ emoji, onPress }: { emoji: string; onPress: (emoji: string) => void }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`} onPress={() => onPress(emoji)}
    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: pressed || hovered ? c.hover : 'transparent', transform: [{ scale: pressed ? 0.9 : 1 }] }, pointer]}>
    <Text allowFontScaling={false} style={{ fontSize: 28, lineHeight: 36 }}>{emoji}</Text>
  </Pressable>
}

export type PanelTab = 'emoji' | 'stickers'
/** Sending a sticker from the panel (the composer gives this only where files may be sent). */
export type StickerSend = (file: PickedFile) => Promise<void>

/**
 * WhatsApp-style emoji keyboard: a bottom bar with search, the Emoji | Stickers tabs and backspace; the Emoji tab has
 * the category bar on top, recents first and a scrolling grid with section titles; the Stickers tab has Favourites and
 * the built-in JM pack (U-028). It takes the keyboard's place at the keyboard's height; the composer owns showing/hiding
 * it and the keyboard. The Stickers tab is shown only when `onSticker` is given.
 */
export function EmojiPanel({ height, tab, onTab, onEmoji, onBackspace, onSearch, onSticker }: { height: number; tab: PanelTab; onTab: (tab: PanelTab) => void; onEmoji: (emoji: string) => void; onBackspace: () => void; onSearch: () => void; onSticker?: StickerSend }) {
  const c = useColors()
  const bar = 44
  const showing = onSticker ? tab : 'emoji'
  const tabs: { key: PanelTab; label: string }[] = onSticker ? [{ key: 'emoji', label: 'Emoji' }, { key: 'stickers', label: 'Stickers' }] : [{ key: 'emoji', label: 'Emoji' }]
  return <View accessibilityLabel={showing === 'emoji' ? 'Emoji picker' : 'Sticker picker'} style={{ height, backgroundColor: c.panel, borderTopWidth: 1, borderColor: c.border }}>
    {showing === 'stickers' && onSticker ? <StickerGrid onSticker={onSticker} /> : <EmojiGrid onEmoji={onEmoji} />}
    <View style={{ height: bar, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderTopWidth: 1, borderColor: c.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={showing === 'emoji' ? 'Search emoji' : 'Search stickers'} onPress={onSearch} hitSlop={4} style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, pointer]}><Icon name="search" size={20} color={c.muted} /></Pressable>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4 }}>{tabs.map(t => { const on = t.key === showing
        return <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: on }} aria-selected={on} onPress={() => onTab(t.key)} style={[{ height: 28, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center', backgroundColor: on ? c.neutral : 'transparent' }, pointer]}>
          <Text style={{ color: on ? c.text : c.muted, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 13 }}>{t.label}</Text>
        </Pressable> })}</View>
      {showing === 'emoji'
        ? <Pressable accessibilityRole="button" accessibilityLabel="Backspace" onPress={onBackspace} onLongPress={onBackspace} hitSlop={4} style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, pointer]}><Icon name="backspace" size={22} color={c.muted} /></Pressable>
        : <View style={{ width: 40 }} />}
    </View>
  </View>
}

function EmojiGrid({ onEmoji }: { onEmoji: (emoji: string) => void }) {
  const c = useColors(); const { width } = useWindowDimensions()
  const recents = useRecents()
  const columns = Math.max(6, Math.floor((Math.min(width, 640) - 16) / CELL))
  const sections = useMemo(() => [{ key: 'recent' as const, label: 'Recent', emojis: recents.map(emoji => ({ emoji, name: '' })) }, ...emojiSections()], [recents])
  const rows = useMemo(() => rowsFor(sections, columns), [sections, columns])
  const offsets = useMemo(() => offsetsFor(rows), [rows])
  const list = useRef<FlatList<Row>>(null)
  const [active, setActive] = useState<string>(recents.length ? 'recent' : 'smileys')
  // RN-web FlatList rejects a changing onViewableItemsChanged, so keep one handler.
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: { isViewable: boolean; item: Row }[] }) => { const first = viewableItems.find(v => v.isViewable)?.item; if (first) setActive(first.section) })
  const pick = (emoji: string) => { rememberEmoji(emoji); onEmoji(emoji) }
  const jump = (key: string) => { const index = rows.findIndex(r => r.type === 'header' && r.section === key); if (index >= 0) { setActive(key); list.current?.scrollToOffset({ offset: offsets[index], animated: false }) } }
  return <>
    <View accessibilityRole="tablist" style={{ height: 44, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, borderBottomWidth: 1, borderColor: c.border }}>
      {sections.filter(s => s.emojis.length).map(s => { const on = s.key === active
        return <Pressable key={s.key} accessibilityRole="tab" accessibilityLabel={s.label} accessibilityState={{ selected: on }} aria-selected={on} onPress={() => jump(s.key)} style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderColor: on ? c.brand : 'transparent' }, pointer]}>
          <Text allowFontScaling={false} style={{ fontSize: 18, lineHeight: 24, opacity: on ? 1 : 0.45 }}>{glyphs[s.key]}</Text>
        </Pressable> })}
    </View>
    <FlatList ref={list} data={rows} keyExtractor={r => r.key} keyboardShouldPersistTaps="always" initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7} removeClippedSubviews={Platform.OS === 'android'}
      getItemLayout={(_d, index) => ({ length: rows[index].type === 'header' ? HEADER : CELL, offset: offsets[index], index })}
      onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
      renderItem={({ item }) => item.type === 'header'
        ? <Text accessibilityRole="header" style={{ height: HEADER, paddingTop: 10, paddingHorizontal: 4, color: c.muted, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, lineHeight: 16 }}>{item.label}</Text>
        : <View style={{ flexDirection: 'row' }}>{item.emojis.map(e => <EmojiCell key={e} emoji={e} onPress={pick} />)}{Array.from({ length: columns - item.emojis.length }, (_, i) => <View key={'pad' + i} style={{ flex: 1 }} />)}</View>} />
  </>
}

/** Sends one sticker at a time and reports a failure in the panel (the outbox reports later failures in the chat). */
function useStickerSend(onSticker: StickerSend) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const send = async (file: () => Promise<PickedFile>) => {
    if (busy) return
    setBusy(true); setError('')
    try { await onSticker(await file()) } catch (e) { setError(e instanceof Error && e.message ? e.message : 'The sticker could not be sent.') } finally { setBusy(false) }
  }
  return { busy, error, send }
}

function StickerCell({ label, source, size, onPress, onLongPress, disabled, removing, onRemove }: { label: string; source: ImageSourcePropType; size: number; onPress: () => void; onLongPress?: () => void; disabled?: boolean; removing?: boolean; onRemove?: () => void }) {
  const c = useColors()
  return <View style={{ width: size, height: size, padding: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Send sticker ${label}`} accessibilityHint={onLongPress ? 'Hold to remove from favourites' : undefined} disabled={disabled} onPress={onPress} onLongPress={onLongPress} delayLongPress={400}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed || hovered ? c.hover : 'transparent', transform: [{ scale: pressed ? 0.92 : 1 }] }, pointer]}>
      <Image accessible={false} source={source} resizeMode="contain" style={{ width: size - 16, height: size - 16 }} />
    </Pressable>
    {removing && onRemove && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label} from favourites`} onPress={onRemove} style={[{ position: 'absolute', top: 2, right: 2, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dangerFill }, pointer]}><Icon name="trash2" size={15} color="#ffffff" /></Pressable>}
  </View>
}

function useFavourites() {
  return useSyncExternalStore(favouriteStickers.subscribe, favouriteStickers.snapshot, favouriteStickers.snapshot)
}

/** Stickers tab: Favourites (starred on this device) and the JM pack, with a section bar like WhatsApp's. */
function StickerGrid({ onSticker }: { onSticker: StickerSend }) {
  const c = useColors(); const { width } = useWindowDimensions()
  const favourites = useFavourites()
  const { busy, error, send } = useStickerSend(onSticker)
  const [removing, setRemoving] = useState<string | null>(null)
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null); const packY = useRef(0)
  const columns = Math.max(4, Math.floor((Math.min(width, 640) - 16) / 88))
  const cell = Math.floor((Math.min(width, 640) - 16) / columns)
  const title = (text: string) => <Text accessibilityRole="header" style={{ paddingTop: 10, paddingBottom: 4, paddingHorizontal: 4, color: c.muted, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, lineHeight: 16 }}>{text}</Text>
  const jump = (target: 'favourites' | 'pack') => scroll.current?.scrollTo({ y: target === 'pack' ? packY.current : 0, animated: false })
  return <>
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 4, borderBottomWidth: 1, borderColor: c.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Favourite stickers" onPress={() => jump('favourites')} style={[{ width: 52, alignItems: 'center', justifyContent: 'center' }, pointer]}><Icon name="star" size={20} color={c.muted} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="JM stickers" onPress={() => jump('pack')} style={[{ width: 52, alignItems: 'center', justifyContent: 'center' }, pointer]}><Image accessible={false} source={jmPack[1].image} style={{ width: 26, height: 26 }} /></Pressable>
    </View>
    {!!error && <Text role="alert" style={{ paddingHorizontal: 12, paddingTop: 6, color: c.danger, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{error}</Text>}
    <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }} keyboardShouldPersistTaps="always" onScrollBeginDrag={() => setRemoving(null)}>
      {title('Favourites')}
      {favourites.list.length
        ? <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{favourites.list.map((f, i) => <StickerCell key={f.id} label={`favourite ${i + 1}`} source={{ uri: f.uri }} size={cell} disabled={busy}
            onPress={() => { if (removing) { setRemoving(null); return } void send(async () => favouriteFile(f)) }} onLongPress={() => setRemoving(f.id)} removing={removing === f.id} onRemove={() => { setRemoving(null); void favouriteStickers.remove(f.id) }} />)}</View>
        : <Text style={{ paddingHorizontal: 4, paddingBottom: 6, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }}>{favourites.loaded ? 'Hold a sticker or photo in a chat and choose "Add to stickers" to keep it here.' : 'Loading…'}</Text>}
      <View onLayout={e => { packY.current = e.nativeEvent.layout.y }}>{title('JM stickers')}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{jmPack.map(s => <StickerCell key={s.id} label={s.label} source={s.image} size={cell} disabled={busy} onPress={() => void send(() => packStickerFile(s))} />)}</View>
    </ScrollView>
  </>
}

/** Sticker search (WhatsApp): a field and one row of matching JM stickers above the keyboard. */
export function StickerSearch({ onSticker, onClose }: { onSticker: StickerSend; onClose: () => void }) {
  const c = useColors(); const [query, setQuery] = useState('')
  const hits = useMemo(() => searchPack(jmPack, query), [query])
  const { busy, error, send } = useStickerSend(onSticker)
  return <View accessibilityLabel="Sticker search" style={{ backgroundColor: c.panel, borderTopWidth: 1, borderColor: c.border }}>
    {!!error && <Text role="alert" style={{ paddingHorizontal: 12, paddingTop: 6, color: c.danger, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{error}</Text>}
    <FlatList horizontal data={hits} keyExtractor={s => s.id} keyboardShouldPersistTaps="always" style={{ height: 76 }} contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'center' }}
      ListEmptyComponent={<Text style={{ paddingHorizontal: 8, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 13 }}>No stickers found</Text>}
      renderItem={({ item }) => <StickerCell label={item.label} source={item.image} size={72} disabled={busy} onPress={() => void send(() => packStickerFile(item))} />} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingBottom: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to stickers" onPress={onClose} hitSlop={4} style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, pointer]}><Icon name="back" size={20} color={c.muted} /></Pressable>
      <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search stickers" placeholderTextColor={c.muted} accessibilityLabel="Search stickers" autoCorrect={false} autoCapitalize="none" returnKeyType="search"
        style={{ flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: c.neutral, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) }} />
    </View>
  </View>
}

/** Search mode (WhatsApp): a field and one row of matches sit above the keyboard while typing the search. */
export function EmojiSearch({ onEmoji, onClose }: { onEmoji: (emoji: string) => void; onClose: () => void }) {
  const c = useColors(); const [query, setQuery] = useState('')
  const hits = useMemo(() => searchEmoji(query, 60), [query])
  return <View accessibilityLabel="Emoji search" style={{ backgroundColor: c.panel, borderTopWidth: 1, borderColor: c.border }}>
    <FlatList horizontal data={hits} keyExtractor={e => e.emoji} keyboardShouldPersistTaps="always" style={{ height: CELL + 4 }} contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'center' }}
      ListEmptyComponent={<Text style={{ paddingHorizontal: 8, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 13 }}>{query.trim() ? 'No emoji found' : 'Type to search emoji'}</Text>}
      renderItem={({ item }) => <View style={{ width: CELL }}><EmojiCell emoji={item.emoji} onPress={emoji => { rememberEmoji(emoji); onEmoji(emoji) }} /></View>} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingBottom: 4 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to emoji" onPress={onClose} hitSlop={4} style={[{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, pointer]}><Icon name="back" size={20} color={c.muted} /></Pressable>
      <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search emoji" placeholderTextColor={c.muted} accessibilityLabel="Search emoji" autoCorrect={false} autoCapitalize="none" returnKeyType="search"
        style={{ flex: 1, height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: c.neutral, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) }} />
    </View>
  </View>
}
