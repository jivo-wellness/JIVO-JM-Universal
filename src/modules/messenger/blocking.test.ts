import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { blockCopy, toggleBlock } from './blocking'
import { OFFLINE_ACTION } from './offlineAction'

const api = vi.hoisted(() => ({ blockContact: vi.fn(), unblockContact: vi.fn() }))
vi.mock('./api', () => api)
vi.mock('../../core/api/client', () => ({ errorMessage: (e: { response?: { data?: { detail?: string } }; message: string }) => e.response?.data?.detail ?? e.message }))

const khush = { id: 'u-k', name: 'Khushwinder Singh', blocked: false }

describe('Block contact (BE-108)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the WhatsApp wording, and separate wording from the administrator "Block messaging"', () => {
    expect(blockCopy.title(khush)).toBe('Block Khushwinder Singh?')
    expect(blockCopy.body(khush)).toBe('Blocked contacts can’t message you. They won’t be notified.')
    expect(blockCopy.confirm(khush)).toBe('Block')
    expect(blockCopy.title({ ...khush, blocked: true })).toBe('Unblock Khushwinder Singh?')
    expect(blockCopy.menu(false)).toBe('Block contact')
    expect(blockCopy.menu(true)).toBe('Unblock contact')
    expect(blockCopy.banner).toBe('You blocked this contact. Tap to unblock.')
  })

  it('blocks and unblocks through the server', async () => {
    api.blockContact.mockResolvedValue({})
    api.unblockContact.mockResolvedValue(undefined)
    expect(await toggleBlock(khush, () => false)).toBe('')
    expect(api.blockContact).toHaveBeenCalledWith('u-k')
    expect(await toggleBlock({ ...khush, blocked: true }, () => false)).toBe('')
    expect(api.unblockContact).toHaveBeenCalledWith('u-k')
  })

  it('offline: says so and changes nothing (blocking needs the server)', async () => {
    api.blockContact.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'))
    expect(await toggleBlock(khush, () => false)).toBe(OFFLINE_ACTION)
    api.blockContact.mockRejectedValue(new Error('whatever'))
    expect(await toggleBlock(khush, () => true)).toBe(OFFLINE_ACTION)
  })

  it('a refusal shows the server message', async () => {
    const refused = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, { status: 400, data: { detail: 'You cannot block yourself.' } } as never)
    api.blockContact.mockRejectedValue(refused)
    expect(await toggleBlock(khush, () => false)).toBe('You cannot block yourself.')
  })
})
