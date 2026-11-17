import { describe, expect, it, vi } from 'vitest'
import { CursorController } from './cursor'
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
describe('cursor ownership', () => {
  it('discards a previous query page when filters change', async () => {
    const old = deferred<{ results: { id: string }[]; next_cursor: string | null }>()
    const c = new CursorController<{ id: string }>(String)
    await c.reset(async cursor => cursor ? old.promise : { results: [{ id: 'old' }], next_cursor: 'next' })
    const pending = c.more()
    await c.reset(async () => ({ results: [{ id: 'new' }], next_cursor: null }))
    old.resolve({ results: [{ id: 'stale' }], next_cursor: 'stale' }); await pending
    expect(c.snapshot().items).toEqual([{ id: 'new' }]); expect(c.snapshot().cursor).toBeNull()
  })
  it('guards concurrent page loads and merges overlapping IDs', async () => {
    const page = deferred<{ results: { id: string; value: number }[]; next_cursor: string | null }>()
    const load = vi.fn(async (cursor?: string | null) => cursor ? page.promise : { results: [{ id: 'a', value: 1 }], next_cursor: 'next' })
    const c = new CursorController<{ id: string; value: number }>(String); await c.reset(load)
    const first = c.more(); await c.more(); expect(load).toHaveBeenCalledTimes(2)
    page.resolve({ results: [{ id: 'a', value: 2 }, { id: 'b', value: 3 }], next_cursor: null }); await first
    expect(c.snapshot().items).toEqual([{ id: 'a', value: 2 }, { id: 'b', value: 3 }])
  })
})
it('shows seeded device rows while loading and replaces them with the server page', async () => {
  let release!: (page: { results: { id: string }[]; next_cursor: string | null }) => void
  const c = new CursorController<{ id: string }>(String)
  const loading = c.reset(() => new Promise(r => { release = r }), async () => [{ id: 'cached' }])
  await new Promise(r => setTimeout(r, 0))
  expect(c.snapshot()).toMatchObject({ items: [{ id: 'cached' }], loading: true })
  release({ results: [{ id: 'fresh' }], next_cursor: null }); await loading
  expect(c.snapshot()).toMatchObject({ items: [{ id: 'fresh' }], loading: false })
})
it('revalidates without clearing the rows on screen', async () => {
  const next = deferred<{ results: { id: string }[]; next_cursor: string | null }>()
  let first = true
  const c = new CursorController<{ id: string }>(String)
  await c.reset(async () => { if (first) { first = false; return { results: [{ id: 'a' }], next_cursor: null } } return next.promise })
  const again = c.revalidate(); expect(c.snapshot()).toMatchObject({ items: [{ id: 'a' }], loading: true })
  next.resolve({ results: [{ id: 'b' }], next_cursor: null }); await again
  expect(c.snapshot().items).toEqual([{ id: 'b' }])
})
it('starts with rows the seed already holds in memory: no blank list, no spinner-only frame (U-031)', async () => {
  const next = deferred<{ results: { id: string }[]; next_cursor: string | null }>()
  const c = new CursorController<{ id: string }>(String, [{ id: 'cached' }])
  expect(c.snapshot()).toMatchObject({ items: [{ id: 'cached' }], loading: true })
  const seen: { id: string }[][] = []; c.subscribe(() => seen.push(c.snapshot().items))
  const loading = c.reset(() => next.promise, () => [{ id: 'cached' }])
  expect(seen.every(items => items.length === 1)).toBe(true)
  next.resolve({ results: [{ id: 'fresh' }], next_cursor: null }); await loading
  expect(c.snapshot()).toMatchObject({ items: [{ id: 'fresh' }], loading: false })
})
