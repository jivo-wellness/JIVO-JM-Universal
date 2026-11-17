import { describe, expect, it } from 'vitest'
import { FULL_CROP, applyAspect, centredCrop, displayRatio, initialEditor, isUnchanged, resizeCrop, rotate, toImageEdit } from './crop'
import { cropPixels } from './model'

describe('reference ImageEditor crop geometry', () => {
  it('centres the largest crop of a preset ratio', () => {
    expect(centredCrop(1, 2)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
    const wide = centredCrop(16 / 9, 1)
    expect(wide.w).toBe(1); expect(wide.h).toBeCloseTo(9 / 16); expect(wide.y).toBeCloseTo((1 - 9 / 16) / 2)
  })
  it('moves inside the image and resizes free crops from edges and corners', () => {
    const start = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }
    expect(resizeCrop(start, 'move', 0.6, -0.6, null, 1)).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 })
    expect(resizeCrop(start, 'e', 0.1, 0, null, 1)).toMatchObject({ x: 0.2, w: 0.6, h: 0.5 })
    const nw = resizeCrop(start, 'nw', -0.1, -0.1, null, 1)
    expect(nw.x).toBeCloseTo(0.1); expect(nw.y).toBeCloseTo(0.1); expect(nw.w).toBeCloseTo(0.6); expect(nw.h).toBeCloseTo(0.6)
    expect(resizeCrop(start, 'w', 0.9, 0, null, 1).w).toBeGreaterThanOrEqual(0.06)
  })
  it('keeps the ratio on corner drags of a locked preset', () => {
    const box = 2 // a 2:1 image
    const square = centredCrop(1, box)
    const next = resizeCrop(square, 'se', -0.1, 0, 1, box)
    expect((next.w * box) / next.h).toBeCloseTo(1)
    expect(next.x + next.w).toBeLessThanOrEqual(1); expect(next.y + next.h).toBeLessThanOrEqual(1)
  })
  it('restarts the crop when rotating and when choosing Free', () => {
    let state = applyAspect(initialEditor(), '1:1', 1.5)
    expect(state.crop).not.toEqual(FULL_CROP)
    state = rotate(state, -90)
    expect(state).toMatchObject({ rotation: 270, crop: FULL_CROP, aspect: 'free' })
    expect(rotate(state, 90).rotation).toBe(0)
    expect(applyAspect(state, 'free', 1).crop).toEqual(FULL_CROP)
    expect(displayRatio(400, 200, 90)).toBe(0.5)
  })
  it('hands editImage valid settings; a circle crop is the circle frame', () => {
    const state = { ...applyAspect(initialEditor(), 'circle', 4 / 3), flipH: true, zoom: 1.5 }
    const edit = toImageEdit(state)
    expect(edit).toMatchObject({ frame: 'circle', flipX: true, flipY: false, zoom: 1.5, rotation: 0 })
    expect(() => cropPixels(400, 300, edit)).not.toThrow()
    expect(isUnchanged(initialEditor())).toBe(true)
    expect(isUnchanged(state)).toBe(false)
  })
})
