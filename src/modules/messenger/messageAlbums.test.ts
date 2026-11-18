import { expect, it } from 'vitest'
import type { Message } from './api'
import { messageAlbums } from './messageAlbums'
import { attachmentClientId } from './attachmentMessages'
const id = 'abcd1234-1234-4123-8123-12345678ffff'
const message = (index: number): Message => ({ id: String(index), client_id: attachmentClientId(id, index, ''), conversation: 'chat', seq: index + 1, kind: 'attachment', body: index ? '' : 'Photos', sender: { id: 'me', name: 'Me' }, deleted: false, forwarded: false, reactions: [], edited_at: null, attachments: [{ id: String(index), kind: 'image', status: 'ready' }] } as unknown as Message)
it('groups sequential batch uploads without losing attachment identities or newest read sequence', () => {
 const source = Array.from({ length: 7 }, (_, i) => message(i)); const rows = messageAlbums(source)
 expect(rows).toHaveLength(1); expect(rows[0].attachments).toHaveLength(7); expect(rows[0].seq).toBe(7); expect(rows[0].body).toBe('Photos'); expect(source[0].attachments).toHaveLength(1)
 expect(new Set(source.map(m=>m.client_id)).size).toBe(7)
})
it('keeps focused messages, captions, different senders and deletions separate', () => {
 const source = [message(0),message(1)]
 expect(messageAlbums(source,2)).toHaveLength(2)
 for(const patch of [{body:'Caption'}, {deleted:true}, {sender:{id:'other',name:'Other'}}, {seq:10}]) expect(messageAlbums([source[0],{...source[1],...patch} as Message])).toHaveLength(2)
})

it('keeps two and three photos in separate bubbles and groups four', () => {
 for (const count of [2, 3]) expect(messageAlbums(Array.from({length: count}, (_, i) => message(i)))).toHaveLength(count)
 expect(messageAlbums(Array.from({length: 4}, (_, i) => message(i)))).toHaveLength(1)
})

it('splits older small multi-photo messages without duplicating their caption', () => {
 const first = message(0); const second = message(1)
 const rows = messageAlbums([{...first, attachments: [...first.attachments, ...second.attachments]}])
 expect(rows).toHaveLength(2)
 expect(rows.map(row => row.attachments[0].id)).toEqual(['0', '1'])
 expect(rows.map(row => row.body)).toEqual(['', 'Photos'])
})
