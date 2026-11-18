/** Avoid evaluating native packages that are absent from an older installed APK. */
export function loadCameraScreen<T>(lookup: (name: string) => unknown, load: () => T, fallback: T): T {
 if (!lookup('ExpoCamera') || !lookup('ExpoMediaLibrary')) return fallback
 return load()
}
