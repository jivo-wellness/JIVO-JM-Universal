import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, PanResponder, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native'
import type { PickedFile } from '../../modules/messenger/media/model'
import { ASPECTS, FRAMES, applyAspect, displayRatio, initialEditor, isUnchanged, lockedRatio, resetCrop, resizeCrop, rotate, toImageEdit, wantsCircle, type EditorState, type Handle } from '../../modules/images/crop'
import { editImage, framesNeedRender } from '../../modules/images/edit'
import { errorMessage } from '../../core/api/client'
import { Button, useColors } from '../../ui'
import { ImageFrame } from '../ImageFrame'
import { AttachPage, Chip, SectionTitle, ToolButton } from './AttachPage'

/**
 * Reference ImageEditor as a full-screen page: the whole image with a movable crop box (drag inside to move, drag a
 * handle to resize; Free also has edge handles, presets lock the ratio), crop presets incl. Circle, zoom, flip and
 * 90° rotation, frames, then Reset / Cancel / Apply changes. The result is rendered from the original image.
 */
export function ImageEditorPage({ asset, onApply, onCancel, title = 'Edit image' }: { asset: PickedFile; onApply: (file: PickedFile) => void; onCancel: () => void; title?: string }) {
  const c = useColors(); const { height: screen } = useWindowDimensions()
  const [state, setState] = useState<EditorState>(initialEditor)
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [area, setArea] = useState({ width: 0, height: 0 })
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [frameJob, setFrameJob] = useState<{ asset: PickedFile; frame: EditorState['frame']; token: number } | null>(null)
  const generation = useRef(0)
  useEffect(() => { let alive = true; Image.getSize(asset.uri, (width, height) => { if (alive) setNatural({ width, height }) }, () => { if (alive) setFailed(true) }); return () => { alive = false } }, [asset.uri])
  useEffect(() => () => { generation.current++ }, [])
  useEffect(() => () => { void Promise.resolve(frameJob?.asset.dispose?.()).catch(() => {}) }, [frameJob])
  const ratio = natural ? displayRatio(natural.width, natural.height, state.rotation) : 1
  const circle = wantsCircle(state)

  async function apply() {
    if (busy || !natural) return
    if (isUnchanged(state)) { onCancel(); return }
    const token = ++generation.current; setBusy(true); setError('')
    let deferred = false
    try {
      const edit = toImageEdit(state)
      const output = await editImage(asset, framesNeedRender ? { ...edit, frame: 'none' } : edit)
      if (token !== generation.current) { await output.dispose?.(); return }
      if (framesNeedRender && edit.frame !== 'none') { deferred = true; setFrameJob({ asset: output, frame: edit.frame, token }); return }
      onApply(output)
    } catch (e) { if (token === generation.current) setError(errorMessage(e)) }
    finally { if (!deferred && token === generation.current) setBusy(false) }
  }
  const cancel = () => { generation.current++; onCancel() }
  const previewHeight = Math.max(220, Math.round(screen * 0.46))

  return <AttachPage title={title} onBack={cancel} backIcon="x" backLabel="Close editor"
    footer={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ToolButton label="Reset" icon="undo2" disabled={busy} onPress={() => setState(initialEditor())} accessibilityLabel="Reset all edits" />
      <View style={{ flex: 1 }} />
      <Button title="Cancel" variant="secondary" disabled={busy} onPress={cancel} />
      <Button title={busy ? 'Applying…' : 'Apply changes'} loading={busy} disabled={!natural} onPress={() => void apply()} />
    </View>}>
    <View onLayout={(e: LayoutChangeEvent) => setArea({ width: e.nativeEvent.layout.width, height: previewHeight })} style={{ height: previewHeight, margin: 12, borderRadius: 12, backgroundColor: c.dark ? '#0f172a' : '#e5e7eb', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {frameJob ? <ImageFrame asset={frameJob.asset} frame={frameJob.frame} onDone={file => { if (frameJob.token === generation.current) onApply(file); else void file.dispose?.(); setFrameJob(null); setBusy(false) }} onError={e => { setError(errorMessage(e)); setFrameJob(null); setBusy(false) }} />
        : natural && area.width > 0 ? <CropStage uri={asset.uri} natural={natural} state={state} ratio={ratio} circle={circle} maxWidth={area.width - 40} maxHeight={area.height - 40} disabled={busy} onCrop={crop => setState(s => ({ ...s, crop }))} />
          : <Text style={{ color: c.muted, fontSize: 14 }}>{failed ? 'This image cannot be opened.' : 'Loading…'}</Text>}
      {busy && !frameJob && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}><ActivityIndicator color="#ffffff" accessibilityLabel="Applying changes" /></View>}
    </View>
    {!!error && <Text accessibilityRole="alert" style={{ color: c.danger, fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 }}>{error}</Text>}
    <View style={{ paddingHorizontal: 16, gap: 20 }}>
      <View>
        <SectionTitle icon="crop">Crop</SectionTitle>
        <View accessibilityRole="radiogroup" accessibilityLabel="Crop shape" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ASPECTS.map(a => <Chip key={a.key} label={a.label} accessibilityLabel={`Crop ${a.label}`} icon={a.key === 'circle' ? 'circle' : undefined} selected={state.aspect === a.key} disabled={busy || !natural} onPress={() => setState(s => applyAspect(s, a.key, ratio))} />)}
        </View>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginTop: 8 }}>Drag the box to move it, or drag a handle to resize. Free crops any shape; presets lock the ratio.</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 12, marginBottom: 4 }}>Zoom</Text>
        <Slider label="Zoom" value={state.zoom} min={1} max={3} step={0.01} disabled={busy} onChange={zoom => setState(s => ({ ...s, zoom }))} />
        <ToolButton label="Reset crop" icon="undo2" disabled={busy} onPress={() => setState(resetCrop)} style={{ marginTop: 8 }} />
      </View>
      <View>
        <SectionTitle>Flip & rotate</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <ToolButton style={{ flex: 1 }} label="Flip H" icon="flipHorizontal2" accessibilityLabel="Flip horizontally" active={state.flipH} disabled={busy} onPress={() => setState(s => ({ ...s, flipH: !s.flipH }))} />
          <ToolButton style={{ flex: 1 }} label="Flip V" icon="flipVertical2" accessibilityLabel="Flip vertically" active={state.flipV} disabled={busy} onPress={() => setState(s => ({ ...s, flipV: !s.flipV }))} />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
          <ToolButton style={{ flex: 1 }} label="Left" icon="rotateCcw" accessibilityLabel="Rotate left" disabled={busy} onPress={() => setState(s => rotate(s, -90))} />
          <ToolButton style={{ flex: 1 }} label="Right" icon="rotateCw" accessibilityLabel="Rotate right" disabled={busy} onPress={() => setState(s => rotate(s, 90))} />
        </View>
        <ToolButton label="Reset rotation" icon="undo2" disabled={busy} onPress={() => setState(s => rotate(s, -s.rotation))} />
      </View>
      <View>
        <SectionTitle icon="square">Frames</SectionTitle>
        <View accessibilityRole="radiogroup" accessibilityLabel="Frame" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FRAMES.map(f => <Chip key={f.key} label={f.label} accessibilityLabel={`Frame ${f.label}`} icon={f.key === 'circle' ? 'circle' : undefined} selected={state.frame === f.key} disabled={busy} onPress={() => setState(s => ({ ...s, frame: f.key }))} />)}
        </View>
      </View>
    </View>
  </AttachPage>
}

