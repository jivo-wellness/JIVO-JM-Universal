/**
 * App-store screenshots from the web build with a fully mocked API (synthetic people, chats and vault entries only).
 *
 *   node scripts/store/capture-store-screens.cjs              (uses JM_STORE_WEB_DIR, building it first if missing)
 *
 * Env:
 *   JM_STORE_WEB_DIR   static web export to serve (default: <tmp>/jm-store-web; built with `expo export` when absent)
 *   JM_STORE_THEMES    comma list of themes, default "dark" (add "light" for light-mode copies in <device>-light/)
 *   JM_STORE_DEVICES   comma list of android-phone,ios-iphone-6.9 (default both)
 *   JM_STORE_ONLY      comma list of screen numbers to capture (e.g. "02,05")
 *
 * Every request that leaves the local static server is aborted, the API (/api/**) and the socket (/ws/) are answered
 * in-process, so nothing reaches a real JM backend. Same approach as mocked-ui.cjs (route interception).
 */
const { chromium } = require('@playwright/test')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const webDir = path.resolve(process.env.JM_STORE_WEB_DIR || path.join(os.tmpdir(), 'jm-store-web'))
const outRoot = path.join(root, 'store', 'screenshots')
const devices = {
  'android-phone': { viewport: { width: 360, height: 720 }, deviceScaleFactor: 3 },
  'ios-iphone-6.9': { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 },
}
const wantedDevices = (process.env.JM_STORE_DEVICES || Object.keys(devices).join(',')).split(',').map(s => s.trim()).filter(Boolean)
const themes = (process.env.JM_STORE_THEMES || 'dark').split(',').map(s => s.trim()).filter(Boolean)
const only = process.env.JM_STORE_ONLY ? process.env.JM_STORE_ONLY.split(',').map(s => s.trim()) : null

// ---------- build + static server ----------
function ensureBuild() {
  if (fs.existsSync(path.join(webDir, 'index.html'))) return
  console.log('Building web export into', webDir)
  const r = spawnSync(process.execPath, [require.resolve('expo/bin/cli', { paths: [root] }), 'export', '--platform', 'web', '--output-dir', webDir, '--max-workers', '1'],
    { cwd: root, stdio: 'inherit', windowsHide: true, env: { ...process.env, NODE_ENV: 'production', EXPO_NO_TELEMETRY: '1' } })
  if (r.status !== 0) throw Error('expo export failed')
}
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.wav': 'audio/wav' }
function serve() {
  const server = http.createServer((req, res) => {
    let p
    try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname) } catch { res.writeHead(400); return res.end() }
    let file = path.resolve(webDir, '.' + p)
    if (!file.startsWith(webDir)) { res.writeHead(403); return res.end() }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(p)) { res.writeHead(404); return res.end() }
      file = path.join(webDir, 'index.html')
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)))
}

