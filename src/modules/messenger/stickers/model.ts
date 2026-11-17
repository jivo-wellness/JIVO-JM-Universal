/**
 * Stickers (U-028): the built-in JM pack (original artwork in assets/stickers, drawn by scripts/stickers) and the
 * person's favourites (stickers or photos they starred from chats, kept on this device). Pure helpers only.
 */
export interface StickerInfo { id: string; label: string; keywords: string[] }

/** The built-in pack's names and search words; the images are in `pack.ts` (same ids). */
export const PACK_INFO: StickerInfo[] = [
  { id: 'hi', label: 'Hi', keywords: ['hello', 'hey', 'namaste', 'wave', 'morning'] },
  { id: 'smile', label: 'Smile', keywords: ['happy', 'glad', 'nice', 'face'] },
  { id: 'laugh', label: 'Laugh', keywords: ['lol', 'haha', 'funny', 'joy', 'face'] },
  { id: 'love', label: 'Love', keywords: ['heart eyes', 'adore', 'like', 'face'] },
  { id: 'wink', label: 'Wink', keywords: ['joke', 'tease', 'playful', 'face'] },
  { id: 'wow', label: 'Wow', keywords: ['surprised', 'shock', 'omg', 'face'] },
  { id: 'sad', label: 'Sad', keywords: ['sorry', 'cry', 'upset', 'tear', 'face'] },
  { id: 'heart', label: 'Heart', keywords: ['love', 'care', 'red'] },
  { id: 'thanks', label: 'Thanks', keywords: ['thank you', 'grateful', 'ty', 'dhanyavad'] },
  { id: 'ok', label: 'OK', keywords: ['okay', 'fine', 'agree', 'yes', 'sure'] },
  { id: 'done', label: 'Done', keywords: ['finished', 'complete', 'tick', 'check', 'yes'] },
  { id: 'star', label: 'Great job', keywords: ['well done', 'star', 'excellent', 'awesome', 'good'] },
  { id: 'party', label: 'Congrats', keywords: ['congratulations', 'celebrate', 'party', 'birthday'] },
  { id: 'chai', label: 'Chai', keywords: ['tea', 'coffee', 'break', 'cup'] },
]

/** Pack stickers whose label or a keyword starts a word with the query (case-insensitive); all for an empty query. */
export function searchPack<T extends StickerInfo>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(item => [item.label, ...item.keywords].some(text => { const t = text.toLowerCase(); return t.startsWith(q) || t.includes(' ' + q) }))
}

export interface FavouriteSticker {
  id: string
  /** The chat attachment it was starred from, so starring it again moves it to the front instead of copying it. */
  source: string
  /** Local file (native) or object URL (browser). */
  uri: string
  mime: 'image/png'
  size: number
  addedAt: number
}

export const MAX_FAVOURITES = 60
/** Starred stickers are scaled to fit this square (WhatsApp stickers are 512 px). */
export const STICKER_SIDE = 512

/** Newest first, one entry per source, at most MAX_FAVOURITES; returns the list and the entries that fell off. */
export function addFavourite(list: FavouriteSticker[], item: FavouriteSticker): { list: FavouriteSticker[]; dropped: FavouriteSticker[] } {
  const others = list.filter(f => f.source !== item.source)
  const replaced = list.filter(f => f.source === item.source)
  const next = [item, ...others]
  return { list: next.slice(0, MAX_FAVOURITES), dropped: [...replaced, ...next.slice(MAX_FAVOURITES)] }
}

/** Reads a saved index, keeping only well-formed entries (a damaged file must not break the panel). */
export function parseFavourites(raw: string | null): FavouriteSticker[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((f): f is FavouriteSticker => !!f && typeof f === 'object' && typeof f.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(f.id) && typeof f.source === 'string' && typeof f.uri === 'string' && f.mime === 'image/png' && typeof f.size === 'number' && typeof f.addedAt === 'number').slice(0, MAX_FAVOURITES)
  } catch { return [] }
}

/** Fit (width, height) inside STICKER_SIDE, never enlarging. */
export function fitSticker(width: number, height: number): { width: number; height: number } {
  if (!(width > 0 && height > 0)) return { width: STICKER_SIDE, height: STICKER_SIDE }
  const scale = Math.min(1, STICKER_SIDE / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** A message the app draws as a sticker: one ready sticker image, no caption. */
export function isStickerMessage(m: { kind: string; body: string; deleted: boolean; attachments: { kind: string; status: string; sticker?: boolean }[] }): boolean {
  return !m.deleted && m.kind === 'attachment' && !m.body.trim() && m.attachments.length === 1 && m.attachments[0].kind === 'image' && m.attachments[0].status === 'ready' && m.attachments[0].sticker === true
}

/** Images that can be starred as a sticker (WhatsApp lets you favourite received stickers; JM also takes photos). */
export function canStar(a: { kind: string; status: string; preview_url: string | null; thumb_url: string | null }): boolean {
  return a.kind === 'image' && a.status === 'ready' && !!(a.preview_url || a.thumb_url)
}
