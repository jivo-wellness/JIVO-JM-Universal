import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { mayStash, SHARE_INTAKE_BYTES, SHARE_TTL, shareBodyTooLarge, shareExpired, shareIntake, shareIntakeMessage, shareRedirect } from './shareTarget'

type Fake = { name: string; size: number; type: string }
const isFile = (value: unknown): value is Fake => typeof value === 'object' && value !== null && 'size' in value
function form(fields: Record<string, string>, files: Fake[] = []) {
  return { get: (name: string) => fields[name] ?? null, getAll: (name: string) => (name === 'files' ? files : []) }
}
const f = (name: string, size = 10, type = 'image/jpeg'): Fake => ({ name, size, type })

describe('service worker share intake (Web Share Target)', () => {
  it('takes text and link as one message', () => {
    expect(shareIntake(form({ title: 'Page', text: 'Read this https://a.test', url: 'https://a.test' }), isFile)).toEqual({ ok: true, text: 'Page\nRead this https://a.test', files: [], dropped: 0 })
  })
  it('takes one or several files in order and ignores empty ones and non-file fields', () => {
    const one = shareIntake(form({}, [f('a.jpg')]), isFile)
    expect(one).toEqual({ ok: true, text: '', files: [f('a.jpg')], dropped: 0 })
    const many = shareIntake({ get: () => null, getAll: () => [f('a.jpg'), 'not a file', f('empty.txt', 0), f('b.pdf', 5, 'application/pdf')] }, isFile)
    expect(many.ok && many.files.map(x => x.name)).toEqual(['a.jpg', 'b.pdf'])
  })
  it('keeps the first ten files and counts the rest', () => {
    const result = shareIntake(form({}, Array.from({ length: 13 }, (_, i) => f(`p${i}.jpg`))), isFile)
    expect(result.ok && result.files.length).toBe(10); expect(result.ok && result.dropped).toBe(3)
  })
  it('refuses too much text or too many bytes, and an empty share', () => {
    expect(shareIntake(form({ text: 'x'.repeat(4001) }), isFile)).toEqual({ ok: false, reason: 'limit' })
    expect(shareIntake(form({}, [f('big.mp4', SHARE_INTAKE_BYTES + 1, 'video/mp4')]), isFile)).toEqual({ ok: false, reason: 'limit' })
    expect(shareIntake(form({ text: '  ' }), isFile)).toEqual({ ok: false, reason: 'empty' })
  })
  it('refuses a declared body over the cap before reading it', () => {
    expect(shareBodyTooLarge(String(SHARE_INTAKE_BYTES + 70_000))).toBe(true)
    expect(shareBodyTooLarge(String(SHARE_INTAKE_BYTES))).toBe(false)
    expect(shareBodyTooLarge(null)).toBe(false)
  })
  it('redirects to the share page, with the reason when nothing was kept, and the page explains it', () => {
    expect(shareRedirect()).toBe('/share')
    expect(shareRedirect('limit')).toBe('/share?shareError=limit')
    expect(shareIntakeMessage('limit')).toMatch(/up to 10 files and 100 MB/)
    expect(shareIntakeMessage('empty')).toMatch(/Nothing was shared/)
    expect(shareIntakeMessage('whatever')).toMatch(/could not be received/)
  })
  it('drops a POST that raced a sign-out, and lets a newer share replace an older one', () => {
    expect(mayStash(3, 3)).toBe(true)
    expect(mayStash(0, undefined)).toBe(true)
    expect(mayStash(3, 4)).toBe(false)
  })
  it('expires a stash after the time limit or with an impossible time', () => {
    const now = 5_000_000_000
    expect(shareExpired(now - SHARE_TTL + 1, now)).toBe(false)
    expect(shareExpired(now - SHARE_TTL - 1, now)).toBe(true)
    expect(shareExpired(now + 3_600_000, now)).toBe(true)
    expect(shareExpired('x', now)).toBe(true)
  })
  it('stays importable by the worker build (no imports)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'shareTarget.ts'), 'utf8')
    expect(source).not.toMatch(/^\s*import\s/m)
    expect(source).not.toMatch(/^export\s+\{[^}]*\}\s+from/m)
  })
})
