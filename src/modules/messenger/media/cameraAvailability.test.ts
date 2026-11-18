import { expect, it, vi } from 'vitest'
import { loadCameraScreen } from './cameraAvailability'

it.each([[], ['ExpoCamera'], ['ExpoMediaLibrary']])('does not import camera packages when the installed modules are %j', (...modules) => {
 const installed = modules.flat() as string[]
 const load = vi.fn(() => 'custom')
 expect(loadCameraScreen(name => installed.includes(name) ? {} : null, load, 'picker')).toBe('picker')
 expect(load).not.toHaveBeenCalled()
})

it('loads the custom camera when both native modules are installed', () => {
 const load = vi.fn(() => 'custom')
 expect(loadCameraScreen(() => ({}), load, 'picker')).toBe('custom')
 expect(load).toHaveBeenCalledOnce()
})
