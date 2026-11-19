import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useColors } from '../../ui'
import type { Chart } from './chart'
const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7']
export function AtlasChart({ chart }: { chart: Chart }) {
  const c = useColors(); const [table, setTable] = useState(false)
  const values = chart.series.flatMap(s => s.values), min = Math.min(0, ...values), max = Math.max(0, ...values) || 1
  const y = (n: number) => 190 - (n - min) / (max - min || 1) * 170
  const slot = 560 / chart.labels.length, x = (i: number) => 65 + slot * (i + .5)
  return <View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, gap: 10 }}>
    <Text style={{ color: c.text, fontWeight: '600' }}>{chart.title}</Text>
    <ScrollView horizontal><View accessibilityLabel={chart.title} style={{ width: 650, height: 240 }}>
      {[0, 1, 2, 3, 4].map(i => { const n = min + (max - min) * i / 4; return <View key={i} style={{ position: 'absolute', top: y(n), left: 0, width: 625, borderTopWidth: 1, borderColor: c.border }}><Text style={{ color: c.muted, fontSize: 10, width: 58, textAlign: 'right' }}>{Number(n.toPrecision(3)).toLocaleString()}</Text></View> })}
      {chart.labels.map((label, i) => <Text key={i} numberOfLines={1} style={{ position: 'absolute', top: 208, left: x(i) - slot / 2, width: slot, color: c.muted, textAlign: 'center', fontSize: 10 }}>{label}</Text>)}
      {chart.series.map((series, si) => series.values.map((v, i) => {
        const label = `${chart.labels[i]}: ${series.name}: ${v} ${chart.unit || ''}`
        if (chart.type === 'bar') return <View key={`${si}:${i}`} accessibilityLabel={label} style={{ position: 'absolute', left: x(i) - slot * .35 + si * slot * .7 / chart.series.length, top: Math.min(y(v), y(0)), width: slot * .65 / chart.series.length, height: Math.max(1, Math.abs(y(v) - y(0))), borderRadius: 2, backgroundColor: colors[si] }} />
        const dx = slot, dy = i ? y(v) - y(series.values[i - 1]) : 0
        return <View key={`${si}:${i}`}><View accessibilityLabel={label} style={{ position: 'absolute', left: x(i) - 3, top: y(v) - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: colors[si] }} />{i > 0 && <View style={{ position: 'absolute', left: x(i - 1), top: y(series.values[i - 1]), width: Math.hypot(dx, dy), height: 2, backgroundColor: colors[si], transformOrigin: 'left center', transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }} />}</View>
      }))}
    </View></ScrollView>
    {chart.series.map((s, i) => <Text key={i} style={{ color: colors[i], fontSize: 12 }}>{s.name}{chart.unit ? ` (${chart.unit})` : ''}</Text>)}
    <Pressable onPress={() => setTable(!table)} accessibilityState={{ expanded: table }}><Text style={{ color: c.brand }}>{table ? 'Hide chart data' : 'Show chart data'}</Text></Pressable>
    {table && <ScrollView horizontal><View>{[['Category', ...chart.series.map(s => s.name)], ...chart.labels.map((l, i) => [l, ...chart.series.map(s => String(s.values[i]))])].map((row, i) => <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border }}>{row.map((cell, j) => <Text key={j} style={{ width: 140, padding: 8, color: c.text }}>{cell}</Text>)}</View>)}</View></ScrollView>}
  </View>
}
