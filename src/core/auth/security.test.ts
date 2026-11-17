import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addPasskey, confirmPasskey, isPasskeyCancel, nativePasskeyError, passkeysSupported } from './security'
const mock = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), create: vi.fn(), supported: vi.fn(() => true), platform: { OS: 'android', Version: 34 as number | string } }))
vi.mock('react-native', () => ({ Platform: mock.platform }))
vi.mock('react-native-passkey', () => ({ Passkey: { get: mock.get, create: mock.create, isSupported: mock.supported } }))
vi.mock('../api/client', () => ({ api: { post: mock.post, get: vi.fn() } }))
const options = { challenge: 'synthetic', rpId: 'messenger.jivo.in', allowCredentials: [{ id: 'cred', type: 'public-key' }], userVerification: 'required' }
beforeEach(() => {
  vi.resetAllMocks(); mock.supported.mockReturnValue(true); mock.platform.OS = 'android'; mock.platform.Version = 34
  mock.post.mockResolvedValue({ data: { methods: ['passkey', 'password'], passkey: { flow: 'synthetic-flow', options } } })
  mock.get.mockResolvedValue({ id: 'synthetic-credential', response: { clientDataJSON: 'cd' } })
})
describe('native passkeys (react-native-passkey)', () => {
  it('is offered on Android 9+ and iOS 16+ only, and only when the library agrees', () => {
    expect(passkeysSupported()).toBe(true)
    mock.platform.Version = 27; expect(passkeysSupported()).toBe(false)
    mock.platform.OS = 'ios'; mock.platform.Version = '16.4'; expect(passkeysSupported()).toBe(true)
    mock.platform.Version = '15.8'; expect(passkeysSupported()).toBe(false)
    mock.platform.OS = 'android'; mock.platform.Version = 34; mock.supported.mockReturnValue(false); expect(passkeysSupported()).toBe(false)
  })
  it('passes the server options through and posts the platform credential unchanged', async () => {
    const signal = new AbortController().signal
    await confirmPasskey('jp', signal)
    expect(mock.post).toHaveBeenNthCalledWith(1, '/auth/step-up/options/', { scope: 'jp' }, { signal })
    expect(mock.get).toHaveBeenCalledWith(options)
    expect(mock.post).toHaveBeenLastCalledWith('/auth/step-up/', { scope: 'jp', method: 'passkey', flow: 'synthetic-flow', credential: { id: 'synthetic-credential', response: { clientDataJSON: 'cd' } } }, { signal })
  })
  it('a closed prompt is a quiet cancel; other failures keep a readable message', async () => {
    mock.get.mockRejectedValueOnce({ error: 'UserCancelled', message: 'The user cancelled the request.' })
    const error = await confirmPasskey('jp').catch(e => e)
    expect(isPasskeyCancel(error)).toBe(true)
    expect(mock.post).toHaveBeenCalledTimes(1)
    expect(isPasskeyCancel(nativePasskeyError({ error: 'NoCredentials' }))).toBe(false)
    expect(nativePasskeyError({ error: 'NoCredentials' }).message).toMatch(/No passkey/)
    expect(nativePasskeyError({ error: 'RequestFailed', message: 'RP ID cannot be validated.' }).message).toMatch(/not yet approved/)
  })
  it('never submits a credential that arrives after the request was cancelled', async () => {
    const abort = new AbortController()
    let finish!: (value: unknown) => void
    mock.get.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = confirmPasskey('jp', abort.signal)
    await vi.waitFor(() => expect(mock.get).toHaveBeenCalled())
    abort.abort(); finish({ id: 'late' })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(mock.post).toHaveBeenCalledTimes(1)
  })
  it('does not open the passkey prompt when the server did not offer one', async () => {
    mock.post.mockResolvedValueOnce({ data: { methods: ['password'], passkey: null } })
    await expect(confirmPasskey('jp')).rejects.toThrow('did not offer')
    expect(mock.get).not.toHaveBeenCalled()
  })
  it('enrols with the server registration options and returns its recovery codes', async () => {
    const creation = { challenge: 'c', rp: { id: 'messenger.jivo.in', name: 'JIVO JM' }, user: { id: 'u', name: 'a@b', displayName: 'A' }, pubKeyCredParams: [] }
    mock.post.mockResolvedValueOnce({ data: { flow: 'reg-flow', options: creation } }).mockResolvedValueOnce({ data: { recovery_codes: ['x'] } })
    mock.create.mockResolvedValue({ id: 'new', response: { attestationObject: 'a', clientDataJSON: 'cd' } })
    expect(await addPasskey('Phone')).toEqual({ recovery_codes: ['x'] })
    expect(mock.create).toHaveBeenCalledWith(creation)
    expect(mock.post).toHaveBeenLastCalledWith('/auth/passkeys/', { flow: 'reg-flow', credential: { id: 'new', response: { attestationObject: 'a', clientDataJSON: 'cd' } }, name: 'Phone' })
  })
})