// ---------- synthetic data ----------
const NOW = new Date('2026-11-17T11:42:00+05:30')
const ago = min => new Date(NOW.getTime() - min * 60000).toISOString()
const person = (id, name, company = 'JIVO') => ({ id, name, avatar_url: `/api/jm/media/avatar-${id}.png`, company, is_active: true, email: `${id}@example.com` })
const P = {
  me: person('me', 'Rahul Verma'),
  priya: person('priya', 'Priya Sharma'),
  ankit: person('ankit', 'Ankit Joshi'),
  meera: person('meera', 'Meera Nair'),
  vikram: person('vikram', 'Vikram Singh'),
  sneha: person('sneha', 'Sneha Iyer'),
  karan: person('karan', 'Karan Malhotra'),
  it: person('ithelp', 'IT Help'),
  anjali: person('anjali', 'Anjali Rao'),
}
const avatarColors = { me: ['#0f766e', '#14b8a6'], priya: ['#be185d', '#f472b6'], ankit: ['#1d4ed8', '#60a5fa'], meera: ['#7c3aed', '#a78bfa'], vikram: ['#b45309', '#fbbf24'], sneha: ['#047857', '#34d399'], karan: ['#0369a1', '#38bdf8'], ithelp: ['#334155', '#64748b'], anjali: ['#c2410c', '#fb923c'], sales: ['#15803d', '#4ade80'], mkt: ['#9333ea', '#e879f9'], hr: ['#0e7490', '#22d3ee'] }
const me = { ...P.me, display_name: 'Rahul Verma', full_name: 'Rahul Verma', email: 'rahul.verma@example.com', phone: '+91 98765 43210', bio: 'Regional sales · North zone', avatar_url: '/api/jm/media/avatar-me.png',
  can_create_groups: true, pending_email: null, pending_email_requested_at: null, employee_code: 'EMP-2048', date_joined: '2023-04-03', last_seen_privacy: 'everyone',
  companies: [{ id: 'm1', company: 'JV', company_name: 'JIVO', company_color: '#15803D', title: 'Regional Sales Manager', department: 'Sales', is_default: true, is_active: true }],
  capabilities: ['JM_ACCESS', 'JM_SEND_MESSAGE', 'JM_SEND_FILE', 'JM_CREATE_GROUP', 'JP_ACCESS', 'JP_MANAGE_VAULT', 'JP_REQUEST_EMERGENCY', 'ADMIN_USERS'], groups: [],
  session: { id: 'current-device', expires_at: '2027-01-01', auth_method: 'password' },
  security: { mfa_enrolled: true, mfa_required: false, two_step_enforced: false, session_verified: true, passkeys: [{ id: 'k1', name: 'This phone' }], recovery_codes_left: 8, locked_capabilities: [], locked_out: false } }

const can = own => ({ edit: own, delete_for_everyone: own, react: true, reply: true, forward: true, vote: true, respond: true })
function msg(conv, seq, sender, body, minAgo, extra = {}) {
  const own = sender.id === 'me'
  return { id: `${conv}-${seq}`, seq, body, conversation: conv, sender, client_id: null, kind: 'text', mentions: [], reply_to: null, attachments: [], reactions: [], forwarded: false, edited_at: null,
    deleted: false, deleted_by_moderator: false, system: null, created_at: ago(minAgo), updated_at: ago(minAgo), status: own ? 'read' : null, can: can(own), ...extra }
}
const reply = (m) => ({ id: m.id, seq: m.seq, sender_name: m.sender.name, preview: m.body || (m.attachments[0] ? m.attachments[0].name : ''), deleted: false, unavailable: false })
const att = (id, kind, name, mime, size, w = null, h = null) => ({ id, status: 'ready', reject_reason: '', scan_status: 'clean', name, size, mime, kind, width: w, height: h, blurhash: '',
  thumb_url: kind === 'image' ? `/api/jm/media/${id}.png` : null, preview_url: kind === 'image' ? `/api/jm/media/${id}.png` : `/api/jm/media/${id}.bin`, download_url: `/api/jm/media/${id}.bin`, created_at: ago(60) })

