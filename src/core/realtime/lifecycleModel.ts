/**
 * Framework-free part of the native subscribeLifecycle: "foreground && connected", reported once at once and then
 * only when it changes.
 *
 * Android's network callback fires on every capability change (signal strength, validation, link speed), and a
 * Wi-Fi <-> mobile hand-over briefly reports "no network" before the replacement network. Each report used to reach
 * every subscriber: the realtime client dropped its socket ("Reconnecting…" then "Connected"), the outbox paused and
 * screens re-fetched. Now repeats are dropped and a loss counts only once it has lasted `lossGraceMs`; coming back,
 * the foreground and the first network reading still apply at once.
 */
export interface LifecycleSources {
  foreground: boolean
  onForeground: (fn: (foreground: boolean) => void) => () => void
  onNetwork: (fn: (connected: boolean) => void) => () => void
  initialNetwork: () => Promise<boolean>
  lossGraceMs?: number
  schedule?: (run: () => void, ms: number) => unknown
  cancel?: (timer: unknown) => void
}

export const NETWORK_LOSS_GRACE_MS = 3_000

export function watchLifecycle(sources: LifecycleSources, handler: (active: boolean) => void) {
  const schedule = sources.schedule ?? ((run, ms) => setTimeout(run, ms))
  const cancel = sources.cancel ?? (timer => clearTimeout(timer as ReturnType<typeof setTimeout>))
  let alive = true
  let foreground = sources.foreground
  let connected = true
  let reported: boolean | null = null
  let events = 0
  let loss: unknown = null
  const report = () => {
    if (!alive) return
    const next = foreground && connected
    if (next === reported) return
    reported = next
    handler(next)
  }
  const stopLoss = () => { if (loss !== null) cancel(loss); loss = null }
  const network = (value: boolean) => {
    if (value) { stopLoss(); connected = true; report(); return }
    if (!connected || loss !== null) return
    loss = schedule(() => { loss = null; connected = false; report() }, sources.lossGraceMs ?? NETWORK_LOSS_GRACE_MS)
  }
  const offForeground = sources.onForeground(value => { foreground = value; report() })
  const offNetwork = sources.onNetwork(value => { events++; network(value) })
  // The first reading is a state, not a hand-over: offline at start-up applies at once.
  void sources.initialNetwork().then(value => { if (events === 0 && alive) { connected = value; report() } }).catch(() => {})
  report()
  return () => { alive = false; stopLoss(); offForeground(); offNetwork() }
}
