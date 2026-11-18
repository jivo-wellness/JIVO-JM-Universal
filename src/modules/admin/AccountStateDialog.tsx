import { useState } from 'react'
import { View } from 'react-native'
import { useSession } from '../../core/auth/Session'
import { errorMessage } from '../../core/api/client'
import { Sheet } from '../../components/Sheet'
import { EventDateTime } from '../../components/EventDateTime'
import { Button, Field, Label } from '../../ui'
import * as api from './api'

export type StateAction = 'freeze' | 'unfreeze' | 'block' | 'unblock'
export function AccountStateDialog({ user, action, onClose, onDone }: { user: api.AdminUser; action: StateAction; onClose: () => void; onDone: () => void }) {
  const { me } = useSession(); const [reason,setReason] = useState(''); const [date,setDate] = useState(''); const [time,setTime] = useState('23:59'); const [busy,setBusy] = useState(false); const [error,setError] = useState('')
  const freezing = action === 'freeze' || action === 'unfreeze'
  const allowed = !!me?.capabilities.includes(freezing ? 'ADMIN_USER_FREEZE' : 'ADMIN_USER_BLOCK') && user.can?.[freezing ? 'freeze' : 'block'] !== false && me.id !== user.id
  const required = action === 'freeze' || action === 'block'
  const title = { freeze: 'Freeze account', unfreeze: 'Unfreeze account', block: 'Block messaging', unblock: 'Unblock messaging' }[action]
  async function save() {
    if (!allowed || busy || required && !reason.trim()) return
    setBusy(true); setError('')
    try {
      const until = date ? new Date(`${date}T${time}:00`) : null
      if (action === 'freeze' && until && (!Number.isFinite(until.getTime()) || until.getTime() <= Date.now())) throw Error('Choose a future end time.')
      if (action === 'freeze') await api.freezeUser(user.id,{reason:reason.trim(),until:until?.toISOString() ?? null})
      else if (action === 'unfreeze') await api.unfreezeUser(user.id,reason.trim())
      else if (action === 'block') await api.blockUser(user.id,reason.trim())
      else await api.unblockUser(user.id,reason.trim())
      onDone(); onClose()
    } catch(e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  return <Sheet visible title={`${title}: ${user.name}`} onClose={() => { if (!busy) onClose() }} footer={<View style={{flexDirection:'row',justifyContent:'flex-end',gap:8}}><Button title="Cancel" variant="secondary" disabled={busy} onPress={onClose} /><Button title={title} variant={required ? 'danger' : 'primary'} disabled={busy || !allowed || required && !reason.trim()} onPress={() => void save()} /></View>}>
    <Label>{freezing ? 'A frozen account cannot sign in, and its sessions are ended.' : 'A blocked account can sign in and read, but cannot send, react, create, upload or share.'}</Label>
    <Field label={required ? 'Reason' : 'Reason (optional)'} value={reason} onChangeText={setReason} multiline maxLength={300} />
    <Label>Recorded in the audit log.</Label>
    {action === 'freeze' && <><EventDateTime label="Until (optional)" type="date" value={date} onChange={setDate} />{!!date && <EventDateTime label="Time" type="time" value={time} onChange={setTime} />}<Label>Leave empty to keep it frozen until someone unfreezes it.</Label></>}
    {!!error && <Label>{error}</Label>}
  </Sheet>
}
