/** Recently used emoji for the composer panel (not sensitive; per browser profile). */
const key = 'jm.emoji.recent'
export const emojiRecentsStorage = {
  read: async (): Promise<string | null> => { try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key) } catch { return null } },
  write: async (value: string): Promise<void> => { try { if (typeof window !== 'undefined') window.localStorage.setItem(key, value) } catch { /* storage full or blocked: recents stay in memory */ } },
}
