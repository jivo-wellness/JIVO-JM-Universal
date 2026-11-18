import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useEvent } from 'expo'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useVideoPlayer, VideoView } from 'expo-video'
import type { Attachment } from '../modules/messenger/api'
import { mediaUrl } from '../modules/messenger/media/url'
import { errorMessage, origin } from '../core/api/client'
import { authenticatedMediaSource, type MediaSource } from '../modules/messenger/media/source'
import { useResource } from '../shared/useResource'
import { subscribeLifecycle } from '../core/realtime/lifecycle'
import { Button, Label, useColors } from '../ui'
import { Icon } from './Icon'
import { Sheet } from './Sheet'
let pauseCurrentAudio: (() => void) | undefined
function AudioPlayback({ source, inline = false }: { source: MediaSource; inline?: boolean }) {
  const c = useColors(); const player = useAudioPlayer(source, { crossOrigin: 'use-credentials', downloadFirst: false, updateInterval: 250 }); const status = useAudioPlayerStatus(player)
  useEffect(() => subscribeLifecycle(active => { if (!active) player.pause() }), [player])
  const started = useRef(false)
  const pause = useCallback(() => player.pause(), [player])
  const play = useCallback(() => { pauseCurrentAudio?.(); pauseCurrentAudio = pause; player.play() }, [player, pause])
  useEffect(() => () => { if (pauseCurrentAudio === pause) pauseCurrentAudio = undefined }, [pause])
  useEffect(() => { if (inline && status.isLoaded && !started.current) { started.current = true; play() } }, [inline, status.isLoaded, play])
  const [trackWidth, setTrackWidth] = useState(0)
  const [rate, setRate] = useState(1)
  const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
  const seek = (to: number) => void player.seekTo(Math.max(0, Math.min(status.duration || 0, to))).catch(() => {})
  return <View style={{ gap: 8, paddingVertical: 4, ...(inline ? { width: 250, maxWidth: '100%' as const } : {}) }}>
    {!status.isLoaded && !status.error && <ActivityIndicator accessibilityLabel="Loading audio" />}
    {status.error ? <Text accessibilityRole="alert" style={{ color: c.danger }}>Unable to play this audio. Check your connection and reopen it.</Text> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause audio' : 'Play audio'} disabled={!status.isLoaded} onPress={() => { if (status.playing) player.pause(); else if (status.didJustFinish) void player.seekTo(0).then(play).catch(() => {}); else play() }} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}><Icon name={status.playing ? 'pause' : 'play'} size={24} color="#ffffff" /></Pressable>
        <View style={{ flex: 1 }}><Pressable accessibilityRole="adjustable" accessibilityLabel="Audio position" accessibilityValue={{ min: 0, max: Math.floor(status.duration || 0), now: Math.floor(status.currentTime || 0) }} accessibilityActions={[{name:'increment',label:'Forward 10 seconds'},{name:'decrement',label:'Back 10 seconds'}]} onAccessibilityAction={e => seek(status.currentTime + (e.nativeEvent.actionName === 'increment' ? 10 : -10))} onPress={e => { if (trackWidth > 0) seek(e.nativeEvent.locationX / trackWidth * status.duration) }} onLayout={e => setTrackWidth(e.nativeEvent.layout.width)} style={{ height: 36, justifyContent: 'center' }}><View style={{ height: 5, borderRadius: 3, backgroundColor: c.border }}><View style={{ height: 5, borderRadius: 3, backgroundColor: c.brand, width: `${Math.min(100, status.duration ? status.currentTime / status.duration * 100 : 0)}%` }} /></View></Pressable><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>{time(status.currentTime || 0)}</Label><Label>{time(status.duration || 0)}</Label></View></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Playback speed ${rate} times`} disabled={!status.isLoaded} onPress={() => { const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1; setRate(next); player.setPlaybackRate(next) }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.neutral }}><Label>{rate}x</Label></Pressable>
      </View>
    </>}
  </View>
}
function VideoPlayback({ source }: { source: MediaSource }) {
  const c = useColors(); const player = useVideoPlayer({ ...source, useCaching: false }, value => { value.loop = false; value.staysActiveInBackground = false; value.showNowPlayingNotification = false })
  const status = useEvent(player, 'statusChange', { status: player.status })
  useEffect(() => subscribeLifecycle(active => { if (!active) player.pause() }), [player])
  return <View style={{ gap: 12 }}><VideoView player={player} nativeControls crossOrigin="use-credentials" contentFit="contain" fullscreenOptions={{ enable: true }} style={{ width: '100%', aspectRatio: 16 / 9 }} />{status.status === 'loading' && <ActivityIndicator accessibilityLabel="Loading video" />}{status.status === 'error' && <Text accessibilityRole="alert" style={{ color: c.text }}>Unable to play this video. Check your connection and file access, then reopen it.</Text>}</View>
}
export function MediaPlayback({ attachment, onClose }: { attachment: Attachment; onClose: () => void }) {
  const uri = attachment.status === 'ready' ? mediaUrl(attachment.preview_url || attachment.download_url, origin) : null
  const load = useCallback(() => uri ? authenticatedMediaSource(uri) : Promise.resolve(null), [uri]); const resource = useResource(load)
  return <Sheet bottomAligned visible closeLabel="Close media" title={attachment.name} onClose={onClose}>
    {!uri ? <Label>This media is unavailable.</Label> : resource.loading ? <ActivityIndicator accessibilityLabel="Loading media session" /> : resource.error ? <><Label>{errorMessage(resource.error)}</Label><Button title="Retry media" onPress={resource.refresh} /></> : resource.value ? attachment.kind === 'video' ? <VideoPlayback source={resource.value} /> : <AudioPlayback source={resource.value} /> : null}
    </Sheet>
}

/** A chat video as a page of the full-screen media viewer: fills the page, plays only when the person presses play. */
export function ViewerVideo({ attachment }: { attachment: Attachment }) {
  const uri = attachment.status === 'ready' ? mediaUrl(attachment.preview_url || attachment.download_url, origin) : null
  const load = useCallback(() => uri ? authenticatedMediaSource(uri) : Promise.resolve(null), [uri]); const resource = useResource(load)
  const note = (text: string) => <Text accessibilityRole="alert" style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center', padding: 24 }}>{text}</Text>
  return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#000000' }}>
    {!uri ? note('This video is unavailable.') : resource.loading ? <ActivityIndicator accessibilityLabel="Loading video" color="#ffffff" /> : resource.error ? note(errorMessage(resource.error)) : resource.value ? <ViewerVideoPlayer source={resource.value} /> : null}
  </View>
}
function ViewerVideoPlayer({ source }: { source: MediaSource }) {
  const player = useVideoPlayer({ ...source, useCaching: false }, value => { value.loop = false; value.staysActiveInBackground = false; value.showNowPlayingNotification = false })
  const status = useEvent(player, 'statusChange', { status: player.status })
  useEffect(() => subscribeLifecycle(active => { if (!active) player.pause() }), [player])
  return <View style={{ flex: 1, justifyContent: 'center' }}>
    <VideoView player={player} nativeControls crossOrigin="use-credentials" contentFit="contain" fullscreenOptions={{ enable: true }} style={{ width: '100%', height: '100%' }} />
    {status.status === 'loading' && <ActivityIndicator accessibilityLabel="Loading video" color="#ffffff" style={{ position: 'absolute', alignSelf: 'center' }} />}
    {status.status === 'error' && <Text accessibilityRole="alert" style={{ position: 'absolute', alignSelf: 'center', color: '#ffffff', fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', padding: 24 }}>Unable to play this video. Check your connection and file access, then reopen it.</Text>}
  </View>
}

/** Resolve authenticated audio only when tapped; keep playback inside the bubble. */
export function InlineAudio({ attachment }: { attachment: Attachment }) {
 const c = useColors(); const [active, setActive] = useState(false)
 if (active) return <InlineAudioSource attachment={attachment} />
 const seconds = Math.round((attachment.duration_ms ?? 0) / 1000)
 return <Pressable accessibilityRole="button" accessibilityLabel={`Play voice message ${attachment.name}`} onPress={() => setActive(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: 250, maxWidth: '100%', minHeight: 48 }}>
  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={20} color="#ffffff" /></View>
  <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: c.border }} />
  <Text style={{ color: c.muted, fontSize: 12 }}>{seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Voice'}</Text>
 </Pressable>
}
function InlineAudioSource({ attachment }: { attachment: Attachment }) {
 const uri = mediaUrl(attachment.preview_url || attachment.download_url, origin)
 const load = useCallback(() => uri ? authenticatedMediaSource(uri) : Promise.resolve(null), [uri]); const resource = useResource(load)
 return resource.loading ? <ActivityIndicator accessibilityLabel="Loading audio" /> : resource.error ? <Pressable accessibilityRole="button" accessibilityLabel="Retry audio" onPress={resource.refresh}><Label>Audio unavailable. Tap to retry.</Label></Pressable> : resource.value ? <AudioPlayback source={resource.value} inline /> : <Label>Audio unavailable.</Label>
}
