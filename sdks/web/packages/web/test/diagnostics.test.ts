import { afterEach, expect, it, vi } from 'vitest'
import { DiagnosticsReporter } from '../src/diagnostics.js'
import { LocalisyncClient, LocalisyncError } from 'localisync_sdk/core'
import type { UpdateDriver } from 'localisync_sdk/core'
import { compileBundle } from '../src/compiler.js'
const reporters: DiagnosticsReporter[] = []
afterEach(() => {
  for (const r of reporters.splice(0)) r.dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function reporter() {
  const r = new DiagnosticsReporter(
    { endpoint: 'https://diagnostics.invalid/telemetry/v1/sdk-events', key: 'lsd_' + 'a'.repeat(43) },
    '1.2.3+build'
  )
  reporters.push(r)
  return r
}
it('deduplicates outside the read path and transmits only a bounded allowlist without cookies', async () => {
  vi.useFakeTimers()
  const send = vi.fn(async () => new Response(null, { status: 202 }))
  vi.stubGlobal('fetch', send)
  const r = reporter()
  for (let n = 0; n < 2000; n++) r.record('arguments', 'translate')
  expect(send).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1000)
  expect(send).toHaveBeenCalledTimes(1)
  const request = send.mock.calls[0]
  expect(request).toBeDefined()
  const calls = vi.mocked(fetch).mock.calls
  const init = calls[0]?.[1]
  expect(init?.credentials).toBe('omit')
  expect(init?.redirect).toBe('error')
  const body = JSON.parse(String(init?.body))
  expect(body.events).toHaveLength(1)
  expect(body.events[0].count).toBe(2000)
  expect(Object.keys(body.events[0]).sort()).toEqual(
    ['appVersion', 'code', 'count', 'id', 'observedAt', 'sdk', 'sdkVersion', 'stage'].sort()
  )
  expect(new TextEncoder().encode(String(init?.body)).length).toBeLessThan(32768)
  await vi.advanceTimersByTimeAsync(30000)
  expect(send).toHaveBeenCalledTimes(1)
})
it('limits retries, drops expired counters and cancels pending batches on dispose', async () => {
  vi.useFakeTimers()
  const send = vi.fn(async () => new Response(null, { status: 503 }))
  vi.stubGlobal('fetch', send)
  const r = reporter()
  r.record('storage', 'cache')
  await vi.advanceTimersByTimeAsync(20000)
  expect(send).toHaveBeenCalledTimes(2)
  r.record('worker', 'worker')
  r.dispose()
  await vi.advanceTimersByTimeAsync(20000)
  expect(send).toHaveBeenCalledTimes(2)
  const other = reporter()
  other.record('network', 'refresh')
  vi.setSystemTime(Date.now() + 900001)
  await vi.advanceTimersByTimeAsync(1000)
  expect(send).toHaveBeenCalledTimes(2)
})
it('cannot affect content when a developer callback throws and makes no default telemetry calls', async () => {
  const send = vi.fn()
  vi.stubGlobal('fetch', send)
  const bundle = compileBundle({
    version: 1,
    languages: [{ locale: 'en', fallback: null }],
    locales: [{ locale: 'en', entries: [{ key: 'ok', format: 'plain', parameters: [], value: 'Available' }] }]
  })
  const driver: UpdateDriver = {
    restore: async () => null,
    refresh: async () => {
      throw new LocalisyncError('network', 'Secret must stay in the callback')
    },
    locale: async () => {
      throw new LocalisyncError('locale', 'Unavailable')
    },
    commit: async () => ({ persisted: true }),
    dispose: () => {}
  }
  const client = new LocalisyncClient(
    {
      bundle,
      locale: 'en',
      onDiagnostic: () => {
        throw Error('application secret')
      }
    },
    driver
  )
  await client.start()
  expect(client.translate('ok')).toBe('Available')
  expect(send).not.toHaveBeenCalled()
  client.dispose()
})
it('rejects read keys, insecure endpoints, queries and URL credentials', () => {
  for (const endpoint of [
    'http://remote.invalid/telemetry/v1/sdk-events',
    'https://x.invalid/wrong',
    'https://user:pass@x.invalid/telemetry/v1/sdk-events',
    'https://x.invalid/telemetry/v1/sdk-events?secret=x'
  ])
    expect(() => new DiagnosticsReporter({ endpoint, key: 'lsd_' + 'a'.repeat(43) }, '1.0.0')).toThrow()
  expect(
    () => new DiagnosticsReporter({ endpoint: 'https://x.invalid/telemetry/v1/sdk-events', key: 'read-key' }, '1.0.0')
  ).toThrow()
})
