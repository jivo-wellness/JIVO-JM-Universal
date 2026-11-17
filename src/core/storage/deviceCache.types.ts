/**
 * Per-device cache files for fast start-up (last chat list, recent history, the last signed-in profile).
 * Native keeps them in the app-private documents directory; the browser keeps them in memory only (U-004).
 * Never put vault secrets, passwords or tokens here.
 */
export interface DeviceCache {
  read(name: string): Promise<string | null>
  write(name: string, value: string): Promise<void>
  remove(name: string): Promise<void>
  /** Removes every cache file except those `keep` accepts. */
  clear(keep?: (name: string) => boolean): Promise<void>
}
/** File names are derived from server ids; keep them to a safe character set. */
export const cacheName = (prefix: string, id: string) => `${prefix}-${encodeURIComponent(id).replace(/[^A-Za-z0-9_.-]/g, '_')}.json`
