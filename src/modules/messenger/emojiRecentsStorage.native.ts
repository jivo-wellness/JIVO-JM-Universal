import * as SecureStore from 'expo-secure-store'
/** Recently used emoji for the composer panel (not sensitive; this device only). */
const key = 'jm.emoji.recent'
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
export const emojiRecentsStorage = {
  read: (): Promise<string | null> => SecureStore.getItemAsync(key, options).catch(() => null),
  write: (value: string): Promise<void> => SecureStore.setItemAsync(key, value, options).catch(() => {}),
}
