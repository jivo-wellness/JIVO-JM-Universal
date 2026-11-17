import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionController, type SessionDependencies } from './controller'
import type { Me } from './types'
afterEach(() => vi.useRealTimers())
const me = { id: 'test-user', name: 'Test User' } as Me
function setup(overrides: Partial<SessionDependencies> = {}) {
  const deps = { enabled: true, csrf: vi.fn(async () => {}), me: vi.fn(async () => me),
    login: vi.fn(async () => ({ status: 'ok' as const })), logout: vi.fn(async () => {}),
    clear: vi.fn(async () => {}), unauthorized: (e: unknown) => e === '401', message: String, ...overrides }
  return { controller: new SessionController(deps), deps }
}
describe('session lifecycle', () => {
  it('does not contact the server when no origin is configured', async () => {
    const { controller, deps } = setup({ enabled: false }); await controller.restore()
    expect(controller.snapshot().status).toBe('anonymous'); expect(deps.csrf).not.toHaveBeenCalled()
  })
  it('restores the existing server session', async () => {
    const { controller } = setup(); await controller.restore()
    expect(controller.snapshot()).toEqual({ status: 'ready', me })
  })
  it('distinguishes an expired session from an unreachable server', async () => {
    const { controller } = setup({ me: async () => { throw '401' } }); await controller.restore()
    expect(controller.snapshot().status).toBe('anonymous')
    const other = setup({ me: async () => { throw new Error('offline') } }); await other.controller.restore()
    expect(other.controller.snapshot().status).toBe('unreachable')
  })
  it('does not adopt an outstanding me response after logout', async () => {
    let resolve!: (value: Me) => void
    const { controller } = setup({ me: () => new Promise(r => { resolve = r }) })
    const pending = controller.restore(); await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
    await controller.logout(); resolve(me); await pending
    expect(controller.snapshot()).toEqual({ status: 'anonymous', me: null })
  })
  it('retains MFA as a challenge instead of treating password success as authenticated', async () => {
    const { controller, deps } = setup({ login: async () => ({ status: 'mfa_required', mfa_token: 'test-only', methods: ['recovery_code'] }) })
    expect((await controller.login('x', 'x')).status).toBe('mfa_required')
    expect(deps.me).not.toHaveBeenCalled(); expect(controller.snapshot().me).toBeNull()
  })
  it('clears native cookies even when server logout fails, while reporting failure', async () => {
    const { controller, deps } = setup({ logout: async () => { throw new Error('offline') } })
    await controller.restore()
    await expect(controller.logout()).rejects.toThrow('offline')
    expect(controller.snapshot().me).toBeNull(); expect(deps.clear).toHaveBeenCalledOnce()
  })
})

it('serializes new login behind logout and cookie cleanup even when logout fails', async () => {
  let rejectLogout!: (error: Error) => void
  let finishCleanup!: () => void
  const logout = vi.fn(() => new Promise<void>((_, reject) => { rejectLogout = reject }))
  const clear = vi.fn(() => new Promise<void>(resolve => { finishCleanup = resolve }))
  const login = vi.fn(async () => ({ status: 'ok' as const }))
  const { controller } = setup({ logout, clear, login })
  await controller.restore()
  const leaving = controller.logout()
  const assertion = expect(leaving).rejects.toThrow('network failed')
  const arriving = controller.login('new@example.invalid', 'mock-only')
  expect(controller.snapshot().status).toBe('signing-out')
  expect(login).not.toHaveBeenCalled()
  rejectLogout(new Error('network failed'))
  await vi.waitFor(() => expect(clear).toHaveBeenCalledOnce())
  expect(login).not.toHaveBeenCalled()
  finishCleanup(); await assertion; await arriving
  expect(login).toHaveBeenCalledOnce()
  expect(controller.snapshot()).toEqual({ status: 'ready', me })
})

it('preserves outbox storage only during session restoration, never login/logout boundaries',async()=>{
 const boundary=vi.fn();const {controller}=setup({boundary});await controller.restore();expect(boundary).toHaveBeenLastCalledWith(true);await controller.login('synthetic@example.invalid','mock-only');expect(boundary).toHaveBeenLastCalledWith(false);await controller.logout();expect(boundary).toHaveBeenLastCalledWith(false)
})


