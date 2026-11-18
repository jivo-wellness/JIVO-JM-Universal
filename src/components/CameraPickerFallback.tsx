import { useEffect } from 'react'
import { Alert } from 'react-native'
import { capturePhoto } from '../modules/messenger/media/capture'
import type { PickedFile } from '../modules/messenger/media/model'

export function CameraPickerFallback({ onDone }: { limit: number; onDone: (files: PickedFile[]) => void }) {
 useEffect(() => {
  let active = true
  void capturePhoto(() => active).then(file => {
   if (active) onDone(file ? [file] : [])
   else void file?.dispose?.()
  }).catch(error => {
   if (!active) return
   onDone([])
   Alert.alert('Camera unavailable', error instanceof Error ? error.message : 'Unable to open the camera. Please try again.')
  })
  return () => { active = false }
 }, [onDone])
 return null
}
