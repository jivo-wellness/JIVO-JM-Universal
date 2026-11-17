import { useEffect, useRef } from 'react'
import { realtime } from '../core/realtime/socket'
import { subscribeLifecycle } from '../core/realtime/lifecycle'
import { reconnectWatch } from './reconnectWatch'

/** At most one automatic retry per screen in this window (see reconnectWatch). */
export const RECONNECT_RETRY_GAP_MS = 10_000

/**
 * While `failed`, calls `retry` once JM is reachable again: the live connection reopens, or the app returns to the
 * foreground / the device reports a network again. A screen whose load failed on a weak connection recovers by itself,
 * but never more often than every RECONNECT_RETRY_GAP_MS, so a flapping connection cannot reload it in a loop.
 */
export function useReconnectRetry(failed: boolean, retry: () => void) {
  const latest = useRef(retry)
  const last = useRef(0)
  useEffect(() => { latest.current = retry })
  useEffect(() => {
    if (!failed) return
    return reconnectWatch({
      status: realtime.snapshot, subscribeStatus: realtime.subscribe, subscribeLifecycle,
      lastRetryAt: last.current, minGapMs: RECONNECT_RETRY_GAP_MS,
      retry: () => { last.current = Date.now(); latest.current() },
    })
  }, [failed])
}
