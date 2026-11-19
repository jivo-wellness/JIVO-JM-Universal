import Constants from 'expo-constants'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications'
import { api } from '../../core/api/client'

export const pushProjectId = () => Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId || process.env.EXPO_PUBLIC_EAS_PROJECT_ID
export async function setupChannels() {
  if (Platform.OS !== 'android') return
  for (const sound of [false, true]) for (const vibrate of [false, true]) {
    const id = 'jm-' + (sound ? 'sound' : 'silent') + (vibrate ? '-vibrate' : '')
    await Notifications.setNotificationChannelAsync(id, { name: sound ? 'JM messages' : 'JM silent messages', importance: AndroidImportance.HIGH, ...(sound ? {} : { sound: null }), enableVibrate: vibrate, vibrationPattern: vibrate ? [0, 120, 60, 120] : [0], lockscreenVisibility: AndroidNotificationVisibility.PRIVATE })
  }
}
export async function registerNativePush(requestPermission: boolean, owner: string, current: () => boolean = () => true) {
  if (!owner || !current()) return
  if (Platform.OS === 'android' && Constants.expoConfig?.extra?.androidPushConfigured === false) throw Error('Push notifications are not configured in this app version. Please install the updated JM app when available.')
  const projectId = pushProjectId()
  if (!projectId) throw Error('Expo project ID is not configured. Add EXPO_PUBLIC_EAS_PROJECT_ID and rebuild with push credentials.')
  await setupChannels()
  let permission = await Notifications.getPermissionsAsync()
  if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted) throw Error('Allow notifications in device settings to enable push.')
  if (!current()) return
  let token
  try { token = await Notifications.getExpoPushTokenAsync({ projectId }) }
  catch (error) {
    if (error instanceof Error && /Firebase|googleServicesFile|google-services/i.test(error.message)) throw Error('Push notifications are not configured in this app version. Please install the updated JM app when available.')
    throw error
  }
  if (!current()) return
  await api.post('/push/expo/', { token: token.data }, { headers: { 'X-JM-Expected-User': owner } })
}
export async function nativePushState() {
  const [permission, response] = await Promise.all([Notifications.getPermissionsAsync(), api.get<{ enabled: boolean; subscribed: boolean }>('/push/expo/')])
  return { ...response.data, granted: permission.granted }
}
export async function disableNativePush() {
  await api.delete('/push/expo/')
  await Notifications.dismissAllNotificationsAsync()
}

export async function testLocalNotification(owner: string) {
  await setupChannels()
  const permission = await Notifications.requestPermissionsAsync()
  if (!permission.granted) throw Error('Notification permission was not granted.')
  await Notifications.scheduleNotificationAsync({ content: { title: 'JIVO JM', body: 'Notifications are working on this device.', data: { owner, url: '/notifications', kind: 'test' }, sound: 'default' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'jm-sound-vibrate' } })
}
