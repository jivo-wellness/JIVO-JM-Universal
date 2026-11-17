import { describe, it, expect, vi } from 'vitest'
import type { ConversationItem, PersonCard } from '../messenger/api'
import type { PickedFile } from '../messenger/media/model'
import { MAX_FILES } from '../messenger/media/selection'
import { chatTarget, MAX_SHARE_TARGETS, normalizeShare, peopleWithoutChats, personTarget, shareable, shareStep, shareSummary, shareTypeProblem, shareUsable, ShareProblem, toggleTarget, unshareableReason } from './model'
import { sendShare, shareFailureMessage, type ShareSendDeps } from './send'
import { shareFileName, shareMime, splitNativeShare } from './nativePayload'
import { SHARE_MAX_FILES, SHARE_TTL } from './shareTarget'

const chat = (id: string, extra: Partial<ConversationItem> = {}) => ({ id, title: id, kind: 'group', locked: false, can: { send: true, send_file: true }, ...extra }) as ConversationItem
const person = (id: string, extra: Partial<PersonCard> = {}): PersonCard => ({ id, name: id, avatar_url: null, company: null, is_active: true, ...extra })
const file = (name: string, mime: string, size = 42): PickedFile => ({ name, mime, size, uri: `file:///cache/jm-share/${name}` })

