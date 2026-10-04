import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServerClient } from 'localisync_sdk/server'
import type { LocalisyncClient } from 'localisync_sdk/core'
import bundled from './generated/bundle'

// Application-owned process state keeps Next's instrumentation and route bundles on one runtime.
// Request locale is never stored here; each request captures an immutable view.
declare global {
  var localisyncExampleRuntime: { client: LocalisyncClient | null; initialization: Promise<void> | null } | undefined
}
const state = (globalThis.localisyncExampleRuntime ??= { client: null, initialization: null })
export function startRuntime() {
  return (state.initialization ??= (async () => {
    const configuration = JSON.parse(await readFile(resolve('public/localisync.json'), 'utf8'))
    state.client = createServerClient({
      ...configuration,
      bundle: bundled,
      preparedLocales: ['en', 'tr'],
      cacheDirectory: resolve('.local/cache')
    })
    // Deliberately do not hold server readiness or HTML requests on the distribution network.
    void state.client.start()
  })())
}
export function getRuntime() {
  return state.client
}
