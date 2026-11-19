import { useEffect, useState } from 'react'
import { api } from '../../core/api/client'
import { realtime } from '../../core/realtime/socket'
import { subscribeSensitiveView } from '../../shared/sensitiveLifecycle'

/** One batched presence subscription for the chat list; never expose last-seen text. */
export function useListPresence(ids: string[], owner: string): Record<string, boolean> {
  const key = [...new Set(ids)].sort().join(',')
  const [snapshot, setSnapshot] = useState<{ key: string; owner: string; online: Record<string, boolean> }>({ key: '', owner: '', online: {} })
  useEffect(() => {
    if (!key || !owner) return
    const peers = key.split(','); const wanted = new Set(peers)
    let active = true; let visible = true; let busy = false; let revision = 0
    const refresh = () => {
      if (!active || !visible || busy) return
      busy = true
      const version = revision
      void Promise.all(Array.from({ length: Math.ceil(peers.length / 100) }, (_, i) =>
        api.get<{ results: Record<string, { online: boolean | null }> }>('/users/presence/', { params: { ids: peers.slice(i * 100, (i + 1) * 100).join(',') } }),
      )).then(pages => {
        if (!active || !visible || version !== revision) return
        const online: Record<string, boolean> = {}
        for (const { data } of pages) for (const [id, presence] of Object.entries(data.results)) if (wanted.has(id)) online[id] = presence.online === true
        setSnapshot({ key, owner, online })
      }).catch(() => {}).finally(() => { busy = false })
    }
    const off = realtime.on<{ user?: string }>('*', ({ type, data }) => {
      if (!active || !visible) return
      if (type === 'HELLO' || type === 'RESYNC' || type === 'PONG') { refresh(); return }
      if (data?.user && wanted.has(data.user) && (type === 'USER_ONLINE' || type === 'USER_OFFLINE')) {
        revision++
        const id = data.user
        setSnapshot(old => ({ key, owner, online: { ...(old.key === key && old.owner === owner ? old.online : {}), [id]: type === 'USER_ONLINE' } }))
      }
    })
    const lifecycle = subscribeSensitiveView(value => {
      visible = value
      if (value) refresh()
      else { revision++; setSnapshot({ key, owner, online: {} }) }
    })
    refresh()
    const timer = setInterval(refresh, 15_000)
    return () => { active = false; off(); lifecycle(); clearInterval(timer) }
  }, [key, owner])
  return snapshot.key === key && snapshot.owner === owner ? snapshot.online : {}
}
