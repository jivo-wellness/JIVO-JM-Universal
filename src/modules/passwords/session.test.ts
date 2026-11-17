import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearVaultSession, vaultSession } from './session'
const mocks = vi.hoisted(() => ({ unlock: vi.fn(), request: vi.fn() }))
vi.mock('./api', () => ({ unlock: mocks.unlock }))
vi.mock('../../core/api/client', () => ({ errorMessage: () => 'error' }))
vi.mock('../../core/auth/security', () => ({ confirmPassword: vi.fn(), confirmPasskey: vi.fn(), isPasskeyCancel: () => false, passkeysSupported: () => true }))
vi.mock('../../core/auth/stepUpFlow', () => ({ StepUpFlow: class { request = mocks.request; clear = vi.fn() } }))

const stepUp = { response: { status: 403, data: { code: 'step_up_required' } } }
async function open() {
  const { lock } = vaultSession('alice'); lock.start() // start() opens
  await vi.waitFor(() => expect(lock.snapshot().busy).toBe(false)); return lock
}
beforeEach(() => { vi.resetAllMocks(); clearVaultSession() })
describe('Passwords unlock asks once', () => {
  it('asks only for the password when the server needs step-up (no biometric first)', async () => {
    mocks.unlock.mockRejectedValueOnce(stepUp).mockResolvedValueOnce({ unlocked: true, expires_at: null })
    mocks.request.mockResolvedValue(true)
    const lock = await open()
    expect(mocks.request).toHaveBeenCalledOnce()
    expect(mocks.unlock).toHaveBeenNthCalledWith(1, expect.anything(), { stepUpPrompt: false })
    expect(lock.snapshot().unlocked).toBe(true)
  })
  it('asks passkey first (one sheet, no biometric) when the server offers a passkey', async () => {
    mocks.unlock.mockRejectedValueOnce({ response: { status: 403, data: { code: 'step_up_required', scope: 'jp', methods: ['passkey', 'password'] } } })
      .mockResolvedValueOnce({ unlocked: true, expires_at: null })
    mocks.request.mockResolvedValue(true)
    const lock = await open()
    expect(mocks.request).toHaveBeenCalledOnce()
    expect(mocks.request).toHaveBeenCalledWith('jp', ['passkey', 'password'], expect.anything())
    expect(mocks.unlock).toHaveBeenCalledTimes(2)
    expect(lock.snapshot().unlocked).toBe(true)
  })
  it('asks only for the password when the server offers only the password', async () => {
    mocks.unlock.mockRejectedValueOnce(stepUp).mockResolvedValueOnce({ unlocked: true, expires_at: null })
    mocks.request.mockResolvedValue(true)
    await open()
    expect(mocks.request).toHaveBeenCalledWith('jp', ['password'], expect.anything())
  })
  it('opens without any prompt while the server step-up is still fresh (no separate device fingerprint)', async () => {
    mocks.unlock.mockResolvedValue({ unlocked: true, expires_at: null })
    const lock = await open()
    expect(mocks.request).not.toHaveBeenCalled()
    expect(lock.snapshot().unlocked).toBe(true)
  })
  it('stays locked when the password is cancelled', async () => {
    mocks.unlock.mockRejectedValue(stepUp); mocks.request.mockResolvedValue(false)
    const lock = await open()
    expect(lock.snapshot().unlocked).toBe(false)
  })
})
