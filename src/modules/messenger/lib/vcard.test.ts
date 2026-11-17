import { describe, expect, it } from 'vitest'

import { buildVCard, isVCard, parseVCard, parseVCardDetails, phoneKey, telHref, vcardFile } from './vcard'

describe('vCard', () => {
  it('round-trips a contact, escaping separators', () => {
    const c = { name: 'Suresh, Plumber; Plant 2', phones: ['+91 99999 00000', ''], emails: ['s@x.test'] }
    const text = buildVCard(c)
    expect(text.startsWith('BEGIN:VCARD\r\n')).toBe(true)
    expect(parseVCard(text)).toEqual({ name: 'Suresh, Plumber; Plant 2', phones: ['+91 99999 00000'], emails: ['s@x.test'] })
  })

  it('reads cards from phones (folded lines, item prefixes, no FN)', () => {
    const text = 'BEGIN:VCARD\nVERSION:3.0\nN:Kumar;Ravi;;;\nitem1.TEL;type=CELL:+91 1\n 2345\nEMAIL;TYPE=INTERNET:r@x.test\nEND:VCARD\n'
    expect(parseVCard(text)).toEqual({ name: 'Ravi Kumar', phones: ['+91 12345'], emails: ['r@x.test'] })
  })

  it('treats values as text and names the file safely', () => {
    expect(parseVCard('BEGIN:VCARD\nFN:<img src=x onerror=alert(1)>\nEND:VCARD').name).toBe('<img src=x onerror=alert(1)>')
    const f = vcardFile({ name: 'A/B:C', phones: ['1'], emails: [] })
    expect(f.name).toBe('A B C.vcf')
    expect(f.type).toBe('text/vcard')
    expect(isVCard({ mime: 'text/vcard', name: 'x' }) && isVCard({ mime: '', name: 'Y.VCF' })).toBe(true)
  })

  it('shows each number once (spaces, dashes and brackets ignored) and keeps its type label', () => {
    const text = [
      'BEGIN:VCARD',
      'FN:Rohit',
      'TEL;TYPE=CELL:+918287273160',
      'TEL;TYPE=VOICE:+91 82872-73160',
      'TEL:tel:+918287273160',
      'item1.TEL;type=WORK,VOICE:(011) 4000 1234',
      'TEL;TYPE=HOME:011 4000 1234',
      'TEL:08287273160',
      'EMAIL:R@x.test',
      'EMAIL:r@x.test',
      'END:VCARD',
    ].join('\n')
    expect(parseVCardDetails(text)).toEqual({
      name: 'Rohit',
      phones: [{ number: '+918287273160', label: 'Mobile' }, { number: '(011) 4000 1234', label: 'Work' }, { number: '08287273160' }],
      emails: ['R@x.test'],
    })
    expect(parseVCard(text).phones).toEqual(['+918287273160', '(011) 4000 1234', '08287273160'])
  })

  it('takes a label from a later copy of the same number, and dials digits only', () => {
    const c = parseVCardDetails('BEGIN:VCARD\nFN:A\nTEL:+91 99999 00000\nTEL;CELL:+919999900000\nEND:VCARD')
    expect(c.phones).toEqual([{ number: '+91 99999 00000', label: 'Mobile' }])
    expect(phoneKey('+91 (999) 99-000')).toBe(phoneKey('+9199999000'))
    expect(telHref('+91 99999-00000')).toBe('tel:+919999900000')
    expect(parseVCard(buildVCard({ name: 'A', phones: ['+91 99999 00000', '+919999900000'], emails: [] })).phones).toEqual(['+91 99999 00000'])
  })
})
