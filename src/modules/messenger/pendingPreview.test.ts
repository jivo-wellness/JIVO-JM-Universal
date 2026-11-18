import { expect, it } from 'vitest'
import { mergePendingPreview, restoreUnsentDraft } from './pendingPreview'
import { pendingForConversation, type PendingSend } from './outboxController'

const preview: PendingSend = { owner: 'me', conversation: 'chat', created: 1, status: 'sending', payload: { client_id: 'local-1', body: 'Hello', upload_ids: [] } }

it('shows the sending bubble before storage completes', () => {
  expect(pendingForConversation(mergePendingPreview([], preview, 'me'), 'chat', [])).toEqual([preview])
})
it('uses the durable entry instead of rendering the same message twice', () => {
  const saved = { ...preview, status: 'queued' as const }
  expect(mergePendingPreview([saved], preview, 'me')).toEqual([saved])
})
it('removes the transient bubble on storage failure and hides it from another account', () => {
  expect(mergePendingPreview([], null, 'me')).toEqual([])
  expect(mergePendingPreview([], preview, 'other')).toEqual([])
})
it('restores an unsaved message and preserves a newly typed draft', () => {
  expect(restoreUnsentDraft('Hello', '')).toBe('Hello')
  expect(restoreUnsentDraft('Hello', 'Next question')).toBe('Hello\nNext question')
})
