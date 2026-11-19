import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import { errorMessage } from '../../core/api/client'
import { Icon } from '../../components/Icon'
import { TicketText } from './TicketUi'
import { Sheet } from '../../components/Sheet'
import { Button, Label, useColors } from '../../ui'
import { pickDocument } from '../messenger/media/picker'
import type { PickedFile } from '../messenger/media/model'
import { attachmentExportNotice, cancelAttachmentExports, saveAttachment, validateAttachmentExportSize } from '../messenger/media/export'
import { fetchTicketFile } from './api'
import { MAX_FILES, validateFiles, type TicketFile } from './model'
import { useTicketAction } from './useTicketAction'

const dispose = (file: PickedFile) => { void Promise.resolve().then(() => file.dispose?.()).catch(() => {}) }
export function useTicketFiles() {
  const [files, setFiles] = useState<PickedFile[]>([])
  const owned = useRef<PickedFile[]>([])
  const mounted = useRef(false)
  const picking = useRef(false)
  const [error, setError] = useState('')
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; owned.current.forEach(dispose); owned.current = [] } }, [])
  function clear() { owned.current.forEach(dispose); owned.current = []; setFiles([]) }
  async function add() {
    if (picking.current) return
    picking.current = true; setError('')
    let file: PickedFile | null = null
    try {
      file = await pickDocument()
      if (!file) return
      if (!mounted.current) { dispose(file); return }
      const next = [...owned.current, file]; validateFiles(next); owned.current = next; setFiles(next)
    } catch (e) { if (file) dispose(file); if (mounted.current) setError(errorMessage(e)) }
    finally { picking.current = false }
  }
  function remove(index: number) { const file = owned.current[index]; if (file) dispose(file); owned.current = owned.current.filter((_, i) => i !== index); setFiles(owned.current) }
  return { files, error, add, remove, clear }
}
export function FilePicker({ picker, disabled }: { picker: ReturnType<typeof useTicketFiles>; disabled: boolean }) {
  const c = useColors()
  return <View style={{ gap: 10 }}>
    {picker.files.map((file, index) => <View key={`${file.uri}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, backgroundColor: c.neutral, padding: 10 }}><Icon name="fileText" size={20} color={c.muted} /><View style={{ flex: 1 }}><TicketText strong>{file.name}</TicketText><TicketText muted small>{Math.ceil(file.size / 1024)} KB</TicketText></View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name}`} disabled={disabled} onPress={() => picker.remove(index)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}><Icon name="x" size={18} color={c.muted} /></Pressable></View>)}
    <Pressable accessibilityRole="button" accessibilityLabel="Add attachment" disabled={disabled || picker.files.length >= MAX_FILES} onPress={() => void picker.add()} style={({ pressed }) => ({ borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, borderRadius: 12, padding: 16, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? c.neutral : c.input, opacity: disabled || picker.files.length >= MAX_FILES ? 0.5 : 1 })}><Icon name="paperclip" size={22} color={c.brand} /><View style={{ flex: 1 }}><TicketText strong>Add attachment</TicketText><TicketText muted small>{picker.files.length}/6 files - up to 10 MiB each</TicketText></View><Icon name="plus" size={18} color={c.muted} /></Pressable>
    <TicketText muted small>Images, MP4/WebM, PDF, TXT, LOG or CSV.</TicketText>{!!picker.error && <Label>{picker.error}</Label>}
  </View>
}
export function TicketFiles({ code, files }: { code: string; files: TicketFile[] }) {
  const [selected, setSelected] = useState<TicketFile | null>(null)
  return <View style={{ gap: 8 }}>{files.map(file => <Button key={file.id} variant="secondary" title={`${file.name} · ${Math.ceil(file.size / 1024)} KB`} onPress={() => setSelected(file)} />)}{selected && <ExportFile key={selected.id} code={code} file={selected} close={() => setSelected(null)} />}</View>
}
function ExportFile({ code, file, close }: { code: string; file: TicketFile; close: () => void }) {
  const action = useTicketAction(); const [notice, setNotice] = useState('')
  useEffect(() => () => cancelAttachmentExports(), [])
  return <Sheet visible onClose={close}><Label large>Export attachment</Label><Label>{file.name}</Label><Label>{attachmentExportNotice}</Label>{!!action.error && <Label>{action.error}</Label>}{!!notice && <Label>{notice}</Label>}<Button title="Confirm attachment export" disabled={action.busy || !!notice} onPress={() => void action.run(async signal => { validateAttachmentExportSize(file.size); const blob = await fetchTicketFile(code, file.id, signal); signal.throwIfAborted(); validateAttachmentExportSize(blob.size); await saveAttachment(blob, file.name, () => !signal.aborted) }, () => setNotice('Export handoff finished. JM cannot confirm that the destination saved the file.'))} /><Button title="Close attachment export" variant="secondary" onPress={close} /></Sheet>
}
