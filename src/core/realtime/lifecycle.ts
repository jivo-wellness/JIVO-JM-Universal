export function subscribeLifecycle(handler: (active: boolean) => void) {
  if (typeof document === 'undefined') return () => {}
  // Reported once at once, then only on a change (a repeated 'online' or visibility event is not a return).
  let reported: boolean | null = null
  const update = () => { const next = document.visibilityState === 'visible' && navigator.onLine; if (next === reported) return; reported = next; handler(next) }
  document.addEventListener('visibilitychange', update)
  window.addEventListener('online', update); window.addEventListener('offline', update)
  update()
  return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('online', update); window.removeEventListener('offline', update) }
}
