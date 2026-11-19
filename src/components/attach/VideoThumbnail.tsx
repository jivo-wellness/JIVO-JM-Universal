import { useVideoPlayer, VideoView } from 'expo-video'
import { View } from 'react-native'
import { Icon } from '../Icon'

/** A paused first frame of local media; never plays audio while an upload is pending. */
export function VideoThumbnail({ uri, label, width, height }: { uri: string; label: string; width: number; height: number }) {
  const player = useVideoPlayer({ uri, useCaching: false }, value => { value.muted = true; value.staysActiveInBackground = false; value.showNowPlayingNotification = false })
  return <View accessibilityLabel={label} pointerEvents="none" style={{ width, height, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' }}>
    <VideoView surfaceType="textureView" player={player} nativeControls={false} contentFit="cover" style={{ width: '100%', height: '100%' }} />
    <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={28} color="white" /></View>
  </View>
}
