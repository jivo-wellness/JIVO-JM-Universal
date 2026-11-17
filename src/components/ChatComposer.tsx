import { MicButton, RecordingBar, VoiceNotice, VoiceReview, useVoiceMessage } from './VoiceRecorder'
import { AttachMenu, type AttachActions } from './attach/AttachMenu'
import type { PickedFile } from '../modules/messenger/media/model'
import { enterSends } from '../modules/messenger/composer'
import { deleteBackward, insertAt } from '../modules/messenger/lib/emoji'
import { BackHandler, Image, Keyboard, Platform, Pressable, TextInput, View, useWindowDimensions, type TextInputProps } from 'react-native'
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react'
import { Field, useColors } from '../ui'
import { touchBox } from '../shared/shellLayout'
import { panelHeight } from '../shared/keyboardInset'
import { lastKeyboardHeight, useKeyboardInset } from '../shared/useKeyboardInset'
import { Icon } from './Icon'
import { EmojiPanel, EmojiSearch, StickerSearch, type PanelTab, type StickerSend } from './EmojiPanel'

const web = Platform.OS === 'web'
const send = require('../../assets/icons/SendHorizontal.png')
/** Reference Composer: Enter sends (Shift+Enter adds a line) unless the pointer is coarse (touch keyboards keep Enter as newline). */
const coarsePointer = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches

/** Reference Composer: 40px round + / mic / send buttons around a 40px, 20px-radius message box. */
function RoundButton({ label, onPress, disabled = false, primary = false, active = false, expanded, children }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean; active?: boolean; expanded?: boolean; children: ReactNode }) {
  const c = useColors(); const { width } = useWindowDimensions()
  // DEF-005: the Pressable is the 44px phone hit box; the 40px circle inside keeps the reference look.
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded }} disabled={disabled} onPress={onPress} hitSlop={4} style={{ ...touchBox(40, width), flexShrink: 0 }}>
    {({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: primary ? (pressed || hovered ? c.primaryHover : c.primary) : pressed || hovered ? c.hover : 'transparent', opacity: disabled ? 0.5 : 1, transform: active ? [{ rotate: '45deg' }] : [] }}>{children}</View>}
  </Pressable>
}

type Panel = 'none' | 'emoji' | 'search' | 'sticker-search'

/**
 * Presentation only: callers retain drafts, mentions, uploads, permissions and send durability.
 *
 * WhatsApp layout: a rounded message pill (emoji left; attach and camera right) beside one round button that is the
 * microphone while nothing is typed and Send otherwise. The composer keeps itself (and so the chat above it) directly
 * over the on-screen keyboard, and the emoji panel (Emoji | Stickers) takes the keyboard's place at the same height.
 */