const expiringMe = (expires: number | string) => ({ ...me, session: { id: 'synthetic-session', expires_at: typeof expires === 'number' ? new Date(expires).toISOString() : expires, auth_method: 'password' } }) as Me
it('expires an authenticated session at the server deadline even while offline', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100_000)
 const boundary = vi.fn(); const { controller, deps } = setup({ me: async () => expiringMe(101_000), boundary })
 await controller.restore(); await vi.advanceTimersByTimeAsync(999); expect(controller.snapshot().status).toBe('ready')
 await vi.advanceTimersByTimeAsync(1); expect(controller.snapshot()).toEqual({ status: 'anonymous', me: null }); expect(boundary).toHaveBeenLastCalledWith(false); expect(deps.clear).toHaveBeenCalledOnce()
 controller.dispose()
})
it.each([99_999, 100_000, 'invalid expiry'])('fails closed for an already expired or invalid server expiry %s', async expiry => {
 vi.useFakeTimers(); vi.setSystemTime(100_000)
 const boundary = vi.fn(); const { controller, deps } = setup({ me: async () => expiringMe(expiry), boundary }); await controller.restore(); await Promise.resolve()
 expect(controller.snapshot()).toEqual({ status: 'anonymous', me: null }); expect(boundary).toHaveBeenLastCalledWith(false); expect(deps.clear).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0)
})
it('checks expiry immediately on foreground when suspended timers have not fired', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100_000)
 const { controller } = setup({ me: async () => expiringMe(101_000) }); await controller.restore()
 vi.setSystemTime(200_000); expect(controller.snapshot().status).toBe('ready'); expect(controller.checkExpiry()).toBe(false); expect(controller.snapshot().me).toBeNull(); expect(vi.getTimerCount()).toBe(0)
})
it('replaces an old expiry timer when the server extends the current session', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100_000)
 const response = vi.fn(async () => expiringMe(101_000)); const { controller } = setup({ me: response }); await controller.restore()
 response.mockResolvedValue(expiringMe(110_000)); await controller.adopt(); await vi.advanceTimersByTimeAsync(1000); expect(controller.snapshot().status).toBe('ready')
 await vi.advanceTimersByTimeAsync(9000); expect(controller.snapshot().status).toBe('anonymous')
})
it('cancels timers on logout and disposal, and permits StrictMode restore after disposal', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100_000)
 const { controller } = setup({ me: async () => expiringMe(200_000) }); await controller.restore(); expect(vi.getTimerCount()).toBe(1)
 controller.dispose(); expect(vi.getTimerCount()).toBe(0); await controller.restore(); expect(vi.getTimerCount()).toBe(1)
 await controller.logout(); expect(vi.getTimerCount()).toBe(0)
})
it('rejects a pending adopted session response after expiry clears the account', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100_000)
 let release!: (value: Me) => void
 const response = vi.fn(async () => expiringMe(101_000)); const { controller } = setup({ me: response }); await controller.restore()
 response.mockImplementation(() => new Promise(resolve => { release = resolve })); const adopting = controller.adopt()
 await vi.advanceTimersByTimeAsync(1000); release(expiringMe(500_000)); await adopting
 expect(controller.snapshot().status).toBe('anonymous'); expect(vi.getTimerCount()).toBe(0)
})
it('invalidates pending restoration on provider disposal without clearing a valid server session', async () => {
 let release!: (value: Me) => void
 const { controller, deps } = setup({ me: () => new Promise(resolve => { release = resolve }) })
 const restoring = controller.restore(); await vi.waitFor(() => expect(release).toBeTypeOf('function')); controller.dispose(); release(me); await restoring
 expect(controller.snapshot().status).not.toBe('ready'); expect(deps.clear).not.toHaveBeenCalled()
})
it('does not overflow a timer for a long-lived session and clears preserved storage on server 401', async () => {
 vi.useFakeTimers(); vi.setSystemTime(100_000)
 const response = vi.fn(async () => expiringMe(100_000 + 90 * 24 * 60 * 60_000)); const boundary = vi.fn()
 const { controller, deps } = setup({ me: response, boundary }); await controller.restore(); await vi.advanceTimersByTimeAsync(60_000); expect(controller.snapshot().status).toBe('ready')
 response.mockRejectedValue('401'); await controller.restore(); await Promise.resolve(); expect(controller.snapshot().status).toBe('anonymous'); expect(boundary).toHaveBeenLastCalledWith(false); expect(deps.clear).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0)
})

