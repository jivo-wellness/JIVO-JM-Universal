import { AppState } from 'react-native'
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
import { watchLifecycle } from './lifecycleModel'
export function subscribeLifecycle(handler: (active: boolean) => void) {
  return watchLifecycle({
    foreground: AppState.currentState === 'active',
    onForeground: fn => { const sub = AppState.addEventListener('change', state => fn(state === 'active')); return () => sub.remove() },
    // A LAN backend can work without public internet access; only physical disconnect pauses it.
    onNetwork: fn => { const sub = addNetworkStateListener(state => fn(state.isConnected !== false)); return () => sub.remove() },
    initialNetwork: async () => (await getNetworkStateAsync()).isConnected !== false,
  }, handler)
}
