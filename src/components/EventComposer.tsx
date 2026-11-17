import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, Switch, Text, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import { createEvent, updateEvent, type EventData, type EventInput, type Message } from '../modules/messenger/api'
import { eventInput, initialEventForm, parseLocal } from '../modules/messenger/eventForm'
import { REMINDERS, isMeetingLink } from '../modules/messenger/lib/events'
import { eventPlaceText } from '../modules/messenger/location/format'
import { errorMessage } from '../core/api/client'
import { Button, Field, useColors } from '../ui'
import { Icon } from './Icon'
import { EventDateTime } from './EventDateTime'
import { LocationPicker } from './LocationPicker'
import { AttachPage, FieldLabel } from './attach/AttachPage'

const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null

/**
 * Reference EventDialog as a full page: name, description, start date and time, an optional end, a place typed or
 * chosen on the map (the location page in "Use" mode), a meeting link and a reminder; Send (or Save when editing).
 */
function EventForm({ event, onSubmit, onClose }: { event?: EventData | null; onSubmit: (value: EventInput) => Promise<void>; onClose: () => void }) {
  const c = useColors()
  const [form, setForm] = useState(() => initialEventForm(event)); const [picking, setPicking] = useState(false); const [reminders, setReminders] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const result = eventInput(form)
  const starts = parseLocal(form.date, form.start); const ends = form.hasEnd ? parseLocal(form.endDate, form.end) : null
  const endBeforeStart = Boolean(starts && ends && ends < starts)
  const badLink = Boolean(form.link.trim()) && !isMeetingLink(form.link)
  async function submit() {
    if (busy || !result.value) return
    setBusy(true); setError('')
    try { await onSubmit(result.value); if (alive.current) onClose() }
    catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  const reminder = REMINDERS.find(item => item.value === form.reminder)?.label ?? 'No reminder'
  const toggleEnd = () => setForm(value => ({ ...value, hasEnd: !value.hasEnd, endDate: value.endDate || value.date }))
  return <>
    <AttachPage title={event ? 'Edit event' : 'Create event'} onBack={() => { if (!busy) onClose() }} backLabel="Close event" backDisabled={busy}
      footer={<Button title={busy ? (event ? 'Saving…' : 'Sending…') : event ? 'Save' : 'Send'} accessibilityLabel={event ? 'Save event' : 'Send event'} loading={busy} disabled={!result.value} onPress={() => void submit()} />}>
      <View style={{ padding: 16, gap: 18 }}>
        <Field label="Event name" placeholder="e.g. Quarterly review" value={form.title} onChangeText={title => setForm(value => ({ ...value, title }))} maxLength={120} autoFocus={!event} editable={!busy} />
        <Field label="Description (optional)" value={form.description} onChangeText={description => setForm(value => ({ ...value, description }))} maxLength={1000} multiline numberOfLines={2} editable={!busy} style={{ minHeight: 72 }} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <EventDateTime label="Start date" type="date" value={form.date} disabled={busy} onChange={date => setForm(value => ({ ...value, date }))} />
          <EventDateTime label="Start time" type="time" value={form.start} disabled={busy} onChange={start => setForm(value => ({ ...value, start }))} />
        </View>
        <Pressable accessibilityRole="switch" accessibilityLabel="End date and time" accessibilityState={{ checked: form.hasEnd, disabled: busy }} aria-checked={form.hasEnd} disabled={busy} onPress={toggleEnd}
          style={[{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }, pointer]}>
          <Text style={{ color: c.text, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14 }}>End date and time</Text>
          <Switch accessible={false} importantForAccessibility="no" value={form.hasEnd} disabled={busy} trackColor={{ true: c.primary, false: c.subtle }} thumbColor="#ffffff" onValueChange={toggleEnd} />
        </Pressable>
        {form.hasEnd && <View style={{ flexDirection: 'row', gap: 8 }}>
          <EventDateTime label="End date" type="date" value={form.endDate} min={form.date} disabled={busy} onChange={endDate => setForm(value => ({ ...value, endDate }))} />
          <EventDateTime label="End time" type="time" value={form.end} disabled={busy} onChange={end => setForm(value => ({ ...value, end }))} />
        </View>}
        {endBeforeStart && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 12, marginTop: -10 }}>The end must be after the start.</Text>}
        <View style={{ gap: 6 }}>
          <Field label="Location (optional)" placeholder="A room or an address" value={form.place} onChangeText={place => setForm(value => ({ ...value, place, point: null }))} maxLength={200} editable={!busy} />
          <Pressable accessibilityRole="button" accessibilityLabel={form.point ? 'Change place on the map' : 'Choose on the map'} disabled={busy} onPress={() => setPicking(true)} style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 }, pointer]}>
            <Icon name="mapPin" size={16} color={c.brand} />
            <Text style={{ color: c.brand, fontFamily: 'Inter_500Medium', fontWeight: '500', fontSize: 14 }}>{form.point ? 'Change place on the map' : 'Choose on the map'}</Text>
          </Pressable>
        </View>
        <Field label="Meeting link (optional)" placeholder="Google Meet, Teams or Zoom link" value={form.link} onChangeText={link => setForm(value => ({ ...value, link }))} maxLength={500} keyboardType="url" autoCapitalize="none" autoCorrect={false} editable={!busy} error={badLink ? 'Paste a link that starts with https://' : undefined} />
        <View>
          <FieldLabel>Reminder</FieldLabel>
          <Pressable accessibilityRole="button" accessibilityLabel="Reminder" accessibilityHint={reminder} accessibilityState={{ expanded: reminders, disabled: busy }} disabled={busy} onPress={() => setReminders(value => !value)}
            style={[{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 16, borderWidth: 1, borderRadius: 10, borderColor: reminders ? c.brand : c.border, backgroundColor: c.panel }, pointer]}>
            <Text style={{ flex: 1, color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15 }}>{reminder}</Text>
            <View style={{ transform: [{ rotate: reminders ? '0deg' : '180deg' }] }}><Icon name="chevronUp" size={16} color={c.muted} /></View>
          </Pressable>
          {reminders && <View accessibilityLabel="Reminder options" style={{ marginTop: 6, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.panel, overflow: 'hidden' }}>
            {REMINDERS.map(item => {
              const on = form.reminder === item.value
              return <Pressable key={item.value} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: on }} aria-selected={on} onPress={() => { setForm(value => ({ ...value, reminder: item.value })); setReminders(false) }}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16, backgroundColor: on ? c.successSoft : pressed ? c.hover : 'transparent' }, pointer]}>
                <Text style={{ flex: 1, color: on ? c.brand : c.text, fontFamily: on ? 'Inter_500Medium' : 'Inter_400Regular', fontSize: 15 }}>{item.label}</Text>
                {on && <Icon name="check" size={16} color={c.brand} />}
              </Pressable>
            })}
          </View>}
          {form.reminder !== '' && <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>A notification to you and everyone going.</Text>}
        </View>
        {!!form.title.trim() && !!result.error && !endBeforeStart && !badLink && <Text style={{ color: c.danger, fontSize: 12 }}>{result.error}</Text>}
        {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 13 }}>{error}</Text>}
      </View>
    </AttachPage>
    {picking && <LocationPicker mode="pick" onClose={() => setPicking(false)} onSend={place => setForm(value => ({ ...value, place: eventPlaceText(place), point: { latitude: place.latitude, longitude: place.longitude } }))} />}
  </>
}
export function EventComposer({ conversation, onSent, onClose }: { conversation: string; onSent: (message: Message) => void; onClose: () => void }) {
  const request = useRef({ key: '', id: randomUUID() })
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  return <EventForm onClose={onClose} onSubmit={async value => {
    const key = JSON.stringify(value)
    if (request.current.key !== key) request.current = { key, id: randomUUID() }
    const message = await createEvent(conversation, { ...value, client_id: request.current.id })
    if (active.current) onSent(message)
  }} />
}
export function EventEditor({ message, onSaved, onClose }: { message: Message; onSaved: (message: Message) => void; onClose: () => void }) {
  if (!message.can.edit_event || !message.event || message.deleted) return null
  return <EventForm event={message.event} onClose={onClose} onSubmit={async value => { onSaved(await updateEvent(message.id, value)) }} />
}
