import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as oversight from './oversight/api'
import * as admin from './api'
const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }))
vi.mock('@/core/api/client', () => ({ api: client }))

beforeEach(() => { vi.resetAllMocks(); client.get.mockResolvedValue({ data: {} }); client.post.mockResolvedValue({ data: {}, status: 200 }) })
describe('native admin uses the web API contracts', () => {
  it('reads as a person only through audited read-only routes', async () => {
    await oversight.getAsConversation('person','chat')
    await oversight.listAsMessages('person','chat',{around:'message'})
    expect(client.get.mock.calls.map(call => call[0])).toEqual(['/oversight/as/person/conversations/chat/','/oversight/as/person/conversations/chat/messages/'])
    expect(client.get.mock.calls[1][1]).toEqual({params:{around:'message'}})
    expect(client.post).not.toHaveBeenCalled()
  })
  it('retains the pair and pagination filters', async () => {
    await oversight.listConversations({person:'first',with:'second',q:''},'next')
    expect(client.get).toHaveBeenCalledWith('/oversight/conversations/',{params:{person:'first',with:'second',cursor:'next'}})
  })
  it('never treats approval-pending reveals as a secret', async () => {
    client.post.mockResolvedValue({status:202,data:{status:'pending'}})
    expect(await oversight.revealEntry('entry',' reason ')).toEqual({status:'pending'})
    expect(client.post).toHaveBeenCalledWith('/oversight/entries/entry/reveal/',{reason:'reason',field:'password'},{baseURL:'/api/jp'})
  })
  it('retains the server reveal lifetime', async () => {
    client.post.mockResolvedValue({status:200,data:{value:'synthetic',expires_in:8}})
    expect(await oversight.revealEntry('entry','')).toEqual({status:'revealed',value:'synthetic',expires_in:8})
  })
  it('uses group removal mode and preserves partial results', async () => {
    const result={removed:[],skipped:[{user_id:'self',reason:'self_action_forbidden'}]}
    client.post.mockResolvedValue({data:result})
    expect(await admin.removeCapabilityHolders('JM_ACCESS',['self'])).toBe(result)
    expect(client.post).toHaveBeenCalledWith('/admin/capabilities/JM_ACCESS/holders/remove/',{user_ids:['self'],mode:'groups'})
  })
  it('sends freeze reasons and an explicit optional end', async () => {
    await admin.freezeUser('person',{reason:'Test restriction',until:null})
    expect(client.post).toHaveBeenCalledWith('/admin/users/person/freeze/',{reason:'Test restriction',until:null})
  })
  it('does not consider an elapsed freeze active', () => {
    expect(admin.isFrozen({frozen_at:'2026-01-01',frozen_until:'2026-02-01'},new Date('2026-03-01'))).toBe(false)
    expect(admin.isFrozen({frozen_at:'2026-01-01',frozen_until:null})).toBe(true)
  })
  it('preserves audit integrity results and cursor filters', async () => {
    const result={results:[],cursor:'next',verification:{stream:'admin',ok:false,checked:4,broken_at:5}}
    client.get.mockResolvedValue({data:result})
    expect(await admin.listAudit({stream:'admin',action:'',actor:'person'},'cursor')).toBe(result)
    expect(client.get).toHaveBeenCalledWith('/admin/audit/',{params:{stream:'admin',actor:'person',cursor:'cursor'}})
  })
})
