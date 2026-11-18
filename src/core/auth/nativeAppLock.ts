export interface NativeLockState { ready: boolean; opened: boolean; enabled: boolean; locked: boolean; busy: boolean; error: string }
export class NativeAppLock {
  private state: NativeLockState = { ready: false, opened: false, enabled: false, locked: true, busy: false, error: '' }
  private listeners = new Set<() => void>()
  private generation = 0
  private restoreRevision = 0
  private disposed = false
  private autoAttempted = false
  private backgroundAt: number | null = null
  private resumeUnlocked = false
  constructor(private deps: { read: () => Promise<boolean>; write: (enabled: boolean) => Promise<void>; authenticate: () => Promise<boolean>; cancel: () => void }, private now = () => Date.now()) {}
  snapshot = () => this.state
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private publish(patch: Partial<NativeLockState>) { if (!this.disposed) { const next = { ...this.state, ...patch }; this.state = { ...next, opened: next.opened || next.ready && !next.locked }; this.listeners.forEach(fn => fn()) } }
  async restore() {
    // React development StrictMode can detach and attach the same effect/model instance.
    this.disposed = false
    const revision = ++this.restoreRevision
    try { const enabled = await this.deps.read(); if (revision === this.restoreRevision) this.publish({ ready: true, enabled, locked: enabled && (!this.state.ready || !this.state.enabled || this.state.locked), error: '' }) }
    catch { if (revision === this.restoreRevision) this.publish({ ready: false, locked: true, error: 'Device lock settings could not be read. Retry or sign out.' }) }
  }
  background() { if (this.backgroundAt === null) { this.backgroundAt = this.now(); this.resumeUnlocked = this.state.ready && !this.state.locked && !this.state.busy } this.autoAttempted = false; this.generation++; this.deps.cancel(); this.publish({ locked: this.state.enabled, busy: false }) }
  async foreground() {
    if (this.backgroundAt !== null) {
      const resume = this.resumeUnlocked && this.now() - this.backgroundAt < 300_000
      this.backgroundAt = null; this.resumeUnlocked = false
      if (resume && this.state.ready) this.publish({ locked: false })
    }
    if (this.disposed || !this.state.ready || !this.state.enabled || !this.state.locked || this.state.busy || this.autoAttempted) return
    this.autoAttempted = true
    await this.verify()
  }
  async verify(change?: boolean) {
    if (!this.state.ready || this.state.busy) return
    const generation = ++this.generation; this.publish({ busy: true, error: '' })
    try {
      if (!await this.deps.authenticate()) { if (generation === this.generation) this.publish({ error: 'Device verification was cancelled or unsuccessful.' }); return }
      if (this.disposed || generation !== this.generation) return
      if (change !== undefined) await this.deps.write(change)
      if (this.disposed || generation !== this.generation) {
        if (change !== undefined) this.publish({ enabled: change, locked: change })
        return
      }
      this.publish({ enabled: change ?? this.state.enabled, locked: false })
    } catch { if (generation === this.generation) this.publish({ error: 'Device verification is unavailable. Check your screen lock settings and retry.' }) }
    finally { if (generation === this.generation) this.publish({ busy: false }) }
  }
  dispose() { this.disposed = true; this.generation++; this.restoreRevision++; this.deps.cancel(); this.listeners.clear() }
}
