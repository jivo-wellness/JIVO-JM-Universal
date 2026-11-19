/* Refs are read only by event callbacks passed to the button renderer. */
/* eslint-disable react-hooks/refs */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, FlatList, Image, Linking, Modal, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera'
import * as Library from 'expo-media-library/legacy'
import { File, Paths } from 'expo-file-system'
import { randomUUID } from 'expo-crypto'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { pickMedia } from '../modules/messenger/media/gallery'
import type { PickedFile } from '../modules/messenger/media/model'
import { Icon, type IconName } from './Icon'
export function CameraCapture({ limit, onDone }: { limit: number; onDone: (files: PickedFile[]) => void }) {
 const camera = useRef<CameraView>(null); const alive = useRef(true); const busyRef = useRef(false)
 const [permission, requestPermission] = useCameraPermissions(); const [assets, setAssets] = useState<Library.Asset[]>([])
 const [error, setError] = useState('')
 const cursor = useRef<string | undefined>(undefined); const more = useRef(true); const loadingAssets = useRef(false)
 const [loadingGallery, setLoadingGallery] = useState(false)
 const loadAssets = useCallback(async () => {
  if (loadingAssets.current || !more.current) return
  loadingAssets.current = true; setLoadingGallery(true)
  try { const page = await Library.getAssetsAsync({ first: 60, after: cursor.current, mediaType: [Library.MediaType.photo, Library.MediaType.video], sortBy: [[Library.SortBy.creationTime, false]] }); if (alive.current) { cursor.current = page.endCursor; more.current = page.hasNextPage; setAssets(old => [...new Map([...old, ...page.assets].map(a => [a.id, a])).values()]) } }
  catch { if (alive.current) setError('Could not load recent photos. Open the device gallery or try again.') }
  finally { loadingAssets.current = false; if (alive.current) setLoadingGallery(false) }
 }, [])
 const [grid, setGrid] = useState(false); const [chosen, setChosen] = useState<Library.Asset[]>([]); const [busy, setBusy] = useState(false)
 const [front, setFront] = useState(false); const [flash, setFlash] = useState(false); const [ready, setReady] = useState(false); const [active, setActive] = useState(true)
 const [mic, requestMic] = useMicrophonePermissions()
 const [mode, setMode] = useState<'picture' | 'video'>('picture')
 const [recording, setRecording] = useState(false)
 const [seconds, setSeconds] = useState(0)
 useEffect(() => { if (!recording) return; const started = Date.now(); const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250); return () => clearInterval(timer) }, [recording])
 const cancelled = useRef(false); const holding = useRef(false); const recorded = useRef(false); const starting = useRef(false)
 const openGallery = () => { if (!busyRef.current) { if (assets.length) setGrid(true); else void finish(() => pickMedia(limit)) } }
 const swipe = PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => !busyRef.current && g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx), onPanResponderRelease: (_, g) => { if (g.dy < -40) openGallery() } })
 const inset = useSafeAreaInsets(); const { width } = useWindowDimensions()
 useEffect(() => { alive.current = true; const listener = AppState.addEventListener('change', state => { setActive(state === 'active'); if (state !== 'active' && busyRef.current) { cancelled.current = true; camera.current?.stopRecording() } }); return () => { alive.current = false; cancelled.current = true; listener.remove() } }, [])
 useEffect(() => { void requestPermission().then(p => p.granted ? Library.requestPermissionsAsync(false, ['photo', 'video']) : null).then(async p => { if (!p?.granted) return; await loadAssets() }).catch(() => {} ) }, [requestPermission, loadAssets])
 const finish = async (job: () => Promise<PickedFile[]>) => {
  if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(''); cancelled.current = false
  try { const files = await job(); if (alive.current && !cancelled.current) { if (files.length) onDone(files) } else for (const file of files) await file.dispose?.() }
  catch { if (alive.current) setError('Could not open this media. Please try again or choose from device.') }
  finally { busyRef.current = false; if (alive.current) setBusy(false) }
 }
 const copy = async (uri: string, name: string): Promise<PickedFile> => { const target = new File(Paths.cache, randomUUID() + '-' + name.replace(/[^a-z0-9._-]/gi, '_')); try { await new File(uri).copy(target) } catch (e) { if (target.exists) target.delete(); throw e } return { uri: target.uri, name, size: target.size, mime: /\.(mp4|mov)$/i.test(name) ? (/mov$/i.test(name) ? 'video/quicktime' : 'video/mp4') : /png$/i.test(name) ? 'image/png' : /heic$/i.test(name) ? 'image/heic' : 'image/jpeg', dispose: () => { if (target.exists) target.delete() } } }
 const select = (values: Library.Asset[]) => void finish(async () => { const files: PickedFile[] = []; try { for (const value of values) { const info = await Library.getAssetInfoAsync(value); files.push(await copy(info.localUri || info.uri, info.filename)) } return files } catch (e) { for (const file of files) await file.dispose?.(); throw e } })
 const beginVideo = async () => {
  recorded.current = true
  const granted = mic?.granted || (await requestMic()).granted
  if (!granted) { setError('Allow microphone access to record video with sound.'); return }
  if (!holding.current || !alive.current) return
  starting.current = true; setReady(false); setMode('video')
 }
 const cameraReady = () => {
  setReady(true)
  if (!starting.current) return
  starting.current = false
  if (!holding.current) { setMode('picture'); return }
  setSeconds(0); setRecording(true)
  void finish(async () => {
   try {
    const video = await camera.current?.recordAsync({ maxDuration: 60 })
    if (!video) return []
    const file = await copy(video.uri, 'camera-video.mp4')
    const original = new File(video.uri); if (video.uri.startsWith(Paths.cache.uri) && original.exists) original.delete()
    return [file]
   } finally { if (alive.current) { setRecording(false); setMode('picture') } }
  })
 }
 const button = (icon: IconName, label: string, action: () => void) => <Pressable accessibilityLabel={label} disabled={busy} onPress={action} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#00000066', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={26} color="white" /></Pressable>
 return <Modal visible onRequestClose={() => { cancelled.current = true; camera.current?.stopRecording(); if (grid) setGrid(false); else onDone([]) }} presentationStyle="fullScreen"><View style={{ flex: 1, backgroundColor: '#000', paddingTop: inset.top, paddingBottom: inset.bottom }}>
 {grid ? <><View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 16 }}>{button('back', 'Back to camera', () => setGrid(false))}<Text style={{ color: 'white', fontSize: 20, flex: 1 }}>Recents</Text>{button('image', 'Choose from device', () => void finish(() => pickMedia(limit)))}</View><FlatList data={assets} onEndReached={() => void loadAssets()} onEndReachedThreshold={0.5} ListFooterComponent={loadingGallery ? <ActivityIndicator color="white" /> : undefined} numColumns={3} keyExtractor={a => a.id} renderItem={({ item }) => { const index = chosen.findIndex(a => a.id === item.id); return <Pressable accessibilityLabel={`Select ${item.filename}`} accessibilityState={{ selected: index >= 0 }} onPress={() => setChosen(old => index >= 0 ? old.filter(a => a.id !== item.id) : old.length < limit ? [...old, item] : old)} style={{ width: width / 3, height: width / 3, padding: 1 }}><Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%' }} />{item.mediaType === Library.MediaType.video && <View style={{ position: 'absolute', bottom: 8, left: 8 }}><Icon name="video" size={20} color="white" /></View>}{index >= 0 && <Text style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#16a34a', color: 'white', padding: 6, borderRadius: 16 }}>{index + 1}</Text>}</Pressable> }} /><Pressable accessibilityLabel="Preview selected photos" disabled={!chosen.length || busy} onPress={() => select(chosen)} style={{ alignSelf: 'flex-end', margin: 16, padding: 16, borderRadius: 24, backgroundColor: '#15803d', opacity: chosen.length ? 1 : 0.4 }}><Text style={{ color: 'white' }}>Preview {chosen.length || ''}</Text></Pressable></>
 : <View style={{ flex: 1 }}>{permission?.granted && active ? <CameraView ref={camera} mode={mode} videoQuality="720p" style={{ flex: 1 }} facing={front ? 'front' : 'back'} flash={flash ? 'on' : 'off'} onCameraReady={cameraReady} onMountError={() => setError('Camera is unavailable. Choose an existing photo.')} /> : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 }}><Text style={{ color: 'white', textAlign: 'center' }}>Allow camera access to take a photo.</Text><Pressable onPress={() => permission?.canAskAgain ? void requestPermission() : void Linking.openSettings()}><Text style={{ color: '#4ade80' }}>{permission?.canAskAgain ? 'Allow camera' : 'Open settings'}</Text></Pressable></View>}
 <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' }}>{button('x', 'Close camera', () => onDone([]))}{button(flash ? 'sun' : 'moon', flash ? 'Turn flash off' : 'Turn flash on', () => setFlash(v => !v))}</View>
 <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#00000055' }}><View {...swipe.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel="Show all recent photos and videos" onPress={openGallery} style={{ height: 28, justifyContent: 'center' }}><View style={{ alignSelf: 'center', width: 32, height: 4, borderRadius: 2, margin: 8, backgroundColor: 'white' }} /></Pressable><FlatList horizontal data={assets} keyExtractor={a => a.id} onEndReached={() => void loadAssets()} onEndReachedThreshold={0.5} initialNumToRender={8} maxToRenderPerBatch={8} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 3 }} renderItem={({ item: a }) => <Pressable accessibilityLabel={`Preview ${a.filename}`} onPress={() => select([a])} disabled={busy}><Image source={{ uri: a.uri }} style={{ width: 72, height: 72 }} />{a.mediaType === Library.MediaType.video && <View style={{ position: 'absolute', bottom: 4, left: 4 }}><Icon name="video" size={16} color="white" /></View>}</Pressable>} /></View><View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>{button('image', 'Open recent photos', () => assets.length ? setGrid(true) : void finish(() => pickMedia(limit)))}<Pressable accessibilityLabel="Take photo; hold to record video" disabled={(!ready || busy || !active) && !recording && !starting.current} onPressIn={() => { holding.current = true; recorded.current = false }} onLongPress={() => void beginVideo()} delayLongPress={300} onPressOut={() => { holding.current = false; if (recording) camera.current?.stopRecording() }} onPress={() => { if (recorded.current) return; void finish(async () => { const photo = await camera.current?.takePictureAsync({ quality: 0.85 }); if (!photo) return []; const file = await copy(photo.uri, 'camera-photo.jpg'); const original = new File(photo.uri); if (photo.uri.startsWith(Paths.cache.uri) && original.exists) original.delete(); return [file] }) }} style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: 'white', padding: 5 }}><View style={{ flex: 1, backgroundColor: recording ? '#ef4444' : 'white', borderRadius: recording ? 8 : 32 }} /></Pressable>{button('refreshCw', 'Switch camera', () => { setReady(false); setFront(v => !v) })}</View></View></View>}
 {recording && <Text accessibilityLiveRegion="polite" style={{ position: 'absolute', top: inset.top + 18, alignSelf: 'center', color: 'white', backgroundColor: '#b91c1c', padding: 8, borderRadius: 12 }}>0:{String(seconds).padStart(2, '0')}</Text>}{busy && !recording && <ActivityIndicator color="white" style={{ position: 'absolute', top: '50%', alignSelf: 'center' }} />}{!!error && <Text accessibilityRole="alert" style={{ color: '#fca5a5', padding: 12 }}>{error}</Text>}
 </View></Modal>
}
