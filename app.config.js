const fs = require('node:fs')
const path = require('node:path')

module.exports = ({ config }) => {
  const file = process.env.GOOGLE_SERVICES_JSON || './google-services.json'
  const absolute = path.resolve(__dirname, file)
  const configured = fs.existsSync(absolute)
  if (configured) {
    const services = JSON.parse(fs.readFileSync(absolute, 'utf8'))
    const client = services.client?.find(entry => entry.client_info?.android_client_info?.package_name === config.android?.package)
    if (!client || !services.project_info?.project_number || !client.client_info?.mobilesdk_app_id || !client.api_key?.[0]?.current_key) {
      throw new Error('google-services.json must contain the Firebase Android client for com.jivo.jm, including its app ID, sender ID and API key.')
    }
  } else if (process.env.EAS_BUILD_PLATFORM === 'android') {
    throw new Error('Android push setup is missing. Supply google-services.json for com.jivo.jm or set GOOGLE_SERVICES_JSON to its file path.')
  }
  return {
    ...config,
    android: { ...config.android, ...(configured ? { googleServicesFile: absolute } : {}) },
    extra: { ...config.extra, androidPushConfigured: configured },
  }
}
