/**
 * The native app's User-Agent (U-032). React Native's HTTP stack sends `okhttp/4.x` (Android) or `CFNetwork …`
 * (iOS), which the backend's browser parser could only call "Browser", so "Signed-in devices" listed the phone as
 * "Browser". The app names itself instead: `JIVO-JM/1.0.0 (Android 15; RMX5313)`, which the backend
 * (`identity.service.device_label`) shows as "JIVO JM on Android · RMX5313". The browser build sends nothing: browsers
 * do not let pages set User-Agent and already send a real one.
 *
 * Header values must be plain ASCII (OkHttp throws on anything else) and the model must not break the `( ; )`
 * structure, so every part is reduced to letters, digits, space and `._+-`.
 */
export interface DeviceInfo { os: string; osVersion?: string | number | null; model?: string | null; appVersion?: string | null }

const clean = (value: unknown, max: number) => String(value ?? '').replace(/[^A-Za-z0-9 ._+-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim()

export function appUserAgent({ os, osVersion, model, appVersion }: DeviceInfo): string | undefined {
  const system = os === 'android' ? 'Android' : os === 'ios' ? 'iOS' : ''
  if (!system) return undefined
  const version = clean(appVersion, 20).replace(/ /g, '') || '1'
  const release = clean(osVersion, 20).replace(/ /g, '')
  const name = clean(model, 60)
  return `JIVO-JM/${version} (${release ? `${system} ${release}` : system}${name ? `; ${name}` : ''})`
}

/** What React Native's `Platform.constants` holds on each OS (only the fields used here). */
export function deviceInfo(os: string, constants: Record<string, unknown> | undefined, appVersion?: string | null): DeviceInfo {
  const k = constants ?? {}
  if (os === 'android') return { os, osVersion: k.Release as string | undefined, model: k.Model as string | undefined, appVersion }
  // iOS exposes no model name without a native module; the idiom still tells an iPhone from an iPad.
  if (os === 'ios') return { os, osVersion: k.osVersion as string | undefined, model: k.interfaceIdiom === 'pad' ? 'iPad' : k.interfaceIdiom === 'phone' ? 'iPhone' : undefined, appVersion }
  return { os }
}
