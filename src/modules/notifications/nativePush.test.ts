import { beforeEach, expect, it, vi } from 'vitest'
import { registerNativePush } from './nativePush'

const mock = vi.hoisted(() => ({
  constants: { easConfig: { projectId: 'project' }, expoConfig: { extra: { androidPushConfigured: true } } },
  permission: vi.fn(), request: vi.fn(), token: vi.fn(), channel: vi.fn(), post: vi.fn(),
}))
vi.mock('expo-constants', () => ({ default: mock.constants }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }))
vi.mock('../../core/api/client', () => ({ api: { post: mock.post } }))
vi.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 }, AndroidNotificationVisibility: { PRIVATE: 0 },
  getPermissionsAsync: mock.permission, requestPermissionsAsync: mock.request,
  getExpoPushTokenAsync: mock.token, setNotificationChannelAsync: mock.channel,
}))

beforeEach(() => {
  vi.resetAllMocks()
  mock.constants.expoConfig.extra.androidPushConfigured = true
  mock.permission.mockResolvedValue({ granted: false })
  mock.request.mockResolvedValue({ granted: true })
  mock.token.mockResolvedValue({ data: 'ExponentPushToken[test]' })
})
it('creates channels, asks for permission and registers an Expo token for the expected account', async () => {
  await registerNativePush(true, 'alice')
  expect(mock.channel).toHaveBeenCalledTimes(4)
  expect(mock.request).toHaveBeenCalledOnce()
  expect(mock.token).toHaveBeenCalledWith({ projectId: 'project' })
  expect(mock.post).toHaveBeenCalledWith('/push/expo/', { token: 'ExponentPushToken[test]' }, { headers: { 'X-JM-Expected-User': 'alice' } })
})
it('never asks for OS permission during background token sync', async () => {
  await expect(registerNativePush(false, 'alice')).rejects.toThrow('Allow notifications')
  expect(mock.request).not.toHaveBeenCalled()
  expect(mock.token).not.toHaveBeenCalled()
})
it('does not register when notification permission is denied', async () => {
  mock.request.mockResolvedValue({ granted: false })
  await expect(registerNativePush(true, 'alice')).rejects.toThrow('Allow notifications')
  expect(mock.post).not.toHaveBeenCalled()
})
it('does not attach a token after the account boundary changes during permission approval', async () => {
  let current = true
  mock.request.mockImplementation(async () => { current = false; return { granted: true } })
  await registerNativePush(true, 'alice', () => current)
  expect(mock.token).not.toHaveBeenCalled()
  expect(mock.post).not.toHaveBeenCalled()
})
it('does not attach a token after the account boundary changes during token acquisition', async () => {
  let current = true
  mock.token.mockImplementation(async () => { current = false; return { data: 'old-token' } })
  await registerNativePush(true, 'alice', () => current)
  expect(mock.post).not.toHaveBeenCalled()
})
it('explains missing build configuration before requesting OS permission', async () => {
  mock.constants.expoConfig.extra.androidPushConfigured = false
  await expect(registerNativePush(true, 'alice')).rejects.toThrow('install the updated JM app')
  expect(mock.request).not.toHaveBeenCalled()
})
it('replaces the native Firebase exception with an actionable app message', async () => {
  mock.token.mockRejectedValue(Error('Default FirebaseApp is not initialized'))
  await expect(registerNativePush(true, 'alice')).rejects.toThrow('install the updated JM app')
  expect(mock.post).not.toHaveBeenCalled()
})
