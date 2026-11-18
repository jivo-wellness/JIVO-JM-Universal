import { useCallback, useEffect, useState } from 'react'
import { Linking, Platform, Pressable, Switch, Text, View } from 'react-native'
import { useSession } from '../core/auth/Session'
import { errorMessage } from '../core/api/client'
import { useResource } from '../shared/useResource'
import { listTools, saveTool, hideTool, reorderTools, type SoftwareTool, type ToolInput } from '../modules/tools/api'
import { safeToolLink, toolInitials } from '../modules/tools/links'
import { canManageTools, movedIds, toolProblem } from '../modules/tools/manage'
import { Button, Card, EmptyState, Field, Label, Spinner, useColors } from '../ui'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
const empty: ToolInput = { name: '', description: '', web_url: '', app_url: '', position: 0, is_active: true }
const fieldStyle = { fontSize: 16, minHeight: 52, paddingLeft: 16, paddingRight: 16, paddingStart: 16, paddingEnd: 16, paddingVertical: 12 }
/**
 * The one Tools screen (reference /tools). Everyone with Messenger opens the tools; people holding ADMIN_TOOLS_MANAGE (the
 * backend's gate on /api/jm/admin/tools/, org/tools.py) also add, edit, order, hide and show them here. Only they read the
 * admin list (hidden tools included, dimmed with a "Hidden" badge) or call an admin endpoint. Hiding keeps the record:
 * the server never deletes a tool.
 */
