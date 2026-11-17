import { useCallback, useEffect, useState } from 'react'
/**
 * `keep`: a refresh of the same `load` (reconnect RESYNC, focus, retry) keeps showing the last value until the new one
 * arrives instead of blanking the screen to a spinner (profile pages). A different `load` (another person or chat)
 * never shows the previous value.
 */
export function useResource<T>(load: () => Promise<T>, { keep = false }: { keep?: boolean } = {}) {
  const [revision, setRevision] = useState(0)
  const [snapshot, setSnapshot] = useState<{ owner: () => Promise<T>; revision: number; value: T | null; error: unknown } | null>(null)
  useEffect(() => {
    let active = true
    void load().then(value => { if (active) setSnapshot({ owner: load, revision, value, error: null }) }).catch(error => { if (active) setSnapshot({ owner: load, revision, value: null, error }) })
    return () => { active = false }
  }, [load, revision])
  const current = snapshot?.owner === load && snapshot.revision === revision ? snapshot : null
  const previous = keep && !current && snapshot?.owner === load ? snapshot.value : null
  const refresh = useCallback(() => setRevision(v => v + 1), [])
  return { value: current?.value ?? previous ?? null, error: current?.error ?? null, loading: current === null, refresh }
}
