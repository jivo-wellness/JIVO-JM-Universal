import { describe, expect, it } from 'vitest'
import { POLL_MAX_OPTIONS, canMovePollOption, movePollOption, pollInput, removePollOption, setPollOption } from './pollForm'

describe('poll form (reference PollDialog)', () => {
  it('adds an empty row when the last one is used, up to 12 rows', () => {
    let options = ['', '']
    options = setPollOption(options, 0, 'Tea')
    expect(options).toEqual(['Tea', ''])
    options = setPollOption(options, 1, 'Coffee')
    expect(options).toEqual(['Tea', 'Coffee', ''])
    for (let i = 2; i < 20; i++) options = setPollOption(options, options.length - 1, 'Option ' + i)
    expect(options).toHaveLength(POLL_MAX_OPTIONS)
  })
  it('caps option text at 100 characters', () => {
    expect(setPollOption(['', ''], 0, 'x'.repeat(150))[0]).toHaveLength(100)
  })
  it('removes a row but keeps two and an empty row to type into', () => {
    expect(removePollOption(['A', 'B'], 0)).toEqual(['A', 'B'])
    expect(removePollOption(['A', 'B', 'C', ''], 1)).toEqual(['A', 'C', ''])
    expect(removePollOption(['A', 'B', 'C'], 2)).toEqual(['A', 'B', ''])
  })
  it('reorders filled rows only; the empty row stays last', () => {
    const options = ['A', 'B', 'C', '']
    expect(movePollOption(options, 2, -1)).toEqual(['A', 'C', 'B', ''])
    expect(movePollOption(options, 0, -1)).toBe(options)
    expect(movePollOption(options, 2, 1)).toBe(options)
    expect(movePollOption(options, 3, -1)).toBe(options)
    expect(canMovePollOption(options, 1, 1)).toBe(true)
    expect(canMovePollOption(options, 2, 1)).toBe(false)
  })
  it('builds the createPoll payload from trimmed, filled options', () => {
    expect(pollInput({ question: '  Lunch? ', options: [' Tea ', '', 'Coffee', ''], multiple: true })).toEqual({ value: { question: 'Lunch?', options: ['Tea', 'Coffee'], allow_multiple: true }, duplicate: false, error: '' })
  })
  it('rejects a missing question, fewer than two options and duplicates (case-insensitive)', () => {
    expect(pollInput({ question: ' ', options: ['A', 'B'], multiple: false }).value).toBeNull()
    expect(pollInput({ question: 'Q', options: ['A', ''], multiple: false }).error).toBe('Add at least two options.')
    const dup = pollInput({ question: 'Q', options: ['Tea', 'tea '], multiple: false })
    expect(dup).toMatchObject({ value: null, duplicate: true, error: 'Options must be different.' })
  })
})
