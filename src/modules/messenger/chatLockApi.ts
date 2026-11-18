import { Platform } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'
import { api } from '../../core/api/client'
import type { ConversationDetail, ConversationItem, CursorPage } from './api'

// This endpoint requires app_unlock when the backend's session grant is absent.
// The common transport obtains the server-offered factor and retries only once.
export const verifyLockedChats = async (signal: AbortSignal): Promise<void> => {
  if (Platform.OS !== 'web') {
    if (signal.aborted) throw new Error('Unlock cancelled.')
    const cancel = () => { if (Platform.OS === 'android') void LocalAuthentication.cancelAuthenticate().catch(() => {}) }
    signal.addEventListener('abort', cancel, { once: true })
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock locked chats', cancelLabel: 'Cancel', biometricsSecurityLevel: 'strong' })
      if (!result.success || signal.aborted) throw new Error('Chat remains locked. Verify with your fingerprint, face or device screen lock.')
    } finally { signal.removeEventListener('abort', cancel) }
  }
  await api.get<CursorPage<ConversationItem>>('/conversations/', { params: { filter: 'locked', limit: 1 }, signal })
}
export const setConversationLock = async (id: string, locked: boolean, signal: AbortSignal): Promise<ConversationDetail> =>
  (await api.patch<ConversationDetail>(`/conversations/${id}/settings/`, { locked }, { signal })).data