const chats = {}
{ // 02 direct chat with Priya
  const c = 'priya', m = []
  m.push(msg(c, 1, P.priya, 'Good morning Rahul! Still on for the distributor review at 3?', 96))
  m.push(msg(c, 2, P.me, 'Yes, small conference room. See you there.', 94))
  m.push(msg(c, 3, P.priya, '', 90, { kind: 'attachment', attachments: [att('deck', 'file', 'North-zone-review-Oct.pdf', 'application/pdf', 2483021)] }))
  m.push(msg(c, 4, P.me, 'Thanks! Can you add the dealer-wise split too?', 52))
  m[3].reply_to = reply(m[2])
  m.push(msg(c, 5, P.priya, 'New shelf display at the Karol Bagh outlet', 47, { kind: 'attachment', attachments: [att('photo1', 'image', 'Store display.png', 'image/png', 412340, 1200, 800)] }))
  m.push(msg(c, 6, P.me, 'Looks much better than last month 👏', 12, { reactions: [{ emoji: '❤️', count: 1, me: false }] }))
  m[5].reply_to = reply(m[4])
  m.push(msg(c, 7, P.priya, 'Sure, adding it now. See you at 3 👍', 3))
  chats[c] = m
}
{ // 03 group chat
  const c = 'sales', m = []
  m.push(msg(c, 1, P.ankit, 'Team, the Q3 targets are final. Great work everyone!', 180))
  m.push(msg(c, 2, P.meera, 'Uploaded the updated price list for the new SKUs.', 150, { kind: 'attachment', attachments: [att('pricelist', 'file', 'Price-list-Nov.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 184320)] }))
  m.push(msg(c, 3, P.vikram, 'Received, thanks Meera. Sharing with the West zone dealers today.', 140, { reactions: [{ emoji: '👍', count: 3, me: true }] }))
  m.push(msg(c, 4, P.me, 'Reminder: weekly sync moves to Thursday 10 am this week.', 70))
  m.push(msg(c, 5, P.sneha, 'Noted. Can we also cover the festive season stock plan?', 60))
  m[4].reply_to = reply(m[3])
  m.push(msg(c, 6, P.ankit, 'Yes, adding it to the agenda.', 55))
  m.push(msg(c, 7, P.karan, 'Display photos from the Lucknow outlets', 30, { kind: 'attachment', attachments: [att('photo2', 'image', 'Lucknow outlets.png', 'image/png', 380110, 1200, 800)] }))
  m.push(msg(c, 8, P.meera, 'These look excellent 🎉', 22, { reactions: [{ emoji: '🔥', count: 4, me: false }] }))
  m.push(msg(c, 9, P.ankit, 'Updated the Q3 deck with everyone\'s inputs. Please review by Friday.', 8))
  chats[c] = m
}
const conv = (id, kind, title, peer, members, last, unread, extra = {}) => ({
  id, kind, title, avatar_url: `/api/jm/media/avatar-${extra.avatar || id}.png`, restricted_company: null, peer, member_count: members, send_mode: 'everyone', send_block: null, notify_preview: null,
  last_message: last && { id: id + '-last', seq: last.seq || 10, kind: last.kind || 'text', sender: last.sender, preview: last.text, media: last.media || null, text: last.text, deleted: false, created_at: ago(last.min) },
  last_seq: last ? last.seq || 10 : 0, last_read_seq: (last ? last.seq || 10 : 0) - unread, unread_count: unread, mention_unread: !!extra.mention, muted_until: extra.muted ? '2099-01-01T00:00:00Z' : null,
  pinned_at: extra.pinned ? ago(5000) : null, archived_at: null, left: false, updated_at: last ? ago(last.min) : ago(9000), disappearing_seconds: 0, locked: false,
  can: { send: true, send_file: true, edit_info: kind === 'group', manage_members: kind === 'group', leave: kind === 'group', set_disappearing: true, call: false } })
const lastOf = (id, min) => { const m = chats[id].at(-1); return { seq: m.seq, sender: m.sender, text: m.body || m.attachments[0]?.name, min } }
const conversations = [
  conv('priya', 'direct', 'Priya Sharma', P.priya, 2, lastOf('priya', 3), 1, { pinned: true }),
  conv('sales', 'group', 'Sales Team', null, 14, lastOf('sales', 8), 5, { mention: false }),
  conv('ithelp', 'direct', 'IT Help', P.it, 2, { sender: P.it, text: 'Your laptop replacement request is approved. Pick-up from the 2nd floor desk.', min: 34, seq: 6 }, 2),
  conv('vikram', 'direct', 'Vikram Singh', P.vikram, 2, { sender: P.me, text: 'Invoice shared, please check.', min: 75, seq: 14, kind: 'attachment', media: 'file' }, 0),
  conv('mkt', 'group', 'Marketing Updates', null, 23, { sender: P.anjali, text: 'Festive campaign creatives', min: 130, seq: 40, kind: 'attachment', media: 'photo' }, 3),
  conv('anjali', 'direct', 'Anjali Rao', P.anjali, 2, { sender: P.me, text: 'Thank you, see you on Monday!', min: 220, seq: 22 }, 0),
  conv('hr', 'group', 'HR Announcements', null, 186, { sender: P.sneha, text: 'Office will remain closed on Friday for the festival.', min: 1500, seq: 61 }, 0, { muted: true }),
  conv('karan', 'direct', 'Karan Malhotra', P.karan, 2, { sender: P.karan, text: 'Will call you after the dealer meet.', min: 2900, seq: 9 }, 0),
  conv('meera', 'direct', 'Meera Nair', P.meera, 2, { sender: P.me, text: 'Got it, thanks!', min: 4400, seq: 18 }, 0),
]
const members = {
  priya: [{ user: P.me, role: 'member', can_send: true, joined_at: '2024-01-01', is_me: true }, { user: P.priya, role: 'member', can_send: true, joined_at: '2024-01-01', is_me: false }],
  sales: [P.me, P.ankit, P.meera, P.vikram, P.sneha, P.karan, P.priya].map((u, i) => ({ user: u, role: i === 1 ? 'owner' : i === 0 ? 'admin' : 'member', can_send: true, joined_at: '2024-01-01', is_me: u.id === 'me' })),
}

const vaults = [
  { id: 'v-personal', name: 'Personal', description: 'My work logins', owner_type: 'personal', company: null, my_role: 'owner', break_glass_until: null, entry_count: 6, archived_at: null, legal_hold: false, frozen: false, created_at: '2025-01-01', mine: true },
  { id: 'v-sales', name: 'Sales Team', description: 'Shared portals for the sales team', owner_type: 'shared', company: { id: 'c1', code: 'JV', name: 'JIVO' }, my_role: 'editor', break_glass_until: null, entry_count: 4, archived_at: null, legal_hold: false, frozen: false, created_at: '2025-01-01', mine: false },
].map(v => ({ ...v, can: { create_entry: true, edit_folders: true, rename: v.mine, manage_members: v.mine, remove_members: v.mine, trash: true, archive: v.mine, view_activity: true, appoint_owner: v.mine } }))
const ecan = { reveal: true, edit: true, share: true, revoke: true, delete: true, move: true, history: true }
const entry = (id, title, username, url, folder, tags, days, vault = vaults[0]) => ({ id, vault: { id: vault.id, name: vault.name, mine: vault.mine }, kind: 'login', title, username, url, tags, folder, expires_on: null,
  updated_at: ago(days * 1440), password_changed_at: ago(days * 1440), version: 3, trashed_at: null, via: 'role', can: ecan })
const entries = [
  entry('e-crm', 'CRM Portal', 'rahul.verma', 'https://crm.example.com', null, ['sales'], 3),
  entry('e-mail', 'Work Email', 'rahul.verma@example.com', 'https://mail.example.com', null, [], 12),
  entry('e-dealer', 'Dealer Network', 'rverma', 'https://dealers.example.com', null, ['partners'], 20),
  entry('e-travel', 'Travel Desk', 'rahul.v', 'https://travel.example.com', null, [], 34),
  entry('e-expense', 'Expense Claims', 'EMP-2048', 'https://expenses.example.com', null, ['finance'], 41),
  entry('e-wifi', 'Office Wi-Fi (Guest)', 'guest', '', null, [], 60),
]
const folders = []
const entryDetail = e => ({ ...e, versions: [3, 2, 1].map(v => ({ version: v, created_by: { id: 'me', name: me.name, email: me.email, is_active: true }, created_at: ago((v === 3 ? 3 : v === 2 ? 95 : 210) * 1440), shredded: false, current: v === 3 })),
  secret_fields: ['password', 'notes'], shares: [{ id: 's1', grantee: { id: 'priya', name: 'Priya Sharma', email: 'priya@example.com', is_active: true }, granted_by: { id: 'me', name: me.name, email: me.email, is_active: true }, granted_at: ago(4000), expires_at: null }] })

const tools = [
  ['CRM', 'Customers, leads and dealer accounts', 'https://crm.example.com'],
  ['Expense Claims', 'Submit and track travel and expense claims', 'https://expenses.example.com'],
  ['HR Portal', 'Leave, payslips and policies', 'https://hr.example.com'],
  ['Sales Dashboard', 'Daily sales by zone and channel', 'https://dashboard.example.com'],
  ['IT Service Desk', 'Raise a ticket or request equipment', 'https://helpdesk.example.com'],
].map(([name, description, web_url], i) => ({ id: 't' + i, name, description, web_url, app_url: '', position: i, is_active: true }))
const approval = (id, title, subject, reason, by, min, kind = 'admin') => ({ kind, id, title, subject, reason, status: 'pending', requested_by: { id: by.id, name: by.name }, requested_at: ago(min), expires_at: new Date(NOW.getTime() + 2 * 86400000).toISOString(),
  decided_by: null, decided_at: null, can: { decide: true, cancel: false }, actions: { approve: `/api/jm/admin/approvals/${id}/approve/`, deny: `/api/jm/admin/approvals/${id}/deny/`, cancel: `/api/jm/admin/approvals/${id}/cancel/` }, link: '/admin?tab=approvals' })
const approvals = [
  approval('a1', 'Reset two-step verification', 'Karan Malhotra', 'Changed to a new phone', P.karan, 25),
  approval('a2', 'Vault owner request', 'Sales Team vault', 'Adding a second owner for leave cover', P.ankit, 140, 'vault_owner'),
  approval('a3', 'Emergency access', 'Finance Portals', 'Month-end closing while the owner is travelling', P.meera, 300, 'emergency_access'),
]

// ---------- images (rendered once in the browser from SVG; nothing external) ----------
async function renderImages(browser) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } })
  const page = await ctx.newPage()
  const out = {}
  const shot = async (html, w, h) => { await page.setViewportSize({ width: w, height: h }); await page.setContent(`<html><body style="margin:0">${html}</body></html>`); return page.screenshot({ type: 'png' }) }
  for (const [id, [a, b]] of Object.entries(avatarColors)) {
    const name = { sales: 'Sales Team', mkt: 'Marketing Updates', hr: 'HR Announcements', ithelp: 'IT Help' }[id] || Object.values(P).find(p => p.id === id)?.name || id
    const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('')
    out[`avatar-${id}`] = await shot(`<div style="width:256px;height:256px;background:linear-gradient(135deg,${a},${b});display:flex;align-items:center;justify-content:center;font:600 100px Segoe UI,Arial,sans-serif;color:#fff">${initials}</div>`, 256, 256)
  }
  // A shelf of neutral product boxes (store display).
  const shelf = (w, h, seed) => {
    let s = ''; const palette = ['#16a34a', '#f59e0b', '#0ea5e9', '#ef4444', '#a855f7', '#14b8a6', '#eab308']
    for (let row = 0; row < 3; row++) { const y = 140 + row * 230
      s += `<rect x="60" y="${y + 190}" width="${w - 120}" height="22" fill="#8b5e34"/>`
      for (let i = 0; i < 9; i++) { const x = 90 + i * ((w - 180) / 9), c = palette[(i + row * 2 + seed) % palette.length], bh = 120 + ((i * 37 + row * 13 + seed * 7) % 60)
        s += `<rect x="${x}" y="${y + 190 - bh}" width="${(w - 180) / 9 - 14}" height="${bh}" rx="10" fill="${c}"/><rect x="${x + 10}" y="${y + 190 - bh + 24}" width="${(w - 180) / 9 - 34}" height="34" rx="6" fill="#ffffff" opacity="0.85"/>` } }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdf6ec"/><stop offset="1" stop-color="#e9dcc9"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><rect x="40" y="70" width="${w - 80}" height="${h - 110}" rx="18" fill="#f3e6d3" stroke="#c9a77c" stroke-width="6"/>${s}<rect x="${w / 2 - 170}" y="20" width="340" height="80" rx="16" fill="#15803d"/><text x="${w / 2}" y="74" font-family="Segoe UI,Arial" font-size="40" font-weight="700" fill="#fff" text-anchor="middle">FRESH PICKS</text></svg>`
  }
  out.photo1 = await shot(shelf(1200, 800, 0), 1200, 800)
  out.photo2 = await shot(shelf(1200, 800, 3).replace('FRESH PICKS', 'NEW ARRIVALS'), 1200, 800)
  await ctx.close()
  return out
}

// ---------- mocked API ----------
async function installMocks(context, base, images, { signedIn }) {
  const unexpected = []
  await context.route('**/*', route => {
    const u = new URL(route.request().url())
    if (u.origin !== base) return route.abort()
    return route.continue()
  })
  await context.routeWebSocket(/\/ws\/?/, ws => { ws.send(JSON.stringify({ type: 'HELLO', data: {} })); ws.onMessage(d => { try { if (JSON.parse(d).type === 'PING') ws.send(JSON.stringify({ type: 'PONG', data: {} })) } catch {} }) })
  await context.route(base + '/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, method = req.method()
    const send = (data, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data), headers })
    let m
    if ((m = p.match(/^\/api\/jm\/media\/([\w-]+)\.png$/)) && images[m[1]]) return route.fulfill({ status: 200, contentType: 'image/png', body: images[m[1]] })
    if (p.startsWith('/api/jm/media/')) return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'SYNTHETIC' })
    if (p === '/api/jm/auth/csrf/') return send({}, 200, { 'set-cookie': 'jm_csrftoken=mock-csrf; Path=/; SameSite=Lax' })
    if (p === '/api/jm/appearance/') return send({ type: 'default', color: null, image_url: null, updated_at: '2026-10-20' })
    if (p === '/api/jm/auth/options/') return send({ passkey_sign_in: true })
    if (p === '/api/jm/me/') return signedIn ? send(me) : send({ detail: 'Sign in' }, 401)
    if (p === '/api/jm/auth/mfa/') return send(me.security)
    if (p === '/api/jm/me/security-notices/') return send({ results: [], next_cursor: null, unavailable_count: 0 })
    if (p === '/api/jm/atlas/status/') return send({ enabled: false, allowed: false, message: null })
    if (p === '/api/jm/notifications/summary/') return send({ unread_conversations: conversations.filter(c => c.unread_count).length, unread_messages: conversations.reduce((s, c) => s + c.unread_count, 0), unread_notifications: 0, mention_unread: false })
    if (p === '/api/jm/notifications/') return send({ results: [], next_cursor: null })
    if (p === '/api/jm/me/notification-preferences/') return send({ push_enabled: true, push_preview: 'sender_and_text', dnd_start: null, dnd_end: null, mentions_override_mute: true, jp_push: true, sound_enabled: true, vibrate_enabled: true })
    if (p === '/api/jm/alerts/active/' || p === '/api/jm/alerts/') return send({ results: [], next_cursor: null })
    if (p === '/api/jm/approvals/') return send({ results: approvals, waiting_on_me: approvals.length })
    if (p === '/api/jm/tools/') return send(tools)
    if (p === '/api/jm/auth/sessions/') return send([{ id: 'current-device', device_label: 'Pixel 8 · JM app', auth_method: 'passkey', created_at: '2026-09-01', last_seen_at: ago(1), ip_last: null, current: true }, { id: 'd2', device_label: 'Windows · Edge', auth_method: 'password', created_at: '2026-08-12', last_seen_at: ago(300), ip_last: null, current: false }])
    if (p === '/api/jm/users/presence/') return send({ results: Object.fromEntries(Object.values(P).map(x => [x.id, { online: ['priya', 'ankit', 'meera'].includes(x.id), last_seen_at: ago(25) }])) })
    if (p === '/api/jm/conversations/') { const f = url.searchParams.get('filter'); return send({ results: f === 'archived' || f === 'locked' ? [] : conversations, next_cursor: null }) }
    if ((m = p.match(/^\/api\/jm\/conversations\/([\w-]+)\/$/))) { const c = conversations.find(x => x.id === m[1]); return c ? send({ ...c, last_read_seq: c.last_seq, unread_count: 0, mention_unread: false, description: c.kind === 'group' ? 'Sales updates, targets and dealer news' : '', created_at: '2024-01-01', my_role: 'admin', visible_from_seq: 1, is_owner: false }) : send({ detail: 'Not found' }, 404) }
    if ((m = p.match(/^\/api\/jm\/conversations\/([\w-]+)\/members\/$/))) return send({ results: members[m[1]] || members.priya })
    if ((m = p.match(/^\/api\/jm\/conversations\/([\w-]+)\/messages\/$/)) && method === 'GET') { const list = chats[m[1]] || []; const last = list.length
      return send({ results: list, mode: 'latest', oldest_seq: list.length ? 1 : null, newest_seq: last || null, has_more_before: false, has_more_after: false, first_unread_seq: null, last_read_seq: last, last_seq: last, visible_from_seq: 1, receipts: { read_seq: last, delivered_seq: last }, server_time: NOW.toISOString() }) }
    if (/\/conversations\/[\w-]+\/(read|delivered)\/$/.test(p)) return send({})
    if ((m = p.match(/^\/api\/jm\/conversations\/([\w-]+)\/shared\/$/))) return send({ results: [], next_before: null })
    if ((m = p.match(/^\/api\/jm\/users\/([\w-]+)\/$/))) { const u = Object.values(P).find(x => x.id === m[1]) || P.priya; return send({ ...u, full_name: u.name, bio: '', phone: null, companies: [] }) }
    if (p === '/api/jm/users/') return send({ results: Object.values(P).filter(x => x.id !== 'me'), next_cursor: null })
    // Passwords
    if (p === '/api/jp/unlock/') return send({ unlocked: true, expires_at: null })
    if (p === '/api/jp/vaults/') return send(vaults)
    if ((m = p.match(/^\/api\/jp\/vaults\/([\w-]+)\/$/))) return send(vaults.find(v => v.id === m[1]) || vaults[0])
    if (/^\/api\/jp\/vaults\/[\w-]+\/folders\/$/.test(p)) return send(folders)
    if (/^\/api\/jp\/vaults\/[\w-]+\/files\/$/.test(p)) return send({ results: [], can: { list: true, download: true, upload: true, rename: true, delete: true }, max_bytes: 10485760 })
    if (/^\/api\/jp\/vaults\/[\w-]+\/members\/$/.test(p)) return send([])
    if (p === '/api/jp/entries/') { if (url.searchParams.get('trashed') === '1') return send({ results: [], next_cursor: null }); const v = url.searchParams.get('vault'); return send({ results: v && v !== 'v-personal' ? [] : entries, next_cursor: null }) }
    if ((m = p.match(/^\/api\/jp\/entries\/([\w-]+)\/$/))) { const e = entries.find(x => x.id === m[1]) || entries[0]; return send(entryDetail(e)) }
    if (p === '/api/jp/people/') return send([])
    if (p === '/api/jp/owner-requests/pending/' || p === '/api/jp/break-glass/') return send([])
    if (p === '/api/jp/audit/') return send({ results: [], next_cursor: null })
    unexpected.push(method + ' ' + p)
    return send({ detail: 'Unmocked endpoint' }, 501)
  })
  return unexpected
}

