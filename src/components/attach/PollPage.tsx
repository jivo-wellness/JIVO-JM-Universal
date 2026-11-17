import { useEffect, useRef, useState } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'
import { randomUUID } from 'expo-crypto'
import * as chat from '../../modules/messenger/api'
import { POLL_OPTION_MAX, POLL_QUESTION_MAX, canMovePollOption, emptyPoll, movePollOption, pollInput, removePollOption, setPollOption, type PollDraft } from '../../modules/messenger/pollForm'
import { errorMessage } from '../../core/api/client'
import { Button, Field, useColors } from '../../ui'
import { Icon } from '../Icon'
import { AttachPage, FieldLabel } from './AttachPage'

const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null

/**
 * Reference PollDialog as a full page: the question, options (a new row appears when the last one is used, up to 12;
 * × removes one; arrows reorder), "Allow multiple answers", and Send. Options must be different.
 */
export function PollPage({ conversation, onSent, onClose }: { conversation: string; onSent: (message: chat.Message) => void; onClose: () => void }) {
  const c = useColors()
  const [draft, setDraft] = useState<PollDraft>(emptyPoll)
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const request = useRef({ key: '', id: randomUUID() }); const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const result = pollInput(draft)
  const change = (next: Partial<PollDraft>) => { setDraft(d => ({ ...d, ...next })); setError('') }
  async function submit() {
    if (busy || !result.value) return
    const key = JSON.stringify(result.value)
    if (request.current.key !== key) request.current = { key, id: randomUUID() } // same poll retried: same client_id
    setBusy(true); setError('')
    try { const message = await chat.createPoll(conversation, { client_id: request.current.id, ...result.value }); if (alive.current) onSent(message) }
    catch (e) { if (alive.current) setError(errorMessage(e)) }
    finally { if (alive.current) setBusy(false) }
  }
  return <AttachPage title="Create poll" onBack={() => { if (!busy) onClose() }} backLabel="Close poll" backDisabled={busy}
    footer={<Button title={busy ? 'Sending…' : 'Send'} accessibilityLabel="Send poll" loading={busy} disabled={!result.value} onPress={() => void submit()} />}>
    <View style={{ padding: 16, gap: 20 }}>
      <Field label="Question" accessibilityLabel="Poll question" value={draft.question} maxLength={POLL_QUESTION_MAX} placeholder="Ask a question" autoFocus editable={!busy} onChangeText={question => change({ question })} />
      <View style={{ gap: 8 }}>
        <FieldLabel>Options</FieldLabel>
        {draft.options.map((option, i) => {
          const filled = !!option.trim()
          return <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Field compact label={`Option ${i + 1}`} value={option} maxLength={POLL_OPTION_MAX} placeholder={i < 2 ? `Option ${i + 1}` : '+ Add option'} editable={!busy} onChangeText={value => change({ options: setPollOption(draft.options, i, value) })} />
            </View>
            {filled && draft.options.filter(o => o.trim()).length > 1 && <View style={{ flexDirection: 'row' }}>
              <SmallButton icon="chevronUp" label={`Move option ${i + 1} up`} disabled={busy || !canMovePollOption(draft.options, i, -1)} onPress={() => change({ options: movePollOption(draft.options, i, -1) })} />
              <SmallButton icon="chevronUp" flip label={`Move option ${i + 1} down`} disabled={busy || !canMovePollOption(draft.options, i, 1)} onPress={() => change({ options: movePollOption(draft.options, i, 1) })} />
            </View>}
            {draft.options.length > 2 && !!option && <SmallButton icon="x" label={`Remove option ${i + 1}`} disabled={busy} onPress={() => change({ options: removePollOption(draft.options, i) })} />}
          </View>
        })}
        {result.duplicate && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 12 }}>Options must be different.</Text>}
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Allow multiple answers" accessibilityState={{ checked: draft.multiple, disabled: busy }} aria-checked={draft.multiple} disabled={busy} onPress={() => change({ multiple: !draft.multiple })}
        style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }, pointer]}>
        <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: draft.multiple ? c.primary : c.muted, backgroundColor: draft.multiple ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{draft.multiple && <Icon name="check" size={14} color="#ffffff" />}</View>
        <Text style={{ color: c.text, fontFamily: 'Inter_400Regular', fontSize: 15 }}>Allow multiple answers</Text>
      </Pressable>
      {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 13 }}>{error}</Text>}
    </View>
  </AttachPage>
}

function SmallButton({ icon, label, onPress, disabled, flip = false }: { icon: 'chevronUp' | 'x'; label: string; onPress: () => void; disabled?: boolean; flip?: boolean }) {
  const c = useColors()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} hitSlop={2}
    style={({ pressed }) => [{ width: 34, height: 44, borderRadius: 17, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1, backgroundColor: pressed ? c.hover : 'transparent', transform: flip ? [{ rotate: '180deg' }] : [] }, pointer]}>
    <Icon name={icon} size={16} color={c.muted} />
  </Pressable>
}
