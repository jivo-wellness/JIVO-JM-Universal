import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, Linking, PanResponder, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { createVoicePort } from '../modules/messenger/media/voice'
import { VoiceController } from '../modules/messenger/media/voiceController'
import { micMove, micRelease } from '../modules/messenger/media/voiceGesture'
import type { PickedFile } from '../modules/messenger/media/model'
import { clock } from '../modules/messenger/lib/text'
import { subscribeSensitiveView } from '../shared/sensitiveLifecycle'
import { useColors } from '../ui'
import { Icon } from './Icon'
import { touchBox } from '../shared/shellLayout'

const BARS = 36
const pointer = Platform.OS === 'web' ? ({ cursor: 'pointer' } as object) : null
export type VoiceMessage = ReturnType<typeof useVoiceMessage>

/**
 * Reference Composer voice flow: hold the microphone to record and let go to review; a short tap (or slide up, as in
 * WhatsApp) locks it hands-free; slide left to cancel. Review plays the recording back; nothing is sent without Send.
 * The controller owns the recorder and temporary file; this hook only adds the gesture and the live readings.
 */
export function useVoiceMessage({ disabled, onSend }: { disabled: boolean; onSend?: (file: PickedFile) => Promise<void> }) {
  const [voice] = useState(() => new VoiceController(createVoicePort))
  const state = useSyncExternalStore(voice.subscribe, voice.snapshot, voice.snapshot)
  const [locked, setLocked] = useState(false); const [slide, setSlide] = useState(0); const [lift, setLift] = useState(0); const [holding, setHolding] = useState(false)
  const [elapsed, setElapsed] = useState(0); const [levels, setLevels] = useState<number[]>([])
  const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const press = useRef<{ at: number; x: number; y: number } | null>(null); const lockedRef = useRef(false); const client = useRef(true)
  useEffect(() => { client.current = true; const off = subscribeSensitiveView(active => { if (!active && voice.snapshot().phase === 'recording') void voice.cancel() }); return () => { client.current = false; off(); void voice.cancel() } }, [voice])
  // Timer and live level while recording (10 readings a second); unmetered platforms draw a gentle idle wave.
  useEffect(() => {
    if (state.phase !== 'recording') return
    let tick = 0
    const timer = setInterval(() => { tick++; setElapsed(voice.elapsed()); const level = voice.level(); setLevels(v => [...v.slice(1 - BARS), level ?? 0.15 + 0.1 * Math.abs(Math.sin(tick / 2))]) }, 100)
    return () => clearInterval(timer)
  }, [state.phase, voice])
  /* Event handlers and the PanResponder callbacks: refs and the clock are read only during gestures and taps. */
  /* eslint-disable react-hooks/refs, react-hooks/purity */
  const reset = () => { press.current = null; lockedRef.current = false; setLocked(false); setSlide(0); setLift(0); setHolding(false) }
  const lock = () => { press.current = null; lockedRef.current = true; setLocked(true); setHolding(false); setSlide(0); setLift(0) }
  const start = (hold: boolean, x = 0, y = 0) => { if (disabled || busy || voice.snapshot().phase !== 'idle') return; setError(''); setElapsed(0); setLevels([]); press.current = hold ? { at: Date.now(), x, y } : null; if (!hold) lock(); setHolding(hold); void voice.start().then(() => { if (voice.snapshot().phase !== 'recording') reset() }) }
  const cancel = () => { reset(); setError(''); void voice.cancel() }
  const review = () => { reset(); void voice.stop() }
  const deliver = async (asset: PickedFile) => {
    if (!onSend || busy) return
    setBusy(true)
    try { await onSend(asset); await voice.cancel() }
    catch (e) { if (client.current) setError(e instanceof Error ? e.message : 'Could not send the voice message. Try again.') }
    finally { if (client.current) setBusy(false) }
  }
  /** Locked: Send stops and sends at once (WhatsApp); review: sends the checked recording. */
  const send = async () => {
    if (voice.snapshot().phase === 'recording') { reset(); await voice.stop() }
    const asset = voice.snapshot().asset
    if (asset) await deliver(asset)
  }
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled && !busy && voice.snapshot().phase === 'idle',
    // The offsets come from the press position, not gestureState: this responder is recreated on every render.
    onPanResponderGrant: e => start(true, e.nativeEvent.pageX, e.nativeEvent.pageY),
    onPanResponderMove: e => {
      if (!press.current || lockedRef.current) return
      const dx = e.nativeEvent.pageX - press.current.x; const dy = e.nativeEvent.pageY - press.current.y
      setSlide(Math.min(0, dx)); setLift(Math.min(0, dy))
      const move = micMove(dx, dy)
      if (move === 'cancel') cancel()
      else if (move === 'lock') lock()
    },
    onPanResponderRelease: () => finish(),
    onPanResponderTerminate: () => finish(),
    onPanResponderTerminationRequest: () => false,
  })
  const finish = () => {
    const at = press.current; press.current = null; setHolding(false); setSlide(0); setLift(0)
    if (!at) return
    const next = micRelease(Date.now() - at.at, voice.snapshot().phase, lockedRef.current)
    if (next === 'keep') lock()
    else if (next === 'review') review()
  }
  /* eslint-enable react-hooks/refs, react-hooks/purity */
  const mode = state.phase === 'review' && state.asset ? 'review' as const : state.phase === 'idle' ? 'idle' as const : locked ? 'locked' as const : 'holding' as const
  return { mode, phase: state.phase, asset: state.asset, durationMs: state.durationMs, locked, holding, slide, lift, elapsed, levels, busy, error: error || state.error, responder, start, cancel, review, send, dismiss: () => { setError(''); if (state.error) void voice.cancel() } }
}

