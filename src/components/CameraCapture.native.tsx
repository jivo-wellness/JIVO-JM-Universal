import type { ComponentType, ComponentProps } from 'react'
import { requireOptionalNativeModule } from 'expo'
import { CameraPickerFallback } from './CameraPickerFallback'
import { loadCameraScreen } from '../modules/messenger/media/cameraAvailability'

// Native dependencies must only be evaluated when the installed binary includes them.
// Older development builds can still open chats and use the system camera picker.
export const CameraCapture = loadCameraScreen<ComponentType<ComponentProps<typeof CameraPickerFallback>>>(
 requireOptionalNativeModule,
 () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./CameraCaptureScreen') as typeof import('./CameraCaptureScreen')).CameraCapture
 },
 CameraPickerFallback,
)
