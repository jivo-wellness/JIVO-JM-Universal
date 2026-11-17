import { describe, expect, it } from 'vitest'
import { canManageTools, movedIds, toolProblem } from './manage'

const data = { name: 'HO', description: '', web_url: 'https://ho.example.com', app_url: '', position: 10, is_active: true }

describe('managing tools on the Tools screen', () => {
  it('only with ADMIN_TOOLS_MANAGE (ADMIN_USERS alone is not enough)', () => {
    expect(canManageTools(['JM_ACCESS', 'ADMIN_TOOLS_MANAGE'])).toBe(true)
    expect(canManageTools(['JM_ACCESS', 'ADMIN_USERS', 'ADMIN_AUDIT'])).toBe(false)
    expect(canManageTools([])).toBe(false)
  })
  it('moves one tool and keeps the rest in order', () => {
    expect(movedIds(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    expect(movedIds(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c'])
    expect(movedIds(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })
  it('checks the links before sending', () => {
    expect(toolProblem(data)).toBe('')
    expect(toolProblem({ ...data, app_url: 'jivo-ho://home' })).toBe('')
    expect(toolProblem({ ...data, name: ' ' })).not.toBe('')
    expect(toolProblem({ ...data, web_url: 'http://ho.example.com' })).not.toBe('')
    expect(toolProblem({ ...data, app_url: 'javascript:alert(1)' })).not.toBe('')
  })
})
