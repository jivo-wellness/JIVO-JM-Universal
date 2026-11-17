import { describe, expect, it, vi } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { appUserAgent, deviceInfo } from './deviceName'
import { createTransport } from './transport'

const success = async (config: InternalAxiosRequestConfig) => ({ data: [], status: 200, statusText: 'OK', headers: {}, config })

describe('native device name (User-Agent)', () => {
  it('names the app, OS release and model from React Native Platform.constants', () => {
    expect(appUserAgent(deviceInfo('android', { Release: '15', Model: 'RMX5313', Manufacturer: 'realme' }, '1.0.0'))).toBe('JIVO-JM/1.0.0 (Android 15; RMX5313)')
    expect(appUserAgent(deviceInfo('ios', { osVersion: '18.1', interfaceIdiom: 'phone' }, '1.0.0'))).toBe('JIVO-JM/1.0.0 (iOS 18.1; iPhone)')
    expect(appUserAgent(deviceInfo('android', undefined, null))).toBe('JIVO-JM/1 (Android)')
  })
  it('sends nothing from the browser build', () => {
    expect(appUserAgent(deviceInfo('web', { Model: 'x' }, '1.0.0'))).toBeUndefined()
  })
  it('keeps the header plain ASCII and the (os; model) structure intact', () => {
    const ua = appUserAgent({ os: 'android', osVersion: '15', model: 'Pixel (9); Pro™\r\nX-Evil: 1', appVersion: '1.0.0' })!
    expect(ua).toBe('JIVO-JM/1.0.0 (Android 15; Pixel 9 Pro X-Evil 1)')
    expect(/^[\x20-\x7e]+$/.test(ua)).toBe(true)
    expect(appUserAgent({ os: 'android', model: 'M'.repeat(200) })!.length).toBeLessThan(100)
  })
  it('the native transport sends it on every request; the web transport never does', async () => {
    const adapter = vi.fn(success)
    const native = createTransport({ origin: 'https://test.example.invalid', native: true, csrf: async () => 'c', lost: () => {}, userAgent: 'JIVO-JM/1.0.0 (Android 15; RMX5313)' })
    await native.api.post('/auth/login/', {}, { adapter }); await native.api.get('/me/', { adapter })
    expect(adapter.mock.calls.map(([c]) => c.headers.get('User-Agent'))).toEqual(['JIVO-JM/1.0.0 (Android 15; RMX5313)', 'JIVO-JM/1.0.0 (Android 15; RMX5313)'])
    adapter.mockClear()
    const web = createTransport({ origin: 'https://test.example.invalid', native: false, csrf: async () => 'c', lost: () => {}, userAgent: 'JIVO-JM/1.0.0 (Android 15; RMX5313)' })
    await web.api.get('/me/', { adapter })
    expect(adapter.mock.calls[0][0].headers.has('User-Agent')).toBe(false)
  })
})
