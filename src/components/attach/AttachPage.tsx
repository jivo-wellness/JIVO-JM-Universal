import { useEffect, type ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { glass, useColors } from '../../ui'
import { Icon, type IconName } from '../Icon'

const web = Platform.OS === 'web'
const pointer = (disabled = false) => (web ? ({ cursor: disabled ? 'not-allowed' : 'pointer' } as ViewStyle) : null)

/**
 * A full-screen page for one attach flow (WhatsApp style): a 56px header with Back and the title, an optional
 * search bar under it, the body, and an optional footer pinned above the keyboard / navigation bar.
 * It is a full-screen modal over the open chat, so the chat (draft, reply, scroll) is untouched underneath and
 * Android Back closes it. `onBack` is also what the header Back and Escape (web) do.
 */
export function AttachPage({ title, onBack, backLabel = 'Back', backIcon = 'back', backDisabled = false, right, search, below, footer, children, scroll = true, background, testID }: {
  title: string
  onBack: () => void
  backLabel?: string
  backIcon?: IconName
  backDisabled?: boolean
  right?: ReactNode
  search?: SearchBarProps
  /** Drawn under the header and search (tabs). */
  below?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  scroll?: boolean
  background?: string
  testID?: string
}) {
  const c = useColors(); const inset = useSafeAreaInsets()
  useEffect(() => {
    if (!web || typeof document === 'undefined') return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !backDisabled) { e.stopPropagation(); onBack() } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [onBack, backDisabled])
  return <Modal visible animationType="slide" onRequestClose={() => { if (!backDisabled) onBack() }} statusBarTranslucent navigationBarTranslucent>
    <KeyboardAvoidingView testID={testID} behavior={Platform.OS === 'ios' ? 'padding' : web ? undefined : 'height'} accessibilityViewIsModal role="dialog" aria-modal aria-label={title} style={{ flex: 1, backgroundColor: background ?? c.bg }}>
      <View style={[glass(c, 1), { paddingTop: inset.top, borderBottomWidth: 1 }]}>
        <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 }}>
          <HeaderButton icon={backIcon} label={backLabel} disabled={backDisabled} onPress={onBack} />
          <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, minWidth: 0, marginLeft: 4, color: c.text, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 17, lineHeight: 24 }}>{title}</Text>
          {right}
        </View>
        {search && <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}><SearchBar {...search} /></View>}
        {below}
      </View>
      {scroll
        ? <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: footer ? 16 : Math.max(16, inset.bottom + 16) }}>{children}</ScrollView>
        : <View style={{ flex: 1, minHeight: 0 }}>{children}</View>}
      {footer && <View style={[glass(c, 1), { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Math.max(12, inset.bottom + 8) }]}>{footer}</View>}
    </KeyboardAvoidingView>
  </Modal>
}

export function HeaderButton({ icon, label, onPress, disabled = false, color }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={4}
    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.45 : 1, backgroundColor: pressed || hovered ? c.hover : 'transparent' }, pointer(disabled)]}>
    <Icon name={icon} size={22} color={color ?? c.text} />
  </Pressable>
}

export type SearchBarProps = { value: string; onChangeText: (value: string) => void; placeholder: string; label: string; onSubmit?: () => void; autoFocus?: boolean }
/** Reference SearchInput: a pill with the magnifier, the field and a clear button. */
export function SearchBar({ value, onChangeText, placeholder, label, onSubmit, autoFocus }: SearchBarProps) {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingLeft: 14, paddingRight: 4 }}>
    <Icon name="search" size={18} color={c.muted} />
    <TextInput value={value} onChangeText={onChangeText} onSubmitEditing={onSubmit} returnKeyType="search" enterKeyHint="search" autoFocus={autoFocus} autoCorrect={false} placeholder={placeholder} placeholderTextColor={c.muted} accessibilityLabel={label} selectionColor={c.brand} cursorColor={c.brand} underlineColorAndroid="transparent"
      style={[{ flex: 1, minWidth: 0, height: 42, paddingVertical: 0, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15, includeFontPadding: false }, web ? ({ outlineStyle: 'none' } as object) : null]} />
    {!!value && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={6} style={[{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, pointer()]}><Icon name="x" size={16} color={c.muted} /></Pressable>}
  </View>
}

/** Small upper-case section heading (reference editor `h3`). */
export function SectionTitle({ children, icon }: { children: string; icon?: IconName }) {
  const c = useColors()
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
    {icon && <Icon name={icon} size={14} color={c.muted} />}
    <Text style={{ color: c.muted, fontFamily: 'Inter_600SemiBold', fontWeight: '600', fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>{children}</Text>
  </View>
}

/** Reference chip: an outlined pill, brand-tinted when selected. */
export function Chip({ label, selected = false, onPress, disabled = false, icon, accessibilityLabel }: { label: string; selected?: boolean; onPress: () => void; disabled?: boolean; icon?: IconName; accessibilityLabel?: string }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected, disabled }} aria-pressed={selected} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: selected ? c.brand : c.border, backgroundColor: selected ? c.successSoft : pressed ? c.hover : 'transparent', opacity: disabled ? 0.45 : 1 }, pointer(disabled)]}>
    {icon && <Icon name={icon} size={14} color={selected ? c.brand : c.text} />}
    <Text style={{ color: selected ? c.brand : c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 13 }}>{label}</Text>
  </Pressable>
}

/** Outlined tool button with an icon (reference editor `btn`). */
export function ToolButton({ label, icon, onPress, active = false, disabled = false, accessibilityLabel, style }: { label: string; icon?: IconName; onPress: () => void; active?: boolean; disabled?: boolean; accessibilityLabel?: string; style?: ViewStyle }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected: active, disabled }} aria-pressed={active} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: active ? c.brand : c.border, backgroundColor: pressed ? c.hover : 'transparent', opacity: disabled ? 0.45 : 1 }, pointer(disabled), style]}>
    {icon && <Icon name={icon} size={16} color={active ? c.brand : c.text} />}
    <Text numberOfLines={1} style={{ color: active ? c.brand : c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 13 }}>{label}</Text>
  </Pressable>
}

/** A list row with a round icon (location rows, contact rows). */
export function ListRow({ title, subtitle, onPress, leading, trailing, disabled = false, selected, accessibilityLabel, accessibilityHint }: { title: string; subtitle?: string; onPress: () => void; leading?: ReactNode; trailing?: ReactNode; disabled?: boolean; selected?: boolean; accessibilityLabel?: string; accessibilityHint?: string }) {
  const c = useColors()
  return <Pressable accessibilityRole={selected === undefined ? 'button' : 'checkbox'} accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')} accessibilityHint={accessibilityHint} accessibilityState={{ disabled, checked: selected }} aria-checked={selected} disabled={disabled} onPress={onPress}
    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: selected ? c.successSoft : pressed || hovered ? c.hover : 'transparent', opacity: disabled ? 0.55 : 1 }, pointer(disabled)]}>
    {leading}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 15, lineHeight: 21 }}>{title}</Text>
      {!!subtitle && <Text numberOfLines={2} style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }}>{subtitle}</Text>}
    </View>
    {trailing}
  </Pressable>
}

/** A round tinted icon for list rows. */
export function RoundIcon({ icon, color, background, size = 40 }: { icon: IconName; color: string; background: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: background, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={size / 2} color={color} /></View>
}

/** Reference form label (text-sm font-medium). */
export function FieldLabel({ children }: { children: string }) {
  const c = useColors()
  return <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14, lineHeight: 20, marginBottom: 6 }}>{children}</Text>
}
