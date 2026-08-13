const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

/**
 * Package exports must be ON, or `@businessdash/sdk/native` doesn't resolve at
 * all — and the error reads like a missing dependency rather than a resolver
 * setting, which is a genuinely bad hour.
 *
 * Recent Expo SDKs turn this on by default. It is set explicitly anyway
 * because "the default changed" is not something a starter should depend on,
 * and setting it when it's already true costs nothing.
 */
config.resolver.unstable_enablePackageExports = true

module.exports = config
