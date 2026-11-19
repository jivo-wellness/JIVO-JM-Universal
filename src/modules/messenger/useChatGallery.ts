import { useEffect, useMemo, useState } from 'react'
import { getShared, type Message, type SharedItem } from './api'

/** Fetch shared-media pages independently of the message window, retaining chronological swipe order. */
export function useChatGallery(conversation: string | null, open: boolean, messages: Message[], user?: string) {
  const [cache, setCache] = useState<{ id: string; items: SharedItem[] } | null>(null)
  useEffect(() => {
    if (!open || !conversation) return
    let active = true
    void (async () => {
      let before: number | null = null
      const seen = new Set<number>(); const items: SharedItem[] = []
      do {
        const page = await getShared(conversation, 'media', before)
        if (!active) return
        items.push(...page.results); setCache({ id: conversation, items: [...items] })
        before = page.next_before
        if (before !== null && seen.has(before)) break
        if (before !== null) seen.add(before)
      } while (before !== null)
    })().catch(() => { /* Already loaded messages remain usable offline. */ })
    return () => { active = false }
  }, [conversation, open])
  return useMemo(() => {
    const loaded = new Map(messages.map(m => [m.id, m]))
    const shared = cache?.id === conversation ? cache.items.filter(item => !loaded.has(item.message.id)) : []
    const rows = [...shared, ...messages.filter(m => !m.deleted).flatMap(m => m.attachments.map(attachment => ({ message: m, attachment })))]
    const unique = new Map(rows.filter(row => row.attachment?.status === 'ready' && ['image', 'video'].includes(row.attachment.kind)).map(row => [row.attachment!.id, {
      attachment: row.attachment!, message: row.message.id, seq: row.message.seq,
      sender: row.message.sender?.id === user ? 'You' : row.message.sender?.name || 'JM', createdAt: row.message.created_at,
    }]))
    return [...unique.values()].sort((a, b) => a.seq - b.seq)
  }, [cache, conversation, messages, user])
}
