/**
 * Framework-free part of useReconnectRetry: one retry on the first real "reachable again" signal: the live connection
 * reopening after it was not open, or the app returning to the foreground / online after it was not.
 *
 * `lastRetryAt` / `minGapMs`: a retry never runs sooner than `minGapMs` after the previous one for the same screen. On
 * a flapping network (Wi-Fi not validated, hand-overs) the socket can reopen every few seconds; without the gap each
 * reopen re-fetched the screen, the fetch failed again and the next reopen fetched again: an endless reload.
 */
export function reconnectWatch({ status, subscribeStatus, subscribeLifecycle, retry, lastRetryAt = 0, minGapMs = 0, now = Date.now, schedule = (run, ms) => setTimeout(run, ms), cancel = timer => clearTimeout(timer as ReturnType<typeof setTimeout>) }: {
  status: () => string
  subscribeStatus: (fn: () => void) => () => void
  subscribeLifecycle: (fn: (active: boolean) => void) => () => void
  retry: () => void
  lastRetryAt?: number
  minGapMs?: number
  now?: () => number
  schedule?: (run: () => void, ms: number) => unknown
  cancel?: (timer: unknown) => void
}) {
  let done = false
  let open = status() === 'open'
  let active: boolean | null = null
  let timer: unknown = null
  const run = () => { if (done) return; done = true; stop(); retry() }
  const fire = () => {
    if (done || timer !== null) return
    const wait = lastRetryAt + minGapMs - now()
    if (wait <= 0) run(); else timer = schedule(() => { timer = null; run() }, wait)
  }
  const offStatus = subscribeStatus(() => { const next = status() === 'open'; if (next && !open) fire(); open = next })
  const offLifecycle = subscribeLifecycle(next => { const was = active; active = next; if (was === false && next) fire() })
  function stop() { offStatus(); offLifecycle(); if (timer !== null) cancel(timer); timer = null }
  if (done) stop()
  return () => { done = true; stop() }
}