export function ChatComposer({ inputProps, onSend, sendLabel = 'Send message', sendDisabled, disabled = false, onTools, attach, onVoice, onSticker }: {
  inputProps: TextInputProps
  onSend: () => void
  sendLabel?: string
  sendDisabled: boolean
  disabled?: boolean
  /** The + button (attach and message tools); omitted while editing, as in the reference. Ignored when `attach` is given. */
  onTools?: () => void
  /** Reference AttachMenu: when given, + opens Document / Photos & videos / Camera / Location / Contact / Poll / Event. */
  attach?: AttachActions
  /** When given, the microphone replaces Send while nothing is typed or attached. */
  onVoice?: (file: PickedFile) => Promise<void>
  /** When given, the emoji panel has a Stickers tab; a tapped sticker is sent at once (WhatsApp). */
  onSticker?: StickerSend
}) {
  const c = useColors(); const { height: windowHeight } = useWindowDimensions()
  const plus = useRef<ComponentRef<typeof View>>(null); const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const caret = useRef<{ start: number; end: number } | null>(null)
  const input = useRef<ComponentRef<typeof TextInput>>(null)
  const root = useRef<ComponentRef<typeof View>>(null)
  const keyboard = useKeyboardInset(root)
  const [panel, setPanel] = useState<Panel>('none')
  const [tab, setTab] = useState<PanelTab>('emoji')
  // Switching emoji panel -> keyboard: hold the panel's space until the keyboard has opened, so the chat does not jump.
  const [awaitingKeyboard, setAwaitingKeyboard] = useState(false)
  const [height, setHeight] = useState(() => panelHeight(lastKeyboardHeight(), windowHeight))
  const voice = useVoiceMessage({ disabled, onSend: onVoice })
  const recording = voice.mode !== 'idle'
  const showMic = Boolean(onVoice) && sendDisabled
  const openAttach = () => plus.current?.measureInWindow((x: number, y: number) => setAnchor({ x, y }))

  if (keyboard > 0 && awaitingKeyboard) setAwaitingKeyboard(false)
  // A recording replaces the message box, so the emoji panel closes.
  if (recording && panel !== 'none') setPanel('none')
  useEffect(() => { if (!awaitingKeyboard) return; const timer = setTimeout(() => setAwaitingKeyboard(false), 700); return () => clearTimeout(timer) }, [awaitingKeyboard])
  // Android back closes the emoji panel first, as the keyboard would be closed first.
  useEffect(() => { if (panel !== 'emoji') return; const sub = BackHandler.addEventListener('hardwareBackPress', () => { setPanel('none'); return true }); return () => sub.remove() }, [panel])

  const showKeyboard = () => { setPanel('none'); setAwaitingKeyboard(!web); input.current?.focus() }
  const showEmoji = () => {
    setHeight(panelHeight(lastKeyboardHeight(), windowHeight))
    setPanel('emoji')
    // Phones: the panel takes the keyboard's place. A computer keeps the focus (and caret) in the box (reference).
    if (!web || coarsePointer()) { Keyboard.dismiss(); input.current?.blur() }
  }
  const edit = (next: { text: string; caret: number } | null) => {
    if (!next) return
    caret.current = { start: next.caret, end: next.caret }
    inputProps.onChangeText?.(next.text)
  }
  const currentCaret = () => { const text = inputProps.value ?? ''; const at = caret.current ?? inputProps.selection; return at ? { start: at.start, end: at.end ?? at.start } : { start: text.length, end: text.length } }
  const insertEmoji = (emoji: string) => { if (!disabled) edit(insertAt(inputProps.value ?? '', currentCaret(), emoji)) }
  const backspace = () => { if (!disabled) { const text = inputProps.value ?? ''; const next = deleteBackward(text, currentCaret()); if (next.text !== text) edit(next) } }

  // Space under the composer row: the emoji panel, or room for the keyboard.
  const below = panel === 'emoji' ? height : Math.max(keyboard, awaitingKeyboard ? height : 0)
  return <View ref={root} collapsable={false}>
    <VoiceNotice voice={voice} />
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8 }}>
      {voice.mode === 'review' ? <VoiceReview voice={voice} disabled={voice.busy} />
        : recording ? <RecordingBar voice={voice} />
          : <View ref={plus} collapsable={false} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 26, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 4, paddingVertical: 2, boxShadow: '0 1px 1px rgba(15, 23, 42, 0.06)' }}>
            <RoundButton label={panel === 'emoji' ? 'Show keyboard' : 'Emoji'} disabled={disabled} expanded={panel === 'emoji'} onPress={() => { if (panel === 'emoji') showKeyboard(); else showEmoji() }}><Icon name={panel === 'emoji' ? 'keyboard' : 'smile'} size={24} color={c.muted} /></RoundButton>
            <View style={{ flex: 1, minWidth: 0 }}><Field inset={false} {...inputProps} ref={input} onFocus={event => { if (panel !== 'none') { setPanel('none'); setAwaitingKeyboard(!web) } inputProps.onFocus?.(event) }} onSelectionChange={event => { caret.current = event.nativeEvent.selection; inputProps.onSelectionChange?.(event) }} onKeyPress={event => { inputProps.onKeyPress?.(event); if (!web) return; const key = event.nativeEvent as unknown as { key: string; shiftKey?: boolean; isComposing?: boolean }; if (!enterSends(key, coarsePointer())) return; (event as unknown as { preventDefault?: () => void }).preventDefault?.(); if (!disabled && !sendDisabled) onSend() }} compact label="Message" placeholder={inputProps.placeholder ?? 'Message'} multiline numberOfLines={web ? 1 : undefined} editable={!disabled && inputProps.editable !== false} style={[{ borderWidth: 0, borderRadius: 20, boxShadow: 'none', maxHeight: 132, minHeight: 40, paddingLeft: 6, paddingRight: 6, paddingTop: 10, paddingBottom: 10, fontSize: 16, lineHeight: 22, backgroundColor: 'transparent' }, inputProps.style]} /></View>
            {attach ? <View><RoundButton label="Attach" disabled={disabled} expanded={!!anchor} onPress={openAttach}><Icon name="paperclip" size={22} color={anchor ? c.brand : c.muted} /></RoundButton></View>
              : onTools && <RoundButton label="Message tools" disabled={disabled} onPress={onTools}><Icon name="paperclip" size={22} color={c.muted} /></RoundButton>}
            {attach && sendDisabled && <RoundButton label="Camera" disabled={disabled || !attach.canSendFile} onPress={attach.onCamera}><Icon name="camera" size={23} color={c.muted} /></RoundButton>}
          </View>}
      {voice.mode === 'review' || voice.mode === 'locked'
        ? <RoundButton label="Send voice message" primary disabled={disabled || voice.busy || (voice.mode === 'locked' && voice.phase !== 'recording')} onPress={() => void voice.send()}><Image accessible={false} source={send} style={{ width: 20, height: 20, tintColor: '#ffffff' }} /></RoundButton>
        : showMic || recording
          ? <MicButton voice={voice} disabled={disabled} />
          : <RoundButton label={sendLabel} primary disabled={disabled || sendDisabled} onPress={onSend}><Image accessible={false} source={send} style={{ width: 20, height: 20, tintColor: '#ffffff' }} /></RoundButton>}
    </View>
    {panel === 'emoji' && <EmojiPanel height={height} tab={tab} onTab={setTab} onEmoji={insertEmoji} onBackspace={backspace} onSearch={() => setPanel(tab === 'stickers' && onSticker ? 'sticker-search' : 'search')} onSticker={disabled ? undefined : onSticker} />}
    {panel === 'search' && <EmojiSearch onEmoji={insertEmoji} onClose={() => { Keyboard.dismiss(); setPanel('emoji') }} />}
    {panel === 'sticker-search' && onSticker && <StickerSearch onSticker={onSticker} onClose={() => { Keyboard.dismiss(); setPanel('emoji') }} />}
    {panel !== 'emoji' && below > 0 && <View style={{ height: below, backgroundColor: c.panel }} />}
    {attach && anchor && <AttachMenu anchor={anchor} actions={attach} onClose={() => setAnchor(null)} />}
  </View>
}

export type { AttachActions } from './attach/AttachMenu'
export { AttachMenu } from './attach/AttachMenu'
