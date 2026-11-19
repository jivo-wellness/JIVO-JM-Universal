// Deterministic UI/API contract checks. No real accounts or external requests.
const { chromium, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = 'http://localhost:' + Number(fs.readFileSync('.local-ui-port', 'utf8'))
const code = 'TKT-1234567890ABCDEF'
const me = { id: 'me', name: 'Ticket Tester', display_name: 'Ticket Tester', full_name: 'Ticket Tester', email: 'tester@example.invalid', phone: '', bio: '', avatar_url: null, can_create_groups: false, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_TICKETS_RESOLVE'], session: { id: 'session', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    fs.mkdirSync('test-results', { recursive: true })
    for (const [width, height] of [[360, 800], [768, 1000], [1440, 1000]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: width === 768 ? 'reduce' : 'no-preference' }); const page = await context.newPage()
      const errors = [], unexpected = [], posts = []; let ticket = null, version = 0, deny = false
      const stamp = () => new Date(Date.UTC(2026, 10, 19, 12, 0, ++version)).toISOString()
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.routeWebSocket('**/ws/', socket => { socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(data => { if (JSON.parse(data).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
        if (url.origin !== base) { unexpected.push(req.url()); return route.abort() }
        if (!path.startsWith('/api/')) return route.continue()
        const send = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers })
        const body = req.headers()['content-type']?.includes('application/json') ? req.postDataJSON() : {}
        if (path === '/api/jm/auth/csrf/') return send({}, 200, { 'set-cookie': 'jm_csrftoken=mock-csrf; Path=/; SameSite=Lax' })
        if (method !== 'GET') assert.equal(req.headers()['x-csrftoken'], 'mock-csrf')
        if (path === '/api/jm/me/') return send({ ...me, capabilities: deny ? [] : me.capabilities })
        if (path === '/api/jm/alerts/active/') return send({ results: [], next_cursor: null })
        if (path === '/api/jm/appearance/') return send({ type: 'default', color: null, image_url: null })
        if (path === '/api/jm/auth/options/') return send({ passkey_sign_in: false })
        if (path === '/api/jm/notifications/summary/') return send({ unread_conversations: 0, unread_messages: 0, unread_notifications: 0, mention_unread: false })
        if (path === '/api/jm/notifications/' || path === '/api/jm/me/security-notices/') return send({ results: [], next_cursor: null })
        if (path === '/api/jm/me/notification-preferences/') return send({ push_enabled: false, sound_enabled: false, vibrate_enabled: false })
        if (path === '/api/jm/uploads/' && method === 'POST') { assert.match(req.postDataBuffer().toString(), /name="purpose"\r\n\r\nticket/); return send({ id: 'upload', status: 'ready', scan_status: 'clean', name: 'steps.txt', size: 12, mime: 'text/plain', kind: 'file' }) }
        if (path === '/api/jm/tickets/resolvers/') return send([{ id: 'resolver', name: 'Example Resolver' }])
        if (path === '/api/jm/tickets/' && method === 'POST') {
          posts.push(body); ticket = { ...body, code, status: 'open', status_label: 'Open', priority_label: 'Medium', raised_by: me, assignee: null, created_at: stamp(), updated_at: stamp(), resolution: '', files: body.files.length ? [{ id: 'attachment', name: 'steps.txt', size: 12 }] : [], timeline: [], can: { resolve: true, assign: true, reopen: false, withdraw: true } }; return send(ticket, 201)
        }
        if (path === '/api/jm/tickets/' && method === 'GET') return send({ count: ticket ? 1 : 0, results: ticket ? [ticket] : [], counts: { open: 1, in_progress: 0, resolved: 0, closed: 0 }, may_resolve: true })
        if (path === `/api/jm/tickets/${code}/files/attachment/`) return route.fulfill({ contentType: 'text/plain', body: 'reproduction' })
        if (path === `/api/jm/tickets/${code}/comments/`) { ticket.timeline.push({ id: 'comment', author: me, body: body.body, event: '', at: stamp(), files: [] }); ticket.updated_at = stamp(); return send(ticket) }
        if (path === `/api/jm/tickets/${code}/`) {
          if (method === 'PATCH') { Object.assign(ticket, body); if (body.assignee) ticket.assignee = { id: body.assignee, name: 'Example Resolver' }; ticket.status_label = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }[ticket.status]; ticket.can.reopen = ['resolved', 'closed'].includes(ticket.status); ticket.can.withdraw = !ticket.can.reopen; ticket.updated_at = stamp() }
          return send(ticket)
        }
        unexpected.push(`${method} ${path}`); return send({ detail: 'Unexpected mock request' }, 404)
      })
      try {
        await page.goto(base + '/home'); await page.getByTestId('workspace-shell').waitFor();
        await page.evaluate(() => { window.shellNodes = ['workspace-shell', 'workspace-header', 'workspace-footer', 'workspace-rail'].map(id => [id, document.querySelector(`[data-testid="${id}"]`)]).filter(([, node]) => node) })
        await page.evaluate(() => { window.contentMotion = []; new MutationObserver(() => { const node = document.querySelector('[data-testid="workspace-content"]'); if (node && Number(getComputedStyle(node).opacity) < 0.999) window.contentMotion.push(getComputedStyle(node).opacity) }).observe(document.documentElement, { attributes: true, attributeFilter: ['style'], subtree: true }) })
        const stableShell = async () => assert.equal(await page.evaluate(() => window.shellNodes.every(([id, node]) => node.isConnected && node === document.querySelector(`[data-testid="${id}"]`))), true, 'The shell must stay mounted across routes')
        await page.getByRole('link', { name: 'Bug tickets', exact: true }).last().click()
        await page.getByRole('button', { name: 'Report a bug', exact: true }).click()
        await stableShell(); await expect(page.getByTestId('workspace-shell')).toHaveCount(1);
        await page.getByLabel('Title', { exact: true }).fill('Photos stay pending in group chats')
        await page.getByLabel('Description', { exact: true }).fill('Open the app and reproduce the problem.')
        await page.getByLabel('Affected screen (optional)', { exact: true }).fill('Home')
        const choose = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Add attachment', exact: true }).click(); await (await choose).setFiles({ name: 'steps.txt', mimeType: 'text/plain', buffer: Buffer.from('reproduction') })
        await page.getByRole('button', { name: 'Remove steps.txt', exact: true }).waitFor()
        await page.screenshot({ path: `test-results/tickets-report-${width}.png`, fullPage: true }); await page.getByRole('button', { name: 'Submit ticket', exact: true }).click()
        await page.getByText('Photos stay pending in group chats', { exact: true }).waitFor(); assert.equal(posts.length, 1); assert.deepEqual(posts[0].files, ['upload']); await stableShell()
        await page.getByRole('button', { name: 'Manage ticket', exact: true }).click(); await page.getByRole('button', { name: 'Assignee', exact: true }).click(); await page.getByRole('button', { name: 'Example Resolver', exact: true }).click()
        await page.getByRole('button', { name: 'Status', exact: true }).click(); await page.getByRole('button', { name: 'In progress', exact: true }).click()
        await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(page.getByText('Assigned to Example Resolver', { exact: true })).toBeVisible()
        await page.getByLabel('Reply message', { exact: true }).fill('Investigating this issue.')
        await page.getByRole('button', { name: 'Send reply', exact: true }).click(); await expect(page.getByText('Investigating this issue.', { exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Manage ticket', exact: true }).click(); await page.getByRole('button', { name: 'Status', exact: true }).click(); await page.getByRole('button', { name: 'Resolved', exact: true }).click()
        await page.getByLabel('Resolution / closing reason', { exact: true }).fill('Fixed and verified.')
        await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await page.getByRole('button', { name: 'Reopen ticket', exact: true }).click()
        await expect.poll(() => ticket.status).toBe('open')
        await page.getByRole('button', { name: 'steps.txt · 1 KB', exact: true }).click()
        const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Confirm attachment export', exact: true }).click(); assert.equal((await download).suggestedFilename(), 'export-steps.txt'); await page.getByRole('button', { name: 'Close attachment export', exact: true }).click()
        await page.screenshot({ path: `test-results/tickets-${width}.png`, fullPage: true })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Horizontal overflow')
        await page.getByRole('button', { name: 'Back to tickets', exact: true }).click(); await page.getByRole('button', { name: `Open ${code}`, exact: true }).waitFor(); await page.screenshot({ path: `test-results/tickets-list-${width}.png`, fullPage: true });
        await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click(); await page.getByRole('button', { name: 'Switch to light theme', exact: true }).waitFor();
        await page.screenshot({ path: `test-results/tickets-list-dark-${width}.png`, fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Dark theme overflow');
        await stableShell()
        if (width === 768) { const opacity = await page.getByTestId('workspace-content').evaluate(node => getComputedStyle(node).opacity); assert.equal(opacity, '1', 'Reduced motion keeps content fully opaque'); assert.deepEqual(await page.evaluate(() => window.contentMotion), [], 'Reduced motion disables the transition throughout navigation') }
        if (width !== 768) assert.ok(await page.evaluate(() => window.contentMotion.length > 0), 'Navigation animates only the content outlet')
        await page.goBack(); await page.getByText('Photos stay pending in group chats', { exact: true }).first().waitFor(); await stableShell()
        deny = true; await page.reload(); await expect(page.getByText('JM access is required', { exact: true })).toBeVisible()
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []); console.log(`PASS tickets ${width}px: report + upload, assign, status, reply, resolve, reopen, export, access gate, persistent shell, back navigation`)
      } catch (error) { await page.screenshot({ path: `test-results/tickets-failure-${width}.png`, fullPage: true }); console.error({ errors, unexpected }); throw error }
      finally { await context.close() }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