// ---------- page helpers ----------
const CLEAN_CSS = `
  ::-webkit-scrollbar { width: 0 !important; height: 0 !important; display: none !important; }
  * { scrollbar-width: none !important; caret-color: transparent !important; }
  *, *::before, *::after { transition: none !important; animation-duration: 0s !important; }
`
async function settle(page) {
  await page.addStyleTag({ content: CLEAN_CSS }).catch(() => {})
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {})
  // Wait for images to finish loading.
  await page.waitForFunction(() => [...document.images].every(i => i.complete), null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(700)
  await page.mouse.move(-10, -10).catch(() => {})
}
// The profile "Install app" row is a browser-only hint; it is not part of the store apps.
const hideInstallRow = page => page.evaluate(() => {
  for (const el of document.querySelectorAll('div')) {
    if (el.textContent?.startsWith('Install app') && /installation|installed app/i.test(el.textContent) && el.textContent.length < 300) {
      let row = el; while (row.parentElement && row.parentElement.textContent === el.textContent) row = row.parentElement
      row.style.display = 'none'; return true
    }
  }
  return false
})

const screens = [
  ['01', 'chat-list', async (page, base) => { await page.goto(base + '/messenger'); await page.getByText('Priya Sharma').first().waitFor(); await page.getByText('Sales Team').first().waitFor() }],
  ['02', 'direct-chat', async (page, base) => { await page.goto(base + '/messenger?conversation=priya'); await page.getByText('Sure, adding it now. See you at 3 👍').waitFor() }],
  ['03', 'group-chat', async (page, base) => { await page.goto(base + '/messenger?conversation=sales'); await page.getByText("Updated the Q3 deck with everyone's inputs. Please review by Friday.").waitFor() }],
  ['04', 'passwords', async (page, base) => { await page.goto(base + '/passwords'); await openVault(page) }],
  ['05', 'password-entry', async (page, base) => { await page.goto(base + '/passwords'); await openVault(page); await page.getByRole('button', { name: 'Open CRM Portal', exact: true }).click(); await page.getByRole('button', { name: 'Reveal password', exact: true }).first().waitFor() }],
  ['06', 'profile', async (page, base) => { await page.goto(base + '/profile'); await page.getByText('Your details', { exact: true }).first().click(); await page.getByText('rahul.verma@example.com').first().waitFor(); await hideInstallRow(page) }],
  ['07', 'tools', async (page, base) => { await page.goto(base + '/tools'); await page.getByText('Expense Claims').first().waitFor() }],
  ['08', 'sign-in', async (page, base) => { await page.goto(base + '/login'); await page.getByLabel('Email', { exact: true }).fill('rahul.verma@example.com'); await page.getByLabel('Password', { exact: true }).fill('synthetic-pass'); await page.getByLabel('Password', { exact: true }).blur() }, { signedIn: false }],
]
async function openVault(page) {
  // Passwords may open on the vault list or straight in a vault; open "Personal" when the list shows.
  const open = page.getByRole('button', { name: 'Open vault Personal', exact: true })
  const entry = page.getByRole('button', { name: 'Open CRM Portal', exact: true })
  await Promise.race([open.waitFor({ timeout: 20000 }), entry.waitFor({ timeout: 20000 })])
  if (!(await entry.isVisible().catch(() => false))) await open.click()
  await entry.waitFor()
}

