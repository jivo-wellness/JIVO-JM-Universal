const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const configure = require('../app.config.js')

test('Android Firebase configuration validates the package and preserves existing Expo settings', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jm-push-config-'))
  const file = path.join(directory, 'google-services.json')
  const oldFile = process.env.GOOGLE_SERVICES_JSON, oldPlatform = process.env.EAS_BUILD_PLATFORM
  const config = { android: { package: 'com.jivo.jm' }, extra: { eas: { projectId: 'existing' } } }
  try {
    process.env.GOOGLE_SERVICES_JSON = file
    delete process.env.EAS_BUILD_PLATFORM
    assert.equal(configure({ config }).extra.androidPushConfigured, false)
    process.env.EAS_BUILD_PLATFORM = 'android'
    assert.throws(() => configure({ config }), /push setup is missing/)
    const data = { project_info: { project_number: '123' }, client: [{ client_info: { android_client_info: { package_name: 'com.jivo.oms' }, mobilesdk_app_id: 'synthetic-app' }, api_key: [{ current_key: 'synthetic-key' }] }] }
    fs.writeFileSync(file, JSON.stringify(data))
    assert.throws(() => configure({ config }), /com.jivo.jm/)
    data.client[0].client_info.android_client_info.package_name = 'com.jivo.jm'
    fs.writeFileSync(file, JSON.stringify(data))
    const result = configure({ config })
    assert.equal(result.android.googleServicesFile, file)
    assert.equal(result.extra.androidPushConfigured, true)
    assert.deepEqual(result.extra.eas, { projectId: 'existing' })
  } finally {
    if (oldFile === undefined) delete process.env.GOOGLE_SERVICES_JSON; else process.env.GOOGLE_SERVICES_JSON = oldFile
    if (oldPlatform === undefined) delete process.env.EAS_BUILD_PLATFORM; else process.env.EAS_BUILD_PLATFORM = oldPlatform
    if (fs.existsSync(file)) fs.unlinkSync(file)
    fs.rmdirSync(directory)
  }
})