describe('share payload normalisation', () => {
  it('joins title, text and link once, without repeating a link already in the text', () => {
    const share = normalizeShare({ texts: ['Title', 'Visit https://a.test', 'https://a.test', 'Title', '  '], files: [] })
    expect(share).toEqual({ text: 'Title\nVisit https://a.test', files: [], rejected: [], notice: '' })
  })
  it('keeps a single file and several files in order, with the text as the caption', () => {
    expect(normalizeShare({ texts: [], files: [file('a.jpg', 'image/jpeg')] }).files.map(f => f.name)).toEqual(['a.jpg'])
    const many = normalizeShare({ texts: ['Look'], files: [file('a.jpg', 'image/jpeg'), file('b.mp4', 'video/mp4'), file('c.pdf', 'application/pdf')] })
    expect(many.files.map(f => f.name)).toEqual(['a.jpg', 'b.mp4', 'c.pdf']); expect(many.text).toBe('Look')
  })
  it('takes photos, videos, audio, text and office documents; refuses apps and unknown types by name', () => {
    for (const [name, mime] of [['a.heic', 'image/heic'], ['b.3gp', 'video/3gpp'], ['c.m4a', 'audio/mp4'], ['d.csv', 'text/csv'], ['e.vcf', 'text/x-vcard'], ['f.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['g.xlsx', 'application/vnd.ms-excel.sheet.macroEnabled.12'], ['h.odt', 'application/vnd.oasis.opendocument.text'], ['i.pdf', 'application/octet-stream'], ['j.zip', 'application/zip']])
      expect(shareTypeProblem({ name, mime }), name).toBeNull()
    expect(shareTypeProblem({ name: 'game.apk', mime: 'application/vnd.android.package-archive' })).toBe("game.apk: apps and programs can't be sent in JM.")
    expect(shareTypeProblem({ name: 'setup.exe', mime: 'application/octet-stream' })).toMatch(/apps and programs/)
    expect(shareTypeProblem({ name: 'model.blend', mime: 'application/x-blender' })).toBe("model.blend: JM can't send this type of file (application/x-blender).")
    expect(shareTypeProblem({ name: 'blob', mime: '' })).toBe("blob: JM can't send this type of file (unknown type).")
  })
  it('leaves out refused files with the reason and keeps the rest', () => {
    const share = normalizeShare({ texts: [], files: [file('ok.png', 'image/png'), file('bad.apk', 'application/vnd.android.package-archive')] })
    expect(share.files.map(f => f.name)).toEqual(['ok.png']); expect(share.rejected.map(f => f.name)).toEqual(['bad.apk'])
    expect(share.notice).toMatch(/bad\.apk: apps and programs/)
  })
  it('throws a clear message when nothing usable is left', () => {
    expect(() => normalizeShare({ texts: [], files: [file('x.bin', 'application/x-thing')] })).toThrow(new ShareProblem("x.bin: JM can't send this type of file (application/x-thing)."))
    expect(() => normalizeShare({ texts: [' '], files: [] })).toThrow(/Nothing to share/)
    expect(() => normalizeShare({ texts: ['x'.repeat(4001)], files: [] })).toThrow(/at most 4000 characters/)
  })
  it('applies the composer limits: 10 files, photos 10 MB, videos 500 MB; dropped files are counted', () => {
    expect(SHARE_MAX_FILES).toBe(MAX_FILES)
    const eleven = Array.from({ length: 11 }, (_, i) => file(`p${i}.jpg`, 'image/jpeg'))
    const share = normalizeShare({ texts: [], files: eleven })
    expect(share.files).toHaveLength(10); expect(share.notice).toMatch(/Up to 10 files per message/)
    const big = normalizeShare({ texts: [], files: [file('huge.jpg', 'image/jpeg', 11 * 1024 * 1024), file('film.mp4', 'video/mp4', 501 * 1024 * 1024), file('ok.pdf', 'application/pdf')] })
    expect(big.files.map(f => f.name)).toEqual(['ok.pdf']); expect(big.notice).toMatch(/huge\.jpg: Photos can be at most 10 MB\..*film\.mp4: Videos can be at most 500 MB\./)
    expect(normalizeShare({ texts: [], files: [file('a.jpg', 'image/jpeg')], dropped: 3 }).notice).toBe('Up to 10 files per message: 3 more were left out.')
  })
  it('summarises what was shared', () => {
    expect(shareSummary({ text: '', files: [file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg'), file('c.mp4', 'video/mp4')] })).toBe('2 photos, 1 video')
    expect(shareSummary({ text: 'hi', files: [file('c.pdf', 'application/pdf')] })).toBe('1 file with text')
    expect(shareSummary({ text: 'https://a.test/x', files: [] })).toBe('Link')
    expect(shareSummary({ text: 'hello', files: [] })).toBe('Text')
  })
})

describe('native share payloads', () => {
  it('splits text/links from local files and never treats a web link as a file', () => {
    expect(splitNativeShare([{ shareType: 'url', value: 'https://outside.example/x' }, { shareType: 'text', value: 'Hi' }])).toEqual({ texts: ['https://outside.example/x', 'Hi'], files: [] })
    expect(splitNativeShare([{ shareType: 'image', value: 'content://media/1', mimeType: 'IMAGE/JPEG' }, { shareType: 'file', value: 'file:///sdcard/a.pdf' }]).files).toEqual([{ uri: 'content://media/1', mime: 'image/jpeg' }, { uri: 'file:///sdcard/a.pdf', mime: '' }])
    expect(() => splitNativeShare([{ shareType: 'file', value: 'https://outside.example/file.pdf' }])).toThrow(ShareProblem)
  })
  it('names and types copied files safely', () => {
    expect(shareFileName('../../etc/pass:wd.txt', 0)).toBe('etc pass wd.txt')
    expect(shareFileName('', 2)).toBe('Shared file 3')
    expect(shareFileName('a'.repeat(200) + '.pdf', 0)).toHaveLength(120)
    expect(shareMime('photo.JPG', '', null)).toBe('image/jpeg')
    expect(shareMime('x', 'image/*', 'application/octet-stream', 'image/png')).toBe('image/png')
    expect(shareMime('report.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(shareMime('thing')).toBe('application/octet-stream')
  })
})

describe('recipients', () => {
  it('lists only unlocked chats where this person may send (and send files when there are files)', () => {
    expect(shareable(chat('a'), true)).toBe(true)
    expect(shareable(chat('locked', { locked: true }), false)).toBe(false)
    expect(shareable(chat('text-only', { can: { send: true, send_file: false } as ConversationItem['can'] }), true)).toBe(false)
    expect(shareable(chat('text-only', { can: { send: true, send_file: false } as ConversationItem['can'] }), false)).toBe(true)
    expect(unshareableReason(chat('text-only', { can: { send: true, send_file: false } as ConversationItem['can'] }), true)).toBe("Can't send files here")
    expect(unshareableReason(chat('readonly', { can: { send: false, send_file: false } as ConversationItem['can'] }), false)).toBe("Can't send messages here")
  })
  it('selects one or several chats, at most five', () => {
    let list = toggleTarget([], chatTarget(chat('a'))).list
    expect(list.map(t => t.key)).toEqual(['chat:a'])
    for (const id of ['b', 'c', 'd', 'e']) list = toggleTarget(list, chatTarget(chat(id))).list
    const sixth = toggleTarget(list, personTarget(person('f')))
    expect(sixth.list).toHaveLength(MAX_SHARE_TARGETS); expect(sixth.notice).toBe('You can share with up to 5 chats.')
    expect(toggleTarget(list, chatTarget(chat('a'))).list.map(t => t.key)).toEqual(['chat:b', 'chat:c', 'chat:d', 'chat:e'])
  })
  it('does not list a person twice when their direct chat (or your own chat) is already listed', () => {
    const chats = [chat('d1', { kind: 'direct', peer: person('bob') }), chat('self', { kind: 'direct', is_self: true, peer: person('me') }), chat('g', { kind: 'group' })]
    expect(peopleWithoutChats([person('bob'), person('me'), person('carol')], chats, 'me').map(p => p.id)).toEqual(['carol'])
  })
})

describe('sending through the outbox', () => {
  function deps(overrides: Partial<ShareSendDeps> = {}): ShareSendDeps {
    let n = 0
    return {
      openDirect: vi.fn(async (id: string) => chat('direct-' + id, { kind: 'direct', title: id })),
      enqueueText: vi.fn(async () => {}), enqueueFiles: vi.fn(async () => {}),
      clientId: vi.fn((conversation: string) => `${conversation}-${++n}`), message: e => (e instanceof Error ? e.message : String(e)), ...overrides,
    }
  }
  const files = [{ key: 'k1', file: file('a.jpg', 'image/jpeg') }]
  it('queues text once per chosen chat, opening a person\'s direct chat on Send', async () => {
    const d = deps(); const done = new Map()
    const result = await sendShare(d, { owner: 'me', targets: [chatTarget(chat('g')), personTarget(person('bob'))], body: '  https://a.test  ', files: [], done })
    expect(d.openDirect).toHaveBeenCalledWith('bob')
    expect(vi.mocked(d.enqueueText).mock.calls.map(call => [call[0], call[1], call[2].body])).toEqual([['me', 'g', 'https://a.test'], ['me', 'direct-bob', 'https://a.test']])
    expect(result.sent.map(c => c.id)).toEqual(['g', 'direct-bob']); expect(result.failed).toEqual([]); expect(d.enqueueFiles).not.toHaveBeenCalled()
  })
  it('queues files with the caption, each chat its own message id', async () => {
    const d = deps(); const done = new Map()
    await sendShare(d, { owner: 'me', targets: [chatTarget(chat('a')), chatTarget(chat('b'))], body: 'Caption', files, done })
    const calls = vi.mocked(d.enqueueFiles).mock.calls
    expect(calls.map(call => [call[1], call[2].body, call[3]])).toEqual([['a', 'Caption', files], ['b', 'Caption', files]])
    expect(calls[0][2].client_id).not.toBe(calls[1][2].client_id)
  })
  it('skips a chat that no longer allows files, keeps going, and retries only the rest', async () => {
    const d = deps({ enqueueFiles: vi.fn(async (_o: string, conversation: string) => { if (conversation === 'b') throw Error('Wait for your outbox to finish restoring.') }) })
    const done = new Map()
    const targets = [chatTarget(chat('a')), chatTarget(chat('b')), chatTarget(chat('text-only', { can: { send: true, send_file: false } as ConversationItem['can'] }))]
    const first = await sendShare(d, { owner: 'me', targets, body: '', files, done })
    expect(first.sent.map(c => c.id)).toEqual(['a'])
    expect(shareFailureMessage(first)).toBe("Sent to a. Not sent to b: Wait for your outbox to finish restoring. text-only: You can't send files in this chat.")
    d.enqueueFiles = vi.fn(async () => {})
    const second = await sendShare(d, { owner: 'me', targets: targets.slice(0, 2), body: '', files, done })
    expect(vi.mocked(d.enqueueFiles).mock.calls.map(call => call[1])).toEqual(['b'])
    expect(second.failed).toEqual([]); expect(second.sent.map(c => c.id)).toEqual(['a', 'b'])
  })
  it('refuses an empty text share and a locked chat', async () => {
    await expect(sendShare(deps(), { owner: 'me', targets: [chatTarget(chat('a'))], body: ' ', files: [], done: new Map() })).rejects.toThrow(/Type a message/)
    const result = await sendShare(deps(), { owner: 'me', targets: [chatTarget(chat('l', { locked: true }))], body: 'x', files: [], done: new Map() })
    expect(shareFailureMessage(result)).toBe('Not sent. l: This chat is locked.')
  })
})

describe('waiting for sign-in and unlock', () => {
  const base = { pending: true, status: 'ready', signedIn: true, path: '/messenger', opened: false }
  it('keeps a share while signed out or the session is still loading, and opens it once someone is signed in', () => {
    expect(shareStep({ ...base, status: 'anonymous', signedIn: false, path: '/login' })).toBe('wait')
    expect(shareStep({ ...base, status: 'loading', signedIn: false })).toBe('wait')
    expect(shareStep({ ...base, status: 'unreachable', signedIn: false })).toBe('wait')
    expect(shareStep(base)).toBe('open')
  })
  it('does not reopen the page when it is already shown or was already opened for this share', () => {
    expect(shareStep({ ...base, path: '/share' })).toBe('stay')
    expect(shareStep({ ...base, opened: true })).toBe('stay')
    expect(shareStep({ ...base, pending: false })).toBe('idle')
  })
  it('binds an unowned share to whoever signs in, never shows another account\'s, and drops it after the time limit', () => {
    const now = 1_000_000_000
    expect(shareUsable({ owner: null, at: now }, 'alice', now)).toBe(true)
    expect(shareUsable({ owner: 'alice', at: now }, 'alice', now)).toBe(true)
    expect(shareUsable({ owner: 'bob', at: now }, 'alice', now)).toBe(false)
    expect(shareUsable({ owner: null, at: now - SHARE_TTL - 1 }, 'alice', now)).toBe(false)
  })
})
