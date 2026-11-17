import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { appUserAgent, deviceInfo } from './deviceName'
import { csrfCookie } from './cookies'
import { sessionLost } from './events'
import { createTransport } from './transport'
import { resolveApiOrigin } from './origin'
export const origin = resolveApiOrigin(Platform.OS, process.env.EXPO_PUBLIC_API_ORIGIN, typeof window === 'undefined' ? undefined : window.location?.origin)
export const { api, onStepUpRequired, advanceSession } = createTransport({ origin, native: Platform.OS !== 'web', csrf: csrfCookie, lost: sessionLost,
  userAgent: appUserAgent(deviceInfo(Platform.OS, Platform.constants as unknown as Record<string, unknown>, Constants.expoConfig?.version)) })
export { onSessionLost } from './events'
export { errorMessage } from './transport'

