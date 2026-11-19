import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Icon } from '../../components/Icon'
import { Sheet } from '../../components/Sheet'
import { Button, Label, useColors } from '../../ui'
/** A sheet keeps choices reachable above the native keyboard and inside narrow phone layouts. */
export function Select<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  const [open, setOpen] = useState(false); const c = useColors()
  return <><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={({ pressed }) => ({ minHeight: 64, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.neutral : c.input, flexDirection: 'row', alignItems: 'center', gap: 12 })}><View style={{ flex: 1, gap: 3 }}><Text style={{ fontSize: 12, lineHeight: 18, color: c.muted, fontFamily: 'Inter_400Regular' }}>{label}</Text><Text style={{ fontSize: 15, lineHeight: 22, color: c.text, fontFamily: 'Inter_500Medium' }}>{options.find(([key]) => key === value)?.[1] ?? value}</Text></View><Icon name="down" size={18} color={c.muted} /></Pressable>{open && <Sheet visible onClose={() => setOpen(false)}><Label large>{label}</Label>{options.map(([key, text]) => <Button key={key} title={text} variant={key === value ? 'primary' : 'secondary'} onPress={() => { setOpen(false); onChange(key) }} />)}<Button title={`Cancel ${label.toLowerCase()} selection`} variant="ghost" onPress={() => setOpen(false)} /></Sheet>}</>
}
