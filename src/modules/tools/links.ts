export function safeToolLink(value: string, app = false): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password || /[\s\\]/.test(value)) return false
    if (url.protocol === 'https:') return !!url.hostname
    return app && !!url.host && !['http:', 'file:', 'content:', 'intent:', 'javascript:', 'data:', 'vbscript:', 'tel:', 'sms:', 'mailto:'].includes(url.protocol)
  } catch { return false }
}

/** Same tile initials as the web directory. */
export function toolInitials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?'
}
