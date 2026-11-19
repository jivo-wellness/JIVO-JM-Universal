// Deterministic UI/API contract checks. No real accounts or external requests.
const { chromium, expect } = require('@playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = 'http://localhost:' + Number(fs.readFileSync('.local-ui-port', 'utf8'))
const me = { id: 'me', name: 'Ticket Tester', display_name: 'Ticket Tester', full_name: 'Ticket Tester', email: 'tester@example.invalid', phone: '', bio: '', avatar_url: null, can_create_groups: false, companies: [], groups: [], capabilities: ['JM_ACCESS', 'JM_TICKETS_RESOLVE'], session: { id: 'session', expires_at: '2027-01-01', auth_method: 'password' }, security: { mfa_enrolled: false, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [], recovery_codes_left: 0, locked_capabilities: [], locked_out: false } }
async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    fs.mkdirSync('test-results', { recursive: true })
    for (const [width, height] of [[360, 800], [1440, 1000]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: width === 768 ? 'reduce' : 'no-preference' }); const page = await context.newPage()
      const errors = [], unexpected = [], posts = []; const conversation = { id: 'atlas-account', kind: 'direct', is_atlas: false, title: 'Example person', peer: { id: 'atlas', name: 'Atlas' }, unread: 0, unread_count: 0, last_seq: 0, can: { send: true, send_file: false } }; let deny = false, liveSocket, online = true
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
      await page.routeWebSocket('**/ws/', socket => { liveSocket = socket; socket.send(JSON.stringify({ type: 'HELLO', data: {} })); socket.onMessage(data => { if (JSON.parse(data).type === 'PING') socket.send(JSON.stringify({ type: 'PONG', data: {} })) }) })
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url()), path = url.pathname, method = req.method()
        if (url.origin !== base) { unexpected.push(req.url()); return route.abort() }
        if (!path.startsWith('/api/')) return route.continue()
        const send = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers })
        const body = req.headers()['content-type']?.includes('application/json') ? req.postDataJSON() : {}
        if (path === '/api/jm/auth/csrf/') return send({}, 200, { 'set-cookie': 'jm_csrftoken=mock-csrf; Path=/; SameSite=Lax' })
        if (method !== 'GET') assert.equal(req.headers()['x-csrftoken'], 'mock-csrf')
        if (path === '/api/jm/me/') return send(me)
        if (path === '/api/jm/alerts/active/') return send({ results: [], next_cursor: null })
        if (path === '/api/jm/appearance/') return send({ type: 'default', color: null, image_url: null })
        if (path === '/api/jm/auth/options/') return send({ passkey_sign_in: false })
        if (path === '/api/jm/notifications/summary/') return send({ unread_conversations: 0, unread_messages: 0, unread_notifications: 0, mention_unread: false })
        if (path === '/api/jm/notifications/' || path === '/api/jm/me/security-notices/') return send({ results: [], next_cursor: null })
        if (path === '/api/jm/me/notification-preferences/') return send({ push_enabled: false, sound_enabled: false, vibrate_enabled: false })
        if (path === '/api/jm/users/presence/') { assert.equal(url.searchParams.get('ids'), 'atlas'); return send({ results: { atlas: { online, last_seen_at: '2026-11-18T10:00:00Z' } } }) }
        if (path === '/api/jm/atlas/status/') return send({ enabled: true, allowed: !deny, message: null })
        if (path === '/api/jm/conversations/') return send({ results: [conversation], next_cursor: null })
        if (path === '/api/jm/conversations/atlas-account/') return send(conversation)
        if (path === '/api/jm/atlas/asks/') {
          if (method === 'POST') { posts.push(body); return send({ id: posts.length, ...body, state: 'done', answer: 'Synthetic Atlas answer', created_at: new Date().toISOString(), answered_at: new Date().toISOString(), open: false }, 201) }
          return send({ results: [], has_more: false })
        }
        unexpected.push(`${method} ${path}`); return send({ detail: 'Unexpected mock request' }, 404)
      })
      try {
        await page.goto(base + '/messenger')
        const row = page.getByRole('button', { name: 'Open Example person', exact: true })
        const dot = row.getByLabel('online', { exact: true })
        await expect(dot).toBeVisible()
        const geometry = await dot.evaluate(node => { const dot = node.getBoundingClientRect(), avatar = node.parentElement.getBoundingClientRect(); return { right: dot.right - avatar.right, top: dot.top - avatar.top, width: dot.width, avatar: avatar.width } })
        assert.deepEqual(geometry, { right: 0, top: 0, width: 12, avatar: 48 })
        await page.screenshot({ path: `test-results/presence-list-${width}.png` })
        online = false
        liveSocket.send(JSON.stringify({ type: 'USER_OFFLINE', data: { user: 'atlas', last_seen_at: '2026-11-18T10:00:00Z' } }))
        await expect(dot).toHaveCount(0)
        await expect(row).not.toContainText('last seen')
        online = true
        liveSocket.send(JSON.stringify({ type: 'USER_ONLINE', data: { user: 'atlas' } }))
        await expect(dot).toBeVisible()
        assert.deepEqual(unexpected, [])
        assert.deepEqual(errors, [])
        console.log(`Chat avatar presence position and online/offline updates PASS ${width}`)
      } finally { await context.close() }
    }
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