describe('cached profile start-up (U-022)', () => {
  const cachedMe = { id: 'test-user', name: 'Cached User', capabilities: [] } as unknown as Me
  const memory = (initial: Me | null = cachedMe) => {
    let value = initial
    return { read: vi.fn(async () => value), write: vi.fn(async (next: Me) => { value = next }), clear: vi.fn(async () => { value = null }), get: () => value }
  }
  it('opens with the cached profile at once, then confirms it with the server (stale, then refresh)', async () => {
    let release!: (value: Me) => void
    const cache = memory()
    const { controller } = setup({ cache, me: () => new Promise(r => { release = r }) })
    const restoring = controller.restore()
    await vi.waitFor(() => expect(controller.snapshot()).toEqual({ status: 'ready', me: cachedMe, stale: true }))
    release(me); await restoring
    expect(controller.snapshot()).toEqual({ status: 'ready', me }); expect(cache.get()).toEqual(me)
  })
  it('keeps the cached screens while the server cannot be reached, and retries without a new boundary', async () => {
    const boundary = vi.fn(); const cache = memory()
    const meCall = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(me)
    const { controller } = setup({ cache, boundary, me: meCall })
    await controller.restore()
    expect(controller.snapshot()).toMatchObject({ status: 'ready', me: cachedMe, stale: true, error: 'Error: offline' })
    const boundaries = boundary.mock.calls.length
    await controller.restore()
    expect(boundary).toHaveBeenCalledTimes(boundaries); expect(controller.snapshot()).toEqual({ status: 'ready', me })
  })
  it('wipes the cached profile when the server says the session has ended', async () => {
    const cache = memory(); const boundary = vi.fn()
    const { controller } = setup({ cache, boundary, me: async () => { throw '401' } })
    await controller.restore()
    expect(controller.snapshot()).toEqual({ status: 'anonymous', me: null }); expect(cache.get()).toBeNull()
    expect(boundary).toHaveBeenLastCalledWith(false)
  })
  it('wipes the cached profile on sign-out', async () => {
    const cache = memory(null)
    const { controller } = setup({ cache }); await controller.restore(); expect(cache.get()).toEqual(me)
    await controller.logout(); expect(cache.get()).toBeNull()
  })
  it('ends the cached account before adopting a different one from the server', async () => {
    const other = { id: 'other-user', name: 'Other', capabilities: [] } as unknown as Me
    const cache = memory(); const boundary = vi.fn()
    const { controller } = setup({ cache, boundary, me: async () => other })
    await controller.restore()
    expect(boundary).toHaveBeenLastCalledWith(false); expect(controller.snapshot()).toEqual({ status: 'ready', me: other }); expect(cache.get()).toEqual(other)
  })
  it('marks the local cache read as `reading`, and a server wait without a cached profile as plain loading (U-031)', async () => {
    let release!: (value: Me | null) => void
    const cache = { ...memory(null), read: vi.fn(() => new Promise<Me | null>(r => { release = r })) }
    const { controller } = setup({ cache, me: () => new Promise<Me>(() => {}) })
    void controller.restore()
    expect(controller.snapshot()).toEqual({ status: 'loading', me: null, reading: true })
    release(null)
    await vi.waitFor(() => expect(controller.snapshot()).toEqual({ status: 'loading', me: null }))
  })
  it('ignores a cached profile whose session has already expired', async () => {
    const expired = { ...cachedMe, session: { id: 's', expires_at: '2000-01-01T00:00:00Z', auth_method: 'password' } } as Me
    const cache = memory(expired)
    const { controller } = setup({ cache, me: async () => { throw new Error('offline') } })
    await controller.restore()
    expect(controller.snapshot().status).toBe('unreachable'); expect(cache.clear).toHaveBeenCalled()
  })
})
