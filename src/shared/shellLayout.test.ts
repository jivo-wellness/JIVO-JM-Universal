import { describe, expect, it } from 'vitest'
import { chatListWidth, controlHeight, touchBox, MIN_TOUCH, isActiveLink, isActiveShellLink, isWide, pagePadding, shellLinks } from './shellLayout'

describe('reference shell layout', () => {
  it('switches to the rail at the md breakpoint', () => {
    expect([390, 767, 768, 1440].map(isWide)).toEqual([false, false, true, true])
  })
  it('uses the 16px phone gutter and 32px desktop padding', () => {
    expect(pagePadding(390)).toEqual({ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24 })
    expect(pagePadding(768).paddingHorizontal).toBe(32)
    expect(pagePadding(1440)).toEqual({ paddingHorizontal: 32, paddingTop: 32, paddingBottom: 40 })
  })
  it('keeps 40px controls on web and 44pt touch targets on native', () => {
    expect([controlHeight('web'), controlHeight('ios'), controlHeight('android')]).toEqual([40, 44, 44])
  })
  it('orders rail and phone tabs like the reference and hides unauthorized pages', () => {
    const all = shellLinks(['JM_ACCESS', 'JP_ACCESS', 'ADMIN_USER_VIEW', 'ADMIN_GROUP_VIEW', 'ADMIN_SECURITY_POLICY'])
    expect(all.rail.map(l => l.title)).toEqual(['Home', 'Messenger', 'Notifications', 'Bug tickets', 'Passwords', 'Tools', 'Approvals', 'People', 'Permission groups', 'Security'])
    expect(all.tabs.map(l => l.tabTitle)).toEqual(['Home', 'Tools', 'Chats', 'Passwords', 'Profile'])
    expect(all.account.map(l => l.href)).toEqual(['/profile', '/tickets', '/alerts', '/tools', '/approvals', '/admin'])
    expect(all.tools).toBe('/notifications')
    // Reference BottomNav: without Passwords the JM Alerts list takes that slot.
    expect(shellLinks(['JM_ACCESS']).tabs.map(l => l.tabTitle)).toEqual(['Home', 'Alerts', 'Chats', 'Tools', 'Profile'])
    expect(shellLinks(['ADMIN_USER_VIEW', 'ADMIN_GROUP_VIEW', 'ADMIN_SECURITY_POLICY', 'ADMIN_APPROVALS']).rail.map(l => l.href)).toEqual(['/home', '/approvals', '/admin?tab=people', '/admin?tab=groups', '/admin?tab=security'])
    expect(shellLinks(['ADMIN_GROUP_VIEW']).rail.map(l => l.title)).toEqual(['Home', 'Permission groups'])
    expect(shellLinks(['ADMIN_GROUP_VIEW']).tools).toBe('/admin?tab=groups')
    expect(shellLinks([]).tabs.map(l => l.href)).toEqual(['/home', '/profile'])
    expect(shellLinks([], true).rail).toHaveLength(12)
    // One Tools entry; tool managers reach it even without Messenger, and there is no separate Software tools link.
    expect(shellLinks(['JM_ACCESS', 'ADMIN_USER_VIEW', 'ADMIN_GROUP_VIEW', 'ADMIN_TOOLS_MANAGE']).rail.filter(l => l.icon === 'tools').map(l => l.href)).toEqual(['/tools'])
    expect(shellLinks(['ADMIN_USER_VIEW', 'ADMIN_GROUP_VIEW', 'ADMIN_TOOLS_MANAGE']).rail.map(l => l.href)).toContain('/tools')
  })
  it('lights the link for the current view of a page', () => {
    const { rail, tabs } = shellLinks(['JM_ACCESS', 'ADMIN_USER_VIEW', 'ADMIN_GROUP_VIEW'])
    const lit = (pathname: string, params: Record<string, string>) => [...rail, ...tabs].filter(l => isActiveShellLink(pathname, params, l)).map(l => l.title)
    expect(lit('/admin', {})).toEqual(['People'])
    expect(lit('/admin', { tab: 'groups' })).toEqual(['Permission groups'])
    expect(lit('/alerts', {})).toEqual(['Alerts'])
    expect(lit('/notifications', {})).toEqual(['Notifications'])
    expect(shellLinks(['ADMIN_GROUP_VIEW']).rail.filter(l => isActiveShellLink('/admin', {}, l)).map(l => l.title)).toEqual(['Permission groups'])
  })
  it('uses the reference chats column widths', () => {
    expect([768, 1023, 1024, 1440].map(chatListWidth)).toEqual([360, 360, 400, 400])
  })
  it('matches a link and its sub-routes only', () => {
    expect(isActiveLink('/messenger/abc', '/messenger')).toBe(true)
    expect(isActiveLink('/messengers', '/messenger')).toBe(false)
    expect(isActiveLink('/home', '/home')).toBe(true)
  })
})

describe('touchBox (DEF-005)', () => {
  it('grows small controls to 44px on phones without moving the layout', () => {
    expect(touchBox(36, 390)).toMatchObject({ width: MIN_TOUCH, height: MIN_TOUCH, margin: -4 })
    expect(touchBox(40, 320)).toMatchObject({ width: 44, height: 44, margin: -2 })
  })
  it('keeps the drawn size on wide screens and for controls already 44px', () => {
    expect(touchBox(36, 1024)).toMatchObject({ width: 36, height: 36, margin: 0 })
    expect(touchBox(48, 390)).toMatchObject({ width: 48, height: 48 })
  })
})
