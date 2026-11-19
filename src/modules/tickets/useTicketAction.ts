import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../../core/api/client'
import { subscribeSensitiveView } from '../../shared/sensitiveLifecycle'

/** Abort on navigation, account change, lock or background; never navigate after cancellation. */
export function useTicketAction() {
  const controller = useRef<AbortController | null>(null)
  const active = useRef(true)
  const focused = useRef(true)
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; controller.current?.abort() } }, []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    active.current = true
    const off = subscribeSensitiveView(value => { active.current = value; if (!value) controller.current?.abort() })
    return () => { active.current = false; controller.current?.abort(); off() }
  }, [])
  async function run<T>(work: (signal: AbortSignal) => Promise<T>, done: (value: T) => void) {
    if (controller.current || !active.current || !focused.current) return
    const request = new AbortController(); controller.current = request; setBusy(true); setError('')
    try { const result = await work(request.signal); if (active.current && focused.current && !request.signal.aborted) done(result) }
    catch (e) { setError(request.signal.aborted ? 'Request interrupted. Refresh the ticket list before retrying; the server may have received it.' : errorMessage(e)) }
    finally { controller.current = null; setBusy(false) }
  }
  return { busy, error, run }
}
