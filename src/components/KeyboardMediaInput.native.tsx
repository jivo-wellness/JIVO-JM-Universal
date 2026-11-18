import { requireOptionalNativeModule } from 'expo'
import { View } from 'react-native'
import type { KeyboardMediaInputProps } from './KeyboardMediaInput'

// Do not import the native view on APKs installed before keyboard-media support.
const Wrapper = requireOptionalNativeModule('ExpoPasteInput')
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 ? (require('expo-paste-input') as typeof import('expo-paste-input')).TextInputWrapper : null

export function KeyboardMediaInput({ children, onMedia }: KeyboardMediaInputProps) {
 if (!Wrapper || !onMedia) return <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
 return <Wrapper style={{ flex: 1, minWidth: 0 }} onPaste={event => {
  // Text is already inserted by the OS. Do not insert it a second time.
  if (event.type === 'images') onMedia(event.uris)
 }}>{children}</Wrapper>
}
