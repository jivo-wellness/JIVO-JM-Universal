import { useNetworkState } from 'expo-network'

/** Socket reconnects and app backgrounding are not evidence of lost internet. */
export function useDeviceOffline() {
  const state = useNetworkState()
  return state.isConnected === false || state.isInternetReachable === false
}
