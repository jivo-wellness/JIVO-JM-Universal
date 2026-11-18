const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
// Leave memory for Android Studio and the emulator on the local 8 GB PC.
// CLI --max-workers can override this on a larger build machine.
config.maxWorkers = 1
const existing = config.resolver.blockList
const root = __dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// CMake caches contain deep generated trees. They are never JavaScript inputs.
// Excluding them also prevents a native build from overwhelming Metro's watcher.
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${root}[\\\\/](?:\\.native-build|android|ios|test-results)(?:[\\\\/]|$)`),
  /[\\/]node_modules[\\/].*[\\/]android[\\/](?:\.cxx|build)(?:[\\/]|$)/,
]

// Resolve the vendored module directly: npm's Windows junction is not always
// indexed by Metro. Keep the package dependency for Expo native autolinking.
const resolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = moduleName === 'expo-paste-input'
    ? path.join(__dirname, 'native', 'expo-paste-input', 'src', 'index.ts')
    : moduleName
  return resolveRequest
    ? resolveRequest(context, target, platform)
    : context.resolveRequest(context, target, platform)
}

module.exports = config