/** The round microphone (reference: 40px primary; grows and turns red while held). Must stay mounted during the hold. */
export function MicButton({ voice, disabled }: { voice: VoiceMessage; disabled: boolean }) {
  const c = useColors(); const { width } = useWindowDimensions()
  const held = voice.mode === 'holding'
  return <View style={{ zIndex: 20 }}>
    {held && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: 'absolute', bottom: 56, alignSelf: 'center', left: 2, width: 40, paddingVertical: 10, borderRadius: 20, alignItems: 'center', gap: 6, backgroundColor: c.panel, borderWidth: 1, borderColor: c.border, transform: [{ translateY: Math.max(-60, voice.lift / 2) }] }}>
      <Icon name="lock" size={18} color={voice.lift < -30 ? c.brand : c.muted} />
      <Icon name="chevronUp" size={16} color={c.muted} />
    </View>}
    <View {...voice.responder.panHandlers} accessible accessibilityRole="button" accessibilityLabel={voice.mode === 'idle' ? 'Hold to record a voice message' : 'Release to stop recording'} accessibilityHint="Double-tap to record hands-free" accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'activate', label: 'Start recording' }]} onAccessibilityAction={() => { if (!disabled) voice.start(false) }} style={[touchBox(40, width), pointer]}>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: held ? c.dangerFill : c.primary, opacity: disabled ? 0.5 : 1, transform: [{ scale: held ? 1.25 : 1 }] }}><Icon name="mic" size={20} color="#ffffff" /></View>
    </View>
  </View>
}

function Waveform({ levels, color }: { levels: number[]; color: string }) {
  const bars = levels.length ? levels : Array(BARS).fill(0)
  return <View accessible={false} style={{ flex: 1, minWidth: 0, height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, overflow: 'hidden' }}>
    {bars.map((level, i) => <View key={i} style={{ width: 3, height: Math.max(3, Math.round(3 + level * 19)), borderRadius: 2, backgroundColor: color }} />)}
  </View>
}