async function main() {
  ensureBuild()
  const server = await serve()
  const base = 'http://127.0.0.1:' + server.address().port
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const problems = []
  try {
    const images = await renderImages(browser)
    for (const theme of themes) for (const dev of wantedDevices) {
      const outDir = path.join(outRoot, theme === 'dark' ? dev : `${dev}-${theme}`)
      fs.mkdirSync(outDir, { recursive: true })
      for (const [num, name, run, opts = {}] of screens) {
        if (only && !only.includes(num)) continue
        const context = await browser.newContext({ ...devices[dev], isMobile: true, hasTouch: true, colorScheme: theme, locale: 'en-IN', timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' })
        await context.addInitScript(t => { try { localStorage.setItem('jm.theme', t) } catch {} }, theme)
        await context.clock.setSystemTime(NOW)
        const unexpected = await installMocks(context, base, images, { signedIn: opts.signedIn !== false })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', e => errors.push(e.message))
        try {
          await run(page, base)
          await settle(page)
          const file = path.join(outDir, `${num}-${name}.png`)
          await page.screenshot({ path: file, type: 'png' })
          console.log('Saved', path.relative(root, file), unexpected.length ? 'unmocked: ' + [...new Set(unexpected)].join(', ') : '', errors.length ? 'errors: ' + errors.join(' | ') : '')
        } catch (e) {
          problems.push(`${dev}/${theme}/${num}-${name}: ${e.message.split('\n')[0]}`)
          await page.screenshot({ path: path.join(os.tmpdir(), `jm-store-fail-${dev}-${theme}-${num}.png`) }).catch(() => {})
          console.error('FAILED', dev, theme, num, name, e.message.split('\n')[0], 'unmocked:', [...new Set(unexpected)].join(', '))
        } finally { await context.close() }
      }
    }
  } finally { await browser.close(); server.close() }
  if (problems.length) { console.error('Problems:\n' + problems.join('\n')); process.exitCode = 1 }
}
main().catch(e => { console.error(e); process.exitCode = 1 })