export function SoftwareTools() {
  const c = useColors(); const { me } = useSession()
  const caps = me?.capabilities ?? []
  const manage = canManageTools(caps)
  const allowed = manage || caps.includes('JM_ACCESS')
  const load = useCallback(() => allowed ? listTools(manage) : Promise.resolve([]), [allowed, manage]); const resource = useResource(load)
  const [editor, setEditor] = useState<{ id: string | null; data: ToolInput } | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  useEffect(() => { const timer = setInterval(resource.refresh, 30000); return () => clearInterval(timer) }, [resource.refresh])
  if (!allowed) return <Label>You do not have access to this page.</Label>
  const list = resource.value ?? []
  async function open(tool: SoftwareTool) {
    setError('')
    try {
      if (!safeToolLink(tool.web_url)) throw Error('This website link is invalid. Ask your administrator to update it.')
      if (Platform.OS === 'web') { window.open(tool.web_url, '_blank', 'noopener,noreferrer'); return }
      if (tool.app_url && safeToolLink(tool.app_url, true)) { try { await Linking.openURL(tool.app_url); return } catch { /* Fall back to the website when the app is not installed. */ } }
      await Linking.openURL(tool.web_url)
    } catch (e) { setError(errorMessage(e)) }
  }
  /** One management request at a time; the list reloads afterwards either way. */
  async function act(run: () => Promise<unknown>) {
    if (busy) return
    setBusy(true); setError('')
    try { await run() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false); resource.refresh() }
  }
  async function save() {
    if (!editor || busy) return
    const data = { ...editor.data, name: editor.data.name.trim(), description: editor.data.description.trim(), web_url: editor.data.web_url.trim(), app_url: editor.data.app_url.trim() }
    const problem = toolProblem(data); if (problem) { setError(problem); return }
    setBusy(true); setError('')
    try { await saveTool(editor.id, data); setEditor(null); resource.refresh() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  // The whole new order in one request: the server sets every position in one transaction (all or nothing).
  const move = (from: number, to: number) => void act(() => reorderTools(movedIds(list.map(t => t.id), from, to)))
  return <View style={{ gap: 16 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label large>JIVO tools</Label>{manage && <Button title="Add tool" onPress={() => { setError(''); setEditor({ id: null, data: { ...empty, position: (list.at(-1)?.position ?? 0) + 10 } }) }} />}</View>
    <Text style={{ color: c.muted, fontSize: 14 }}>{manage ? 'Open your other JIVO apps and websites, and manage the tools your team sees.' : 'Open your other JIVO apps and websites.'}</Text>
    {!!(error || resource.error) && !editor && <Label>{error || errorMessage(resource.error)}</Label>}
    {resource.loading && !resource.value && <Spinner label="Loading tools" />}
    {resource.value?.length === 0 && <EmptyState title="No tools added yet" description={manage ? 'Add HO, JI or another software using its real link.' : 'Your administrator can add software here.'} />}
    {list.map((tool, index) => <Card key={tool.id} style={!tool.is_active ? { opacity: 0.6 } : undefined}><Pressable accessibilityRole="button" accessibilityLabel={`Open ${tool.name}`} disabled={!safeToolLink(tool.web_url)} accessibilityState={{ disabled: !safeToolLink(tool.web_url) }} onPress={() => void open(tool)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.successSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.brand, fontSize: 18, fontWeight: '700' }}>{toolInitials(tool.name)}</Text></View><View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><Text style={{ color: c.text, fontSize: 17, fontWeight: '600' }}>{tool.name}</Text>{!tool.is_active && <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: c.hover }}><Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>Hidden</Text></View>}</View>{!!tool.description && <Text style={{ color: c.muted, fontSize: 14 }}>{tool.description}</Text>}{!safeToolLink(tool.web_url) && <Text style={{ color: c.danger, fontSize: 12 }}>This website link is invalid. Ask your administrator to update it.</Text>}</View>{safeToolLink(tool.web_url) && <Icon name="externalLink" color={c.muted} size={20} />}</Pressable>
      {manage && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Button title="Up" accessibilityLabel={`Move ${tool.name} up`} size="sm" variant="ghost" disabled={busy || index === 0} onPress={() => move(index, index - 1)} />
        <Button title="Down" accessibilityLabel={`Move ${tool.name} down`} size="sm" variant="ghost" disabled={busy || index === list.length - 1} onPress={() => move(index, index + 1)} />
        <Button title="Edit" accessibilityLabel={`Edit ${tool.name}`} size="sm" variant="secondary" onPress={() => { setError(''); setEditor({ id: tool.id, data: { name: tool.name, description: tool.description, web_url: tool.web_url, app_url: tool.app_url, position: tool.position, is_active: tool.is_active } }) }} />
        {tool.is_active
          ? <Button title="Hide" accessibilityLabel={`Hide ${tool.name}`} size="sm" variant="ghost" disabled={busy} onPress={() => void act(() => hideTool(tool.id))} />
          : <Button title="Show" accessibilityLabel={`Show ${tool.name}`} size="sm" variant="ghost" disabled={busy} onPress={() => void act(() => saveTool(tool.id, { is_active: true }))} />}
      </View>}
    </Card>)}
    {manage && <Sheet bottomAligned visible={!!editor} onClose={() => { if (!busy) setEditor(null) }} title={editor?.id ? 'Edit tool' : 'Add tool'} footer={<View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}><Button title="Cancel" variant="secondary" disabled={busy} onPress={() => setEditor(null)} /><Button title="Save" loading={busy} disabled={busy || !editor?.data.name.trim() || !editor?.data.web_url.trim()} onPress={() => void save()} /></View>}>{editor && <>
      {(['name', 'description', 'web_url', 'app_url'] as const).map(key => <Field inset style={fieldStyle} key={key} label={{ name: 'Tool name', description: 'Description', web_url: 'Website URL (HTTPS)', app_url: 'App link (optional)' }[key]} autoCapitalize={key.endsWith('url') ? 'none' : 'sentences'} autoCorrect={!key.endsWith('url')} value={editor.data[key]} onChangeText={value => setEditor({ ...editor, data: { ...editor.data, [key]: value } })} />)}
      <Field inset style={fieldStyle} label="Display order" keyboardType="number-pad" value={String(editor.data.position)} onChangeText={value => { if (/^\d{0,5}$/.test(value)) setEditor({ ...editor, data: { ...editor.data, position: Number(value) } }) }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Label>Visible to users</Label><Switch accessibilityLabel="Visible to users" value={editor.data.is_active} onValueChange={value => setEditor({ ...editor, data: { ...editor.data, is_active: value } })} /></View>
      {!!error && <Label>{error}</Label>}
    </>}</Sheet>}
  </View>
}
