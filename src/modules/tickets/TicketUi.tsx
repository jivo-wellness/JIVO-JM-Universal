import type { ReactNode } from 'react'
import { ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { Icon, type IconName } from '../../components/Icon'
import { useColors } from '../../ui'
import type { TicketPriority, TicketStatus } from './model'

export function TicketPage({ children, maxWidth = 1080 }: { children: ReactNode; maxWidth?: number }) {
  const { width } = useWindowDimensions()
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, padding: width >= 768 ? 32 : 16, paddingBottom: 32 }}><View style={{ width: '100%', maxWidth, alignSelf: 'center', gap: 20 }}>{children}</View></ScrollView>
}
export function TicketText({ children, muted = false, small = false, strong = false }: { children: ReactNode; muted?: boolean; small?: boolean; strong?: boolean }) {
  const c = useColors()
  return <Text style={{ color: muted ? c.muted : c.text, fontFamily: strong ? 'Inter_600SemiBold' : 'Inter_400Regular', fontSize: small ? 12 : 14, lineHeight: small ? 18 : 22, flexShrink: 1 }}>{children}</Text>
}
export function TicketHeading({ title, subtitle, icon = 'alertTriangle', action }: { title: string; subtitle: string; icon?: IconName; action?: ReactNode }) {
  const c = useColors(); const { width } = useWindowDimensions()
  return <View style={{ gap: 18, flexDirection: width >= 768 ? 'row' : 'column', alignItems: width >= 768 ? 'center' : 'stretch' }}><View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={23} color={c.brand} /></View><View style={{ flex: 1, gap: 3 }}><Text accessibilityRole="header" style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 26, lineHeight: 34, letterSpacing: -0.6 }}>{title}</Text><TicketText muted>{subtitle}</TicketText></View></View>{action}</View>
}
export function StatusBadge({ status, label }: { status: TicketStatus; label: string }) {
  const c = useColors()
  const tones = { open: [c.warningSoft, c.warning], in_progress: [c.infoSoft, c.info], resolved: [c.successSoft, c.success], closed: [c.neutral, c.muted] }
  const [backgroundColor, color] = tones[status]
  return <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} /><Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color }}>{label}</Text></View>
}
export function PriorityBadge({ priority, label }: { priority: TicketPriority; label: string }) {
  const c = useColors(); const color = priority === 'urgent' ? c.danger : priority === 'high' ? c.warning : c.muted
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="barChart3" size={13} color={color} /><Text style={{ fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18, color }}>{label} priority</Text></View>
}
export function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  const c = useColors()
  return <View style={{ gap: 4 }}><Text accessibilityRole="header" style={{ color: c.text, fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26 }}>{title}</Text>{!!detail && <TicketText muted>{detail}</TicketText>}</View>
}
export const shortDate = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
