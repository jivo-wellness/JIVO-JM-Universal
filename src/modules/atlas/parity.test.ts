import { describe, expect, it, vi } from 'vitest'
import { AtlasThread } from './thread'
import { parseChart } from './chart'
import type { Ask } from './model'
const ask: Ask = { id: 1, text: 'hello', answer: null, with: null, error_message: null, reply_to: null, state: 'queued', open: true, created_at: new Date().toISOString(), answered_at: null }
describe('Atlas web parity', () => {
  it('does not resurrect an exchange deleted during an in-flight refresh', async () => {
    let finish!: (value: { results: Ask[]; has_more: boolean }) => void
    const thread = new AtlasThread({ list: () => new Promise(resolve => { finish = resolve }), create: vi.fn(), get: vi.fn() }, undefined, { asks: [ask], hasMore: false })
    const loading = thread.load()
    thread.remove(1)
    finish({ results: [ask], has_more: false })
    await loading
    expect(thread.snapshot().asks).toEqual([])
    thread.dispose()
  })
  it('validates chart dimensions and numeric values with the web limits', () => {
    const chart = { type: 'bar', title: 'Sales', labels: ['A'], series: [{ name: 'Total', values: [12] }] }
    expect(parseChart(JSON.stringify(chart))).toEqual(chart)
    expect(parseChart(JSON.stringify({ ...chart, series: [{ name: 'Total', values: [12, 13] }] }))).toBeNull()
    expect(parseChart(JSON.stringify({ ...chart, series: [{ name: 'Total', values: [1e15] }] }))).toBeNull()
    expect(parseChart('{bad')).toBeNull()
  })
})
