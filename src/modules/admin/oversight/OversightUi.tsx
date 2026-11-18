import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Icon, IconButton, type IconName } from '../../../components/Icon'
import { useColors } from '../../../ui'

export function OversightHeading({ title, detail, onBack }: { title: string; detail?: string; onBack?: () => void }) {
 const c = useColors()
 return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
  {onBack && <IconButton name="back" label="Back to Oversight" onPress={onBack} />}
  <View style={{ flex: 1, minWidth: 0 }}><Text accessibilityRole="header" style={{ fontFamily: 'Inter_600SemiBold', fontSize: 22, lineHeight: 29, color: c.text }}>{title}</Text>{detail && <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, color: c.muted, marginTop: 4 }}>{detail}</Text>}</View>
 </View>
}
export function OversightRow({ title, detail, icon = 'messagesSquare', leading, children, onPress, disabled = false }: { title: string; detail?: string; icon?: IconName; leading?: ReactNode; children?: ReactNode; onPress?: () => void; disabled?: boolean }) {
 const c = useColors()
 return <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled || !onPress} onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.hover : 'transparent', opacity: disabled ? 0.5 : 1 })}>
  {leading ?? <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={21} color={c.brand} /></View>}
  <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text numberOfLines={2} style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, lineHeight: 22, color: c.text }}>{title}</Text>{!!detail && <Text numberOfLines={3} style={{ fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: c.muted }}>{detail}</Text>}{children}</View>
  {onPress && <Icon name="chevronRight" size={18} color={c.muted} />}
 </Pressable>
}
export function OversightHint({ children }: { children: ReactNode }) {
 const c = useColors()
 return <Text style={{ color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 }}>{children}</Text>
}
