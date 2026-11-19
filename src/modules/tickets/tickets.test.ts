import { fetchTicketFile, raiseTicket, replyTicket, updateTicket } from './api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_FILE_SIZE, validateFiles } from './model'
import type { PickedFile } from '../messenger/media/model'
import { notificationTarget } from '../../shared/notificationTarget'
import { safeNext } from '../../shared/authNavigation'
import { homeTiles } from '../../shared/homeTiles'
import { shellLinks } from '../../shared/shellLayout'
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), patch: vi.fn(), upload: vi.fn() }))
vi.mock('../../core/api/client', () => ({ api: mocks }))
vi.mock('expo-crypto', () => ({ randomUUID: () => 'upload-key' }))
vi.mock('../messenger/media/upload', () => ({ uploadAttachment: mocks.upload }))
const file = (name = 'screen.png', size = 123): PickedFile => ({ name, size, mime: 'image/png', uri: 'file:///fixture' })
const fields = { title: 'A problem', description: 'Reproduction steps', priority: 'medium' as const, page_url: '/home', browser: 'JM app' }
beforeEach(() => { vi.resetAllMocks(); mocks.post.mockResolvedValue({ data: { code: 'TKT-1234567890ABCDEF' } }); mocks.upload.mockResolvedValue({ id: 'scanned-upload', status: 'ready' }) })
describe('ticket attachments', () => {
  it('accepts exactly six supported files up to 10 MiB', () => expect(() => validateFiles(Array.from({ length: 6 }, () => file('recording.MP4', MAX_FILE_SIZE)))).not.toThrow())
  it.each([file('run.exe'), file('screen.png', 0), file('screen.png', -1), file('screen.png', NaN), file('screen.png', MAX_FILE_SIZE + 1)])('rejects invalid files before upload', async attachment => {
    await expect(raiseTicket(fields, [attachment], new AbortController().signal)).rejects.toThrow()
    expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled()
  })
  it('rejects more than six attachments', () => expect(() => validateFiles(Array.from({ length: 7 }, () => file()))).toThrow('6 files'))
  it('uses the ticket upload purpose and posts only scanned IDs', async () => {
    const signal = new AbortController().signal
    await raiseTicket(fields, [file()], signal)
    expect(mocks.upload).toHaveBeenCalledWith(file(), 'upload-key', signal, expect.any(Function), 'ticket')
    expect(mocks.post).toHaveBeenCalledWith('/tickets/', { ...fields, files: ['scanned-upload'] }, { signal })
  })
  it('does not create a ticket after upload or scan failure', async () => {
    mocks.upload.mockRejectedValue(Error('Rejected'))
    await expect(raiseTicket(fields, [file()], new AbortController().signal)).rejects.toThrow('Rejected')
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it('does not submit after cancellation during scanning', async () => {
    const controller = new AbortController()
    mocks.upload.mockImplementation(async () => { controller.abort(); return { id: 'upload' } })
    await expect(raiseTicket(fields, [file()], controller.signal)).rejects.toThrow()
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it('does not submit a text-only request with an aborted signal', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(replyTicket('code', 'reply', [], controller.signal)).rejects.toThrow()
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it('posts replies with attachments through the ticket endpoint', async () => {
    const signal = new AbortController().signal
    await replyTicket('code', 'More details', [file()], signal)
    expect(mocks.post).toHaveBeenCalledWith('/tickets/code/comments/', { body: 'More details', files: ['scanned-upload'] }, { signal })
  })
  it('uses authenticated ticket paths for updates and downloads', async () => {
    mocks.patch.mockResolvedValue({ data: {} }); mocks.get.mockResolvedValue({ data: new Blob() })
    const signal = new AbortController().signal
    await updateTicket('code', { assignee: null, status: 'resolved' }, signal)
    await fetchTicketFile('code', 'file/id', signal)
    expect(mocks.patch).toHaveBeenCalledWith('/tickets/code/', { assignee: null, status: 'resolved' }, { signal })
    expect(mocks.get).toHaveBeenCalledWith('/tickets/code/files/file%2Fid/', { responseType: 'blob', signal, timeout: 120000 })
  })
})
describe('ticket navigation', () => {
  it('opens ticket notifications and preserves local login destinations', () => {
    expect(notificationTarget('/tickets/TKT-1234567890ABCDEF')).toEqual({ pathname: '/tickets/[code]', params: { code: 'TKT-1234567890ABCDEF' } })
    expect(notificationTarget('/tickets')).toEqual({ pathname: '/tickets' })
    expect(safeNext('/tickets/TKT-1234567890ABCDEF')).toBe('/tickets/TKT-1234567890ABCDEF')
  })
  it.each(['/tickets/new', '/tickets/invalid', '/tickets/TKT-1234567890ABCDEF/extra', '//evil/tickets', '/tickets/%2e%2e'])('rejects unsupported notification paths %s', value => expect(notificationTarget(value)).toBeNull())
  it('requires JM access for navigation and keeps five phone tabs', () => {
    expect(homeTiles([]).some(t => t.href === '/tickets')).toBe(false)
    expect(homeTiles(['JM_ACCESS']).some(t => t.href === '/tickets')).toBe(true)
    expect(shellLinks(['JM_ACCESS']).account.some(t => t.href === '/tickets')).toBe(true)
    expect(shellLinks(['JM_ACCESS']).rail.some(t => t.href === '/tickets')).toBe(true)
    expect(shellLinks(['JM_ACCESS']).tabs).toHaveLength(5)
  })
})
