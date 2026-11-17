import { describe, expect, it } from 'vitest'
import { MAX_FILES, acceptFiles, cleanContact, contactSummary, editable, extensionOf, fileKind, matchContact, nextSelection, sendContactsLabel, sendFilesLabel, toggleChosen, typedContact, vcardName } from './selection'

const file = (name: string, mime: string, size = 1000) => ({ name, mime, size, uri: 'file:///' + name })

describe('attachment selection', () => {
  it('classifies images, videos and documents', () => {
    expect(fileKind(file('a.jpg', 'image/jpeg'))).toBe('image')
    expect(fileKind(file('a.mp4', 'video/mp4'))).toBe('video')
    expect(fileKind(file('a.mov', 'application/octet-stream'))).toBe('video')
    expect(fileKind(file('a.pdf', 'application/pdf'))).toBe('file')
    expect(editable(file('a.gif', 'image/gif'))).toBe(false)
    expect(editable(file('a.png', 'image/png'))).toBe(true)
    expect(extensionOf('Quarterly report.final.xlsx')).toBe('XLSX')
    expect(extensionOf('README')).toBe('FILE')
  })
  it('keeps at most 10 files and drops files over the size limits with a reason', () => {
    const many = Array.from({ length: 12 }, (_, i) => file(`p${i}.jpg`, 'image/jpeg'))
    const result = acceptFiles(3, many)
    expect(result.accepted).toHaveLength(MAX_FILES - 3)
    expect(result.rejected).toHaveLength(5)
    expect(result.notice).toContain('Up to 10 files per message.')
    const big = acceptFiles(0, [file('huge.jpg', 'image/jpeg', 11 * 1024 * 1024), file('ok.pdf', 'application/pdf')])
    expect(big.accepted.map(f => f.name)).toEqual(['ok.pdf'])
    expect(big.notice).toBe('huge.jpg: Photos can be at most 10 MB.')
  })
  it('moves the selection to a neighbour when the shown file is removed', () => {
    expect(nextSelection(['a', 'b', 'c'], 'b', 'b')).toBe('c')
    expect(nextSelection(['a', 'b', 'c'], 'c', 'c')).toBe('b')
    expect(nextSelection(['a', 'b'], 'a', 'b')).toBe('b')
    expect(nextSelection(['a'], 'a', 'a')).toBeNull()
    expect(sendFilesLabel(1)).toBe('Send 1 file'); expect(sendFilesLabel(3)).toBe('Send 3 files')
  })
})

describe('phone contacts', () => {
  const asha = { id: '1', name: 'Asha Verma', phones: ['+91 98100-12345'], emails: ['asha@example.invalid'] }
  it('searches by name, email and phone digits', () => {
    expect(matchContact(asha, 'verma')).toBe(true)
    expect(matchContact(asha, 'EXAMPLE')).toBe(true)
    expect(matchContact(asha, '9810012')).toBe(true)
    expect(matchContact(asha, '98 100')).toBe(true)
    expect(matchContact(asha, '12')).toBe(false)
    expect(matchContact(asha, '')).toBe(true)
    expect(contactSummary(asha)).toBe('+91 98100-12345 · asha@example.invalid')
  })
  it('keeps only shareable contacts and builds safe vCard names', () => {
    expect(cleanContact({ name: ' ', phones: [' '], emails: [] })).toBeNull()
    expect(cleanContact({ name: '', phones: ['123'], emails: [] })?.name).toBe('123')
    expect(cleanContact({ name: 'A', phones: ['1', '2', '3', '4', '5', '6', '7'], emails: [''] })?.phones).toHaveLength(5)
    expect(cleanContact({ name: 'A', phones: ['+91 82872 73160', '+918287273160', '+91-82872-73160', '011 4000'], emails: ['R@x.test', 'r@x.test'] })).toEqual({ name: 'A', phones: ['+91 82872 73160', '011 4000'], emails: ['R@x.test'] })
    expect(vcardName({ name: 'a/b:c', phones: [], emails: [] })).toBe('a b c.vcf')
    expect(typedContact({ name: 'Ravi', phone: '', email: '' })).toBeNull()
    expect(typedContact({ name: ' ', phone: '12345', email: '' })).toBeNull()
    expect(typedContact({ name: ' Ravi ', phone: ' 12345 ', email: '' })).toEqual({ name: 'Ravi', phones: ['12345'], emails: [] })
  })
  it('multi-selects up to 10 contacts', () => {
    let chosen: string[] = []
    for (let i = 0; i < 12; i++) chosen = toggleChosen(chosen, String(i))
    expect(chosen).toHaveLength(10)
    expect(toggleChosen(chosen, '3')).not.toContain('3')
    expect(sendContactsLabel(1)).toBe('Send contact'); expect(sendContactsLabel(4)).toBe('Send 4 contacts')
  })
})
