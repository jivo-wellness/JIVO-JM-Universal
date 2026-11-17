import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CursorController, type CursorPage, type CursorSeed } from './cursor'
import { errorMessage } from '../core/api/client'
/** `seed` (optional): device-cached rows to show at once while `load` asks the server. */
export function useCursor<T extends { id: string | number }>(load: (cursor?: string | null) => Promise<CursorPage<T>>, seed?: CursorSeed<T>) {
  // Rows the seed already holds in memory are the first frame (no spinner, no empty list).
  const [controller] = useState(() => { let initial: T[] | Promise<T[]> | undefined; try { initial = seed?.() } catch { initial = undefined }; return new CursorController<T>(errorMessage, Array.isArray(initial) ? initial : undefined) })
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot)
  const seedRef = useRef(seed)
  useEffect(() => { seedRef.current = seed })
  useEffect(() => { void controller.reset(load, seedRef.current); return controller.invalidate }, [controller, load])
  return { ...state, more: controller.more, refresh: controller.refresh, revalidate: controller.revalidate }
}
