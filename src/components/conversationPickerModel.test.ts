import { expect, it } from 'vitest'
import { personSubtitle, pickerRows } from './conversationPickerModel'
const person = (id: string, name = id) => ({ id, name, avatar_url: null, company: null, is_active: true, email: `${id}@jivo.in` })
const me = { id: 'me', name: 'Asha Rao', email: 'asha@jivo.in', employee_code: 'J42', avatar_url: null }
it('lists Message yourself above the directory without yourself or repeated rows', () => {
  const rows = pickerRows([person('a'), person('me'), person('b'), person('a')], me, '', false)
  expect(rows.self?.id).toBe('me'); expect(rows.people.map(p => p.id)).toEqual(['a', 'b'])
})
it('offers yourself only when the search matches you, and never while choosing group members', () => {
  expect(pickerRows([], me, 'j42', false).self?.id).toBe('me')
  expect(pickerRows([], me, 'you', false).self?.id).toBe('me')
  expect(pickerRows([], me, 'ravi', false).self).toBeNull()
  expect(pickerRows([], me, '', true).self).toBeNull()
})
it('subtitles are email and company like the web picker', () => {
  expect(personSubtitle({ ...person('a'), company: 'JIVO Wellness' })).toBe('a@jivo.in · JIVO Wellness')
  expect(personSubtitle({ ...person('a'), email: undefined })).toBe('')
})