const HANDLES: Handle[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w']
/** The whole (rotated, flipped, zoomed) image with the crop box over it. */
function CropStage({ uri, state, ratio, circle, maxWidth, maxHeight, disabled, onCrop }: { uri: string; natural: { width: number; height: number }; state: EditorState; ratio: number; circle: boolean; maxWidth: number; maxHeight: number; disabled: boolean; onCrop: (crop: EditorState['crop']) => void }) {
  const width = Math.max(1, Math.min(maxWidth, maxHeight * ratio)), height = width / ratio
  const swap = state.rotation % 180 !== 0
  const live = useRef({ state, width, height, ratio, onCrop, disabled }); useEffect(() => { live.current = { state, width, height, ratio, onCrop, disabled } })
  const start = useRef(state.crop)
  /* eslint-disable react-hooks/refs -- PanResponder stores these callbacks; refs are read only while a drag runs */
  const responders = useMemo(() => Object.fromEntries((['move', ...HANDLES] as Handle[]).map(handle => [handle, PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled,
    onMoveShouldSetPanResponder: () => !live.current.disabled,
    onPanResponderGrant: () => { start.current = live.current.state.crop },
    onPanResponderMove: (_e, g) => { const v = live.current; v.onCrop(resizeCrop(start.current, handle, g.dx / v.width, g.dy / v.height, lockedRatio(v.state.aspect), v.ratio)) },
    onPanResponderTerminationRequest: () => false,
  })])) as Record<Handle, ReturnType<typeof PanResponder.create>>, [])
  /* eslint-enable react-hooks/refs */
  const { x, y, w, h } = state.crop
  const free = lockedRatio(state.aspect) == null
  const dim = 'rgba(0,0,0,0.45)'
  return <View accessibilityLabel="Image preview" style={{ width, height }}>
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: 6 }}>
    <Image source={{ uri }} accessible={false} resizeMode="stretch" style={{ position: 'absolute', width: swap ? height : width, height: swap ? width : height, left: swap ? (width - height) / 2 : 0, top: swap ? (height - width) / 2 : 0, transform: [{ scaleX: state.flipH ? -1 : 1 }, { scaleY: state.flipV ? -1 : 1 }, { rotate: `${state.rotation}deg` }, { scale: state.zoom }] }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: y * height, backgroundColor: dim }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (y + h) * height, bottom: 0, backgroundColor: dim }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, width: x * width, top: y * height, height: h * height, backgroundColor: dim }} />
    <View pointerEvents="none" style={{ position: 'absolute', left: (x + w) * width, right: 0, top: y * height, height: h * height, backgroundColor: dim }} />
    </View>
    <View accessibilityLabel="Crop box" {...responders.move.panHandlers} style={{ position: 'absolute', left: x * width, top: y * height, width: w * width, height: h * height, borderWidth: 2, borderColor: '#16a34a', borderRadius: circle ? 9999 : 2, ...({ cursor: 'move', touchAction: 'none' } as object) }}>
      {!circle && [1, 2].map(i => <View key={'v' + i} pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i * 100) / 3}%`, width: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />)}
      {!circle && [1, 2].map(i => <View key={'h' + i} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: `${(i * 100) / 3}%`, height: 1, backgroundColor: 'rgba(255,255,255,0.4)' }} />)}
      {HANDLES.filter(handle => free || handle.length === 2).map(handle => <View key={handle} accessibilityLabel={`Crop ${handle} handle`} {...responders[handle].panHandlers}
        style={{ position: 'absolute', width: 32, height: 32, alignItems: 'center', justifyContent: 'center', ...(handle.includes('n') ? { top: -16 } : handle.includes('s') ? { bottom: -16 } : { top: '50%', marginTop: -16 }), ...(handle.includes('w') ? { left: -16 } : handle.includes('e') ? { right: -16 } : { left: '50%', marginLeft: -16 }), ...({ touchAction: 'none' } as object) }}>
        <View pointerEvents="none" style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#16a34a', backgroundColor: '#ffffff' }} />
      </View>)}
    </View>
  </View>
}

/** A horizontal range control (the reference `<input type="range">`), adjustable by drag, tap and accessibility actions. */
export function Slider({ label, value, min, max, step, onChange, disabled = false }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; disabled?: boolean }) {
  const c = useColors(); const [width, setWidth] = useState(1)
  const live = useRef({ width, onChange, min, max, step, disabled }); useEffect(() => { live.current = { width, onChange, min, max, step, disabled } })
  const set = (x: number) => { const v = live.current; const raw = v.min + Math.max(0, Math.min(1, x / v.width)) * (v.max - v.min); v.onChange(Math.round(raw / v.step) * v.step) }
  const origin = useRef(0)
  // eslint-disable-next-line react-hooks/refs
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled,
    onMoveShouldSetPanResponder: () => !live.current.disabled,
    onPanResponderGrant: e => { origin.current = e.nativeEvent.locationX; set(origin.current) },
    onPanResponderMove: (_e, g) => set(origin.current + g.dx),
    onPanResponderTerminationRequest: () => false,
  }), [])
  const fraction = (value - min) / (max - min)
  const nudge = (by: number) => onChange(Math.max(min, Math.min(max, Math.round((value + by) * 100) / 100)))
  return <View accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min, max, now: Math.round(value * 100) / 100, text: `${value.toFixed(2)}×` }}
    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={e => nudge(e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1)}
    onLayout={e => setWidth(Math.max(1, e.nativeEvent.layout.width))} {...pan.panHandlers} style={{ height: 36, justifyContent: 'center', opacity: disabled ? 0.5 : 1, ...({ touchAction: 'none', cursor: 'pointer' } as object) }}>
    <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: c.subtle }}><View style={{ width: `${fraction * 100}%`, height: 4, borderRadius: 2, backgroundColor: c.primary }} /></View>
    <View pointerEvents="none" style={{ position: 'absolute', left: Math.max(0, fraction * width - 11), width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffffff', borderWidth: 2, borderColor: c.primary, boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
  </View>
}
