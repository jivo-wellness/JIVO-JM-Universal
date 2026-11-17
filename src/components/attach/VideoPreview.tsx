import { useVideoPlayer, VideoView } from 'expo-video'
import { View } from 'react-native'

/** A chosen video, playable before sending (native controls). Mounted per file, so the player follows the selection. */
export function VideoPreview({ uri, label }: { uri: string; label: string }) {
  const player = useVideoPlayer({ uri, useCaching: false }, value => { value.loop = false; value.staysActiveInBackground = false; value.showNowPlayingNotification = false })
  return <View accessibilityLabel={label} style={{ width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#000000' }}>
    <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: false }} style={{ width: '100%', height: '100%' }} />
  </View>
}
