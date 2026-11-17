const assert = require('node:assert/strict')
const { expect } = require('@playwright/test')

// Called by the authenticated mocked UI harness. No real backend data is accessed.
// U-036: shared file -> "Send to…" (two chats) -> attachment preview with the shared text as caption -> outbox.
module.exports = async function shareUi(page, { base, me, conversation }) {
  let active = true
  const uploads = [], sends = []
  const chats = [
    { ...conversation, id: 'share-one', title: 'Share destination one', kind: 'group', locked: false, left: false, archived_at: null, can: { ...conversation.can, send: true, send_file: true } },
    { ...conversation, id: 'share-two', title: 'Share destination two', kind: 'group', locked: false, left: false, archived_at: null, can: { ...conversation.can, send: true, send_file: true } },
    { ...conversation, id: 'share-text-only', title: 'Text only destination', kind: 'group', locked: false, left: false, archived_at: null, can: { ...conversation.can, send: true, send_file: false } },
    { ...conversation, id: 'share-locked', title: 'Locked share destination', kind: 'group', locked: true, left: false, archived_at: null },
  ]
  const routeHandler = async route => {
    if (!active) return route.fallback()
    const req = route.request(), url = new URL(req.url()), path = url.pathname
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/jm/conversations/' && req.method() === 'GET') return json({ results: chats, next_cursor: null })
    if (path === '/api/jm/users/' && req.method() === 'GET') return json({ results: [], next_cursor: null })
    const detail = chats.find(chat => path === `/api/jm/conversations/${chat.id}/`)
    if (detail) return json(detail)
    if (path === '/api/jm/uploads/' && req.method() === 'POST') {
      assert.ok(req.headers()['x-csrftoken'])
      uploads.push(req.headers()['idempotency-key'])
      return json({ id: 'shared-upload-' + uploads.length, status: 'ready', name: 'incoming-note.txt', size: 5, mime: 'text/plain', kind: 'file', download_url: '/api/jm/files/shared', thumb_url: null })
    }
    if (/^\/api\/jm\/conversations\/share-(one|two)\/messages\/$/.test(path) && req.method() === 'POST') {
      const body = req.postDataJSON(); sends.push({ path, body })
      assert.ok(req.headers()['x-csrftoken'])
      return json({ id: 'shared-message-' + sends.length, conversation: path.split('/')[4], seq: 1000 + sends.length, kind: 'text', body: body.body, client_id: body.client_id, sender: me, attachments: [], created_at: new Date().toISOString() })
    }
    return route.fallback()
  }
  await page.route('**/api/jm/**', routeHandler)
  async function seed(owner, at = Date.now(), text = 'Incoming fixture text') {
    await page.evaluate(async value => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('jm-incoming-share-v1', 1); request.onupgradeneeded = () => request.result.createObjectStore('pending'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      await new Promise((resolve, reject) => { const tx = db.transaction('pending', 'readwrite'); tx.objectStore('pending').put({ id: crypto.randomUUID(), owner: value.owner, at: value.at, text: value.text, dropped: 0, files: [new File(['hello'], 'incoming-note.txt', { type: 'text/plain' })] }, 'incoming'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error) })
      db.close()
    }, { owner, at, text })
  }
  try {
    await seed(me.id)
    await page.goto(base + '/share')
    await page.getByLabel('Search chats and people', { exact: true }).waitFor()
    await expect(page.getByText('1 file with text', { exact: true })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Locked share destination', exact: true })).toHaveCount(0)
    await expect(page.getByRole('checkbox', { name: 'Text only destination', exact: true })).toBeDisabled()
    assert.equal(sends.length + uploads.length, 0, 'Incoming content must not send automatically')
    await page.getByRole('checkbox', { name: 'Share destination one', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Share destination two', exact: true }).click()
    await page.getByRole('button', { name: 'Next: review the file', exact: true }).click()
    await expect(page.getByLabel('Attachment caption', { exact: true })).toHaveValue('Incoming fixture text')
    assert.equal(sends.length + uploads.length, 0, 'The preview does not send')
    await page.getByRole('button', { name: 'Send 1 file', exact: true }).click()
    await expect(page).toHaveURL(/\/messenger/)
    await expect.poll(() => sends.length, { timeout: 20000 }).toBe(2)
    assert.equal(uploads.length, 2)
    assert.equal(new Set(uploads).size, 2, 'Each chat gets its own uploaded copy')
    assert.notEqual(sends[0].body.client_id, sends[1].body.client_id)
    assert.deepEqual(sends.map(send => send.body.body), ['Incoming fixture text', 'Incoming fixture text'])
    await seed('another-account', Date.now(), 'MUST_NOT_SHOW_OTHER_OWNER')
    await page.goto(base + '/share')
    await page.getByText(/Nothing to share/).waitFor()
    await expect(page.getByText('MUST_NOT_SHOW_OTHER_OWNER')).toHaveCount(0)
    await seed(me.id, Date.now() - 60 * 60 * 1000 - 1)
    await page.reload()
    await page.getByText(/Nothing to share/).waitFor()
    assert.equal(sends.length, 2)
    console.log('PASS incoming share: Send to… (locked hidden, no-files chat disabled), two chats, preview with caption, outbox copies per chat, account isolation and expiry')
  } finally {
    active = false
    await page.unroute('**/api/jm/**', routeHandler)
    await page.goto(base + '/messenger')
  }
}
