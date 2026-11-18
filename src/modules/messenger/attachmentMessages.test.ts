import {expect,it} from 'vitest'
import {attachmentMessages} from './attachmentMessages'
it('sends one file per ordered message, with the caption only once and stable retry IDs',()=>{
 const files=[{key:'a'},{key:'b'},{key:'c'}]
 const payload={client_id:'batch',body:'Caption',reply_to:'reply',upload_ids:['existing']}
 const plan=attachmentMessages(payload,files)
 expect(plan.map(m=>m.file.key)).toEqual(['a','b','c'])
 expect(plan.map(m=>m.payload.client_id)).toEqual(['batch','b','c'])
 expect(plan.map(m=>m.payload.body)).toEqual(['Caption','',''])
 expect(plan.map(m=>m.payload.upload_ids)).toEqual([['existing'],[],[]])
 expect(plan.every(m=>m.payload.reply_to==='reply')).toBe(true)
 expect(attachmentMessages(payload,files)).toEqual(plan)
 expect(payload.body).toBe('Caption')
})
