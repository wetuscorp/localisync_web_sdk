export default {
  ...(process.env.LOCALISYNC_STATIC === 'true' ? { output: 'export' } : {}),
  serverExternalPackages: ['localisync_sdk'],
  poweredByHeader: false,
  webpack(configuration, { isServer }) {
    // Workspace symlinks resolve outside node_modules, bypassing Next's package opt-out matcher.
    // Keep the Node adapter native so worker_threads loads its packaged ESM worker unchanged.
    if (isServer)
      configuration.externals.push(({ request }, callback) => {
        if (request === 'localisync_sdk/server' || request === 'localisync_sdk/core') {
          callback(null, 'commonjs ' + request)
        } else callback()
      })
    return configuration
  }
}