/** Reference RecordingBar: replaces the message box while recording (delete, red dot, time, slide hint or level, stop). */
export function RecordingBar({ voice }: { voice: VoiceMessage }) {
  const c = useColors()
  const preparing = voice.phase === 'preparing' || voice.phase === 'stopping'
  const dot = Math.round(8 + 6 * (voice.levels.at(-1) ?? 0))
  return <View accessibilityRole={Platform.OS === 'web' ? ('status' as never) : undefined} accessibilityLabel="Recording a voice message" style={{ flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 26, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 8 }}>
    {voice.locked ? <Pressable accessibilityRole="button" accessibilityLabel="Delete recording" onPress={voice.cancel} hitSlop={6} style={[{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, pointer]}><Icon name="trash2" size={20} color={c.danger} /></Pressable>
      : <View style={{ width: 8 }} />}
    {/* The red dot breathes with the input level. */}
    <View style={{ width: 14, alignItems: 'center' }}><View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: c.danger }} /></View>
    <Text accessibilityLabel="Recording time" style={{ color: c.text, fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'], minWidth: 36 }}>{clock(voice.elapsed)}</Text>
    {preparing ? <View style={{ flex: 1, alignItems: 'flex-start' }}><ActivityIndicator size="small" color={c.muted} /></View>
      : voice.locked ? <Waveform levels={voice.levels} color={c.muted} />
        : <Text numberOfLines={1} style={{ flex: 1, minWidth: 0, color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', transform: [{ translateX: voice.slide }], opacity: Math.max(0.3, 1 + voice.slide / 120) }}>{'‹  Slide to cancel'}</Text>}
    {voice.locked && <Pressable accessibilityRole="button" accessibilityLabel="Stop recording" onPress={voice.review} disabled={voice.phase !== 'recording'} hitSlop={6} style={[{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: c.danger, alignItems: 'center', justifyContent: 'center' }, pointer]}><View style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: c.danger }} /></Pressable>}
  </View>
}

/** Reference VoiceReview: listen before sending (play/pause, seek on the bar, time), or delete. */
export function VoiceReview({ voice, disabled }: { voice: VoiceMessage; disabled: boolean }) {
  const c = useColors()
  const player = useAudioPlayer(voice.asset ? { uri: voice.asset.uri } : null); const status = useAudioPlayerStatus(player)
  const [track, setTrack] = useState(0)
  const durationMs = status.duration > 0 ? status.duration * 1000 : voice.durationMs
  const position = status.currentTime * 1000
  const progress = durationMs ? Math.min(1, position / durationMs) : 0
  const toggle = () => { if (status.playing) player.pause(); else { if (status.didJustFinish || (durationMs && position >= durationMs - 50)) void player.seekTo(0); player.play() } }
  return <View accessibilityLabel="Voice message ready to send" style={{ flex: 1, minWidth: 0, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 26, borderWidth: 1, borderColor: c.border, backgroundColor: c.panel, paddingHorizontal: 6 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Delete recording" disabled={disabled} onPress={voice.cancel} hitSlop={6} style={[{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }, pointer]}><Icon name="trash2" size={20} color={c.danger} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause' : 'Listen'} onPress={toggle} style={[{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.successSoft }, pointer]}><View style={{ marginLeft: status.playing ? 0 : 2 }}><Icon name={status.playing ? 'pause' : 'play'} size={16} color={c.brand} /></View></Pressable>
    <Pressable accessibilityRole="adjustable" accessibilityLabel="Playback position" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} onLayout={e => setTrack(e.nativeEvent.layout.width)}
      onPress={e => { if (track && durationMs) void player.seekTo(Math.max(0, Math.min(1, e.nativeEvent.locationX / track)) * durationMs / 1000) }} style={[{ flex: 1, minWidth: 0, height: 32, justifyContent: 'center' }, pointer]}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }} />
      <View style={{ position: 'absolute', left: 0, height: 4, width: `${progress * 100}%`, borderRadius: 2, backgroundColor: c.brand }} />
      <View style={{ position: 'absolute', left: `${progress * 100}%`, marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: c.brand }} />
    </Pressable>
    <Text style={{ width: 40, textAlign: 'right', color: c.muted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] }}>{clock(status.playing || position > 0 ? position : durationMs)}</Text>
  </View>
}

/** Recorder problems (permission, too large, cleanup) above the composer row, with Settings when access was refused. */
export function VoiceNotice({ voice }: { voice: VoiceMessage }) {
  const c = useColors()
  if (!voice.error) return null
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 6 }}>
    <Text accessibilityRole="alert" style={{ flex: 1, color: c.danger, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 }}>{voice.error}</Text>
    {voice.error.toLowerCase().includes('permission') && <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => { void Linking.openSettings().catch(() => {}) }} hitSlop={8} style={pointer}><Text style={{ color: c.brand, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Settings</Text></Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={voice.dismiss} hitSlop={8} style={pointer}><Icon name="x" size={16} color={c.muted} /></Pressable>
  </View>
}
