import type { ReactNode } from 'react'
import { View } from 'react-native'
export type KeyboardMediaInputProps = { children: ReactNode; onMedia?: (uris: string[]) => void }
export function KeyboardMediaInput({ children }: KeyboardMediaInputProps) {
 return <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
}
