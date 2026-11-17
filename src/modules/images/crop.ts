import type { ImageEdit } from './model'

/**
 * Crop geometry of the reference ImageEditor (Frontend src/shared/components/ImageEditor.tsx): aspect presets,
 * a free crop with edge handles, ratio-locked corner drags, and the settings handed to `editImage`.
 */
export type AspectKey = 'free' | '1:1' | '4:5' | '4:3' | '16:9' | 'circle'
export type FrameKey = ImageEdit['frame']
export type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'
export interface CropRect { x: number; y: number; w: number; h: number }

export const ASPECTS: { key: AspectKey; label: string; ratio: number | null; circle?: boolean }[] = [
  { key: 'free', label: 'Free', ratio: null },
  { key: '1:1', label: 'Square', ratio: 1 },
  { key: '4:5', label: 'Portrait', ratio: 4 / 5 },
  { key: '4:3', label: 'Landscape', ratio: 4 / 3 },
  { key: '16:9', label: 'Wide', ratio: 16 / 9 },
  { key: 'circle', label: 'Circle', ratio: 1, circle: true },
]
export const FRAMES: { key: FrameKey; label: string }[] = [
  { key: 'none', label: 'No frame' },
  { key: 'square', label: 'Square' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'circle', label: 'Circle' },
  { key: 'thin', label: 'Thin border' },
  { key: 'thick', label: 'Thick border' },
]
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 }
export const MIN_CROP = 0.06
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** The largest centred crop of `ratio` (display width/height) inside an image of `boxRatio`. */
export function centredCrop(ratio: number, boxRatio: number): CropRect {
  let w = 1, h = 1
  const target = ratio / boxRatio
  if (target >= 1) h = 1 / target
  else w = target
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h }
}

/** Move or resize the crop for a handle drag (dx, dy normalised); ratio-locked when a preset is chosen. */
export function resizeCrop(start: CropRect, handle: Handle, dx: number, dy: number, ratio: number | null, boxRatio: number): CropRect {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return start
  if (handle === 'move') return { ...start, x: clamp(start.x + dx, 0, 1 - start.w), y: clamp(start.y + dy, 0, 1 - start.h) }
  let { x, y, w, h } = start
  const right = x + w, bottom = y + h
  if (handle.includes('w')) { const nx = clamp(x + dx, 0, right - MIN_CROP); w = right - nx; x = nx }
  if (handle.includes('e')) w = clamp(w + dx, MIN_CROP, 1 - x)
  if (handle.includes('n')) { const ny = clamp(y + dy, 0, bottom - MIN_CROP); h = bottom - ny; y = ny }
  if (handle.includes('s')) h = clamp(h + dy, MIN_CROP, 1 - y)
  if (ratio != null && handle.length === 2) {
    const normRatio = ratio / boxRatio
    h = w / normRatio
    if (handle.includes('n')) y = bottom - h
    if (y < 0) { y = 0; h = bottom; w = h * normRatio; if (handle.includes('w')) x = right - w }
    if (y + h > 1) { h = 1 - y; w = h * normRatio; if (handle.includes('w')) x = right - w }
    if (x < 0) x = 0
    if (x + w > 1) { w = 1 - x; h = w / normRatio }
  }
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1), w: clamp(w, MIN_CROP, 1), h: clamp(h, MIN_CROP, 1) }
}

export interface EditorState { aspect: AspectKey; crop: CropRect; rotation: number; flipH: boolean; flipV: boolean; zoom: number; frame: FrameKey }
export const initialEditor = (): EditorState => ({ aspect: 'free', crop: FULL_CROP, rotation: 0, flipH: false, flipV: false, zoom: 1, frame: 'none' })

/** Width/height of the image as displayed (after rotation). */
export const displayRatio = (width: number, height: number, rotation: number) => {
  if (!(width > 0) || !(height > 0)) return 1
  return rotation % 180 ? height / width : width / height
}
export function applyAspect(state: EditorState, key: AspectKey, boxRatio: number): EditorState {
  const def = ASPECTS.find(a => a.key === key)!
  return { ...state, aspect: key, crop: def.ratio == null ? FULL_CROP : centredCrop(def.ratio, boxRatio) }
}
/** Rotating changes the displayed shape: the crop starts again from the whole image (reference). */
export const rotate = (state: EditorState, by: number): EditorState => ({ ...state, rotation: (((state.rotation + by) % 360) + 360) % 360, crop: FULL_CROP, aspect: 'free' })
export const resetCrop = (state: EditorState): EditorState => ({ ...state, crop: FULL_CROP, aspect: 'free', zoom: 1 })
export const lockedRatio = (aspect: AspectKey) => ASPECTS.find(a => a.key === aspect)!.ratio
export const wantsCircle = (state: Pick<EditorState, 'aspect' | 'frame'>) => state.aspect === 'circle' || state.frame === 'circle'
export const isUnchanged = (state: EditorState) => state.rotation === 0 && !state.flipH && !state.flipV && state.zoom === 1 && state.frame === 'none' && state.aspect !== 'circle' && state.crop.x === 0 && state.crop.y === 0 && state.crop.w === 1 && state.crop.h === 1

/** The `editImage` settings for this editor state. A circle crop renders as the circle frame. */
export function toImageEdit(state: EditorState): ImageEdit {
  const { x, y, w, h } = state.crop
  return {
    rotation: ((((Math.round(state.rotation / 90) * 90) % 360) + 360) % 360) as ImageEdit['rotation'],
    zoom: clamp(state.zoom, 1, 3), flipX: state.flipH, flipY: state.flipV,
    x: clamp(x, 0, 1), y: clamp(y, 0, 1), width: clamp(w, MIN_CROP, 1 - clamp(x, 0, 1)), height: clamp(h, MIN_CROP, 1 - clamp(y, 0, 1)),
    frame: wantsCircle(state) ? 'circle' : state.frame,
  }
}
