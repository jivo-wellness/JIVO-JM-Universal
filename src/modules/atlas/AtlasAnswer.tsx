import { useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { setStringAsync } from 'expo-clipboard'
import { AtlasChart } from './AtlasChart'
import { parseChart } from './chart'
import { useColors } from '../../ui'

/** Render Atlas's text contract as native content, never executable HTML. */
export function AtlasAnswer({ text }: { text: string }) {
  const c = useColors()
  const parts = text.split(/(```[\s\S]*?```)/g)
  const [expanded, setExpanded] = useState(false)
  const [height, setHeight] = useState(0)
  return <View><View style={!expanded && height > 280 ? { maxHeight: 280, overflow: 'hidden' } : undefined}><View onLayout={e => setHeight(e.nativeEvent.layout.height)} style={{ gap: 8 }}>{parts.map((part, index) => {
    const code = /^```([^\n]*)\n([\s\S]*?)```$/.exec(part)
    if (code) return <Code key={index} language={code[1].trim()} value={code[2].trimEnd()} />
    return <View key={index} style={{ gap: 6 }}>{groupLines(part).map((line, i) => {
      if (/^\s*\|?\s*:?-{3,}/.test(line)) return null
      if (line.trim().startsWith('|')) return <ScrollView horizontal key={i}><View style={{ borderWidth: 1, borderColor: c.border, borderRadius: 8, overflow: 'hidden' }}>{line.split('\n').filter(row => !/^\s*\|?\s*:?-{3,}/.test(row)).map((row, ri) => <View key={ri} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border, backgroundColor: ri === 0 ? c.hover : 'transparent' }}>{row.trim().replace(/^\||\|$/g, '').split('|').map((cell, j) => <Text key={j} style={{ color: c.text, width: 150, padding: 10, fontSize: 14, fontWeight: ri === 0 ? '600' : '400' }}><Inline text={cell.trim()} /></Text>)}</View>)}</View></ScrollView>
      if (/^\s*---+\s*$/.test(line)) return <View key={i} style={{ height: 1, backgroundColor: c.border, marginVertical: 10 }} />
      const heading = /^(#{1,3})\s+(.*)$/.exec(line)
      const quote = /^>\s?/.test(line)
      return <Text key={i} selectable style={{ color: quote ? c.muted : c.text, fontSize: heading ? 20 - heading[1].length : 15, fontWeight: heading ? '600' : '400', lineHeight: 26, marginTop: heading ? 10 : 0, paddingLeft: quote ? 10 : 0, borderLeftWidth: quote ? 3 : 0, borderColor: c.brand }}><Inline text={heading ? heading[2] : line.replace(/^>\s?/, '').replace(/^\s*[-*]\s+/, '\u2022 ')} /></Text>
    })}</View>
  })}</View></View>{height > 280 && <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)}><Text style={{ color: c.brand, paddingVertical: 6 }}>{expanded ? 'Read less' : 'Read more'}</Text></Pressable>}</View>
}
function Inline({ text }: { text: string }) {
  const c = useColors()
  return <>{text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link) return <Text key={i} style={{ color: c.brand }} onPress={() => { if (/^(https?:|mailto:)/i.test(link[2])) void Linking.openURL(link[2]).catch(() => {}) }}>{link[1]}</Text>
    return <Text key={i} style={part.startsWith('**') ? { fontWeight: '700' } : part.startsWith('`') ? { fontFamily: 'monospace', backgroundColor: c.hover } : undefined}>{part.replace(/^\*\*|\*\*$|^`|`$/g, '')}</Text>
  })}</>
}
function Code({ language, value }: { language: string; value: string }) {
  const c = useColors(); const [copied, setCopied] = useState(false)
  if (language === 'atlas-chart') { const chart = parseChart(value); if (chart) return <AtlasChart chart={chart} /> }
  let metrics: { label: string; value: string; note?: string }[] | null = null
  if (language === 'atlas-metrics') {
    try {
      const data = JSON.parse(value)
      if (Array.isArray(data) && data.length > 0 && data.length <= 12 && data.every(m => m && typeof m.label === 'string' && typeof m.value === 'string' && (m.note === undefined || typeof m.note === 'string'))) metrics = data
    } catch { /* Invalid data stays visible as code. */ }
  }
  if (metrics) return <View style={{ gap: 10 }}>{metrics.map((m, i) => <View key={i} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 14 }}><Text style={{ color: c.muted }}>{m.label}</Text><Text style={{ color: c.text, fontSize: 24, fontWeight: '600', marginVertical: 8 }}>{m.value}</Text>{!!m.note && <Text style={{ color: c.muted }}>{m.note}</Text>}</View>)}</View>
  return <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, overflow: 'hidden' }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: c.hover }}><Text style={{ color: c.muted }}>{language || 'Code'}</Text><Pressable onPress={() => void setStringAsync(value).then(() => setCopied(true)).catch(() => setCopied(false))}><Text style={{ color: c.brand }}>{copied ? 'Copied' : 'Copy code'}</Text></Pressable></View><ScrollView horizontal><Text selectable style={{ color: c.text, padding: 12, fontFamily: 'monospace', fontSize: 13, lineHeight: 20 }}>{value}</Text></ScrollView></View>
}

function groupLines(text: string) {
  const blocks: string[] = []
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('|') && blocks.at(-1)?.trim().startsWith('|')) blocks[blocks.length - 1] += '\n' + line
    else blocks.push(line)
  }
  return blocks
}
