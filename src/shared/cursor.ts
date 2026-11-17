export interface CursorPage<T> { results: T[]; next_cursor: string | null }
export interface CursorState<T> { items: T[]; cursor: string | null; loading: boolean; error: string }
/** Device-cached rows: returned at once when they are already in memory, otherwise a promise. */
export type CursorSeed<T> = () => T[] | Promise<T[]>
export class CursorController<T extends { id: string | number }> {
  private state: CursorState<T>
  private generation = 0
  private listeners = new Set<() => void>()
  private load: (cursor?: string | null) => Promise<CursorPage<T>> = async () => ({ results: [], next_cursor: null })
  /** `initial`: rows already in memory for the first frame (start-up cache), shown as loading until the first page. */
  constructor(private readonly message: (error: unknown) => string, initial?: T[]) {
    this.state = { items: initial ?? [], cursor: null, loading: !!initial?.length, error: '' }
  }
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private publish(state: CursorState<T>) { this.state = state; this.listeners.forEach(fn => fn()) }
  invalidate = () => { this.generation++ }
  /**
   * `seed`: rows kept on this device, shown while the first page loads (replaced by the server's page). Rows the seed
   * returns synchronously replace the list in the same update, so a seeded list never blanks or shows a spinner.
   */
  reset = (load: (cursor?: string | null) => Promise<CursorPage<T>>, seed?: CursorSeed<T>) => {
    this.load = load
    const generation = ++this.generation
    let early: T[] | Promise<T[]> | undefined
    try { early = seed?.() } catch { early = undefined }
    this.publish({ items: Array.isArray(early) ? early : [], cursor: null, loading: true, error: '' })
    const pending = this.fetch(undefined, generation, true)
    if (early && !Array.isArray(early)) void early.then(items => {
      if (generation === this.generation && this.state.loading && !this.state.items.length && items.length) this.publish({ ...this.state, items })
    }, () => undefined)
    return pending
  }
  refresh = async () => {
    const generation = ++this.generation
    this.publish({ items: [], cursor: null, loading: true, error: '' })
    await this.fetch(undefined, generation, true)
  }
  /** Reloads the first page while the current rows stay on screen (stale-while-revalidate). */
  revalidate = async () => {
    const generation = ++this.generation
    this.publish({ ...this.state, loading: true, error: '' })
    await this.fetch(undefined, generation, true)
  }
  more = async () => {
    if (this.state.loading || !this.state.cursor) return
    const { cursor } = this.state; const generation = this.generation
    this.publish({ ...this.state, loading: true, error: '' })
    await this.fetch(cursor, generation, false)
  }
  private async fetch(cursor: string | undefined, generation: number, replace: boolean) {
    try {
      const page = await this.load(cursor)
      if (generation !== this.generation) return
      const byId = new Map((replace ? [] : this.state.items).map(item => [item.id, item]))
      page.results.forEach(item => byId.set(item.id, item))
      this.publish({ items: [...byId.values()], cursor: page.next_cursor, loading: false, error: '' })
    } catch (error) {
      if (generation === this.generation) this.publish({ ...this.state, loading: false, error: this.message(error) })
    }
  }
}
