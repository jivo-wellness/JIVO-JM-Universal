import { useState, type ReactNode } from 'react'
import { Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Select } from './TicketSelect'
import { Button, Card, Field, Label } from '../../ui'
import { SectionTitle, TicketHeading, TicketPage, TicketText } from './TicketUi'
import { raiseTicket } from './api'
import { priorities, type TicketPriority } from './model'
import { FilePicker, useTicketFiles } from './TicketFiles'
import { useTicketAction } from './useTicketAction'
export function ReportTicketScreen() {
  const router = useRouter(); const action = useTicketAction(); const picker = useTicketFiles()
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [page, setPage] = useState(''); const [priority, setPriority] = useState<TicketPriority>('medium')
  return <TicketPage maxWidth={760}>
    <Button title="Back to tickets" variant="ghost" disabled={action.busy} style={{ alignSelf: 'flex-start' }} onPress={() => router.replace('/tickets')} />
    <TicketHeading title="Report a bug" subtitle="A little detail helps us fix it faster." icon="plus" />
    <Card style={{ padding: 22, gap: 20 }}>
      <SectionTitle title="What went wrong?" detail="Give your issue a clear title and tell us how it happened." />
      <Field label="Title" placeholder="e.g. Photo won't send in a group chat" value={title} onChangeText={setTitle} maxLength={200} editable={!action.busy} />
      <Field label="Description" placeholder={'1. What were you doing?\n2. What happened?\n3. What did you expect?'} value={description} onChangeText={setDescription} multiline maxLength={10000} style={{ minHeight: 160 }} editable={!action.busy} />
      <Field label="Affected screen (optional)" placeholder="e.g. Messenger, Profile or Passwords" value={page} onChangeText={setPage} maxLength={300} editable={!action.busy} />
      <ViewDisabled disabled={action.busy}><Select label="Priority" value={priority} options={priorities} onChange={setPriority} /></ViewDisabled>
      <TicketText muted small>Choose High or Urgent if the issue blocks your work.</TicketText>
    </Card>
    <Card style={{ padding: 22, gap: 16 }}><SectionTitle title="Add evidence" detail="A screenshot or short recording can make all the difference." /><FilePicker picker={picker} disabled={action.busy} /></Card>
    {!!action.error && <Label>{action.error}</Label>}
    <Button title={action.busy ? 'Uploading and submitting...' : 'Submit ticket'} disabled={action.busy || !title.trim() || !description.trim()} onPress={() => void action.run(signal => raiseTicket({ title: title.trim(), description: description.trim(), priority, page_url: page.trim(), browser: ['JM app', Platform.OS, Platform.Version].filter(Boolean).join(' / ') }, picker.files, signal), ticket => { picker.clear(); router.replace({ pathname: '/tickets/[code]', params: { code: ticket.code } }) })} />
    <TicketText muted small>You can follow progress and add more details after submitting.</TicketText>
  </TicketPage>
}
export function ViewDisabled({ disabled, children }: { disabled: boolean; children: ReactNode }) { return <View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.5 : 1, zIndex: 2 }}>{children}</View> }
