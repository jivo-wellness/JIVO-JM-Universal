import type { CaptureLevel } from './screenCaptureGuard'

// Android screenshot detection is deliberately disabled. Importing expo-screen-capture
// initializes its observer on Android 14+, which crashes without DETECT_SCREEN_CAPTURE.
// Keep this platform entry free of that native module; iOS retains switcher protection.
export function useScreenCaptureGuard(_level: CaptureLevel | false): void {}
