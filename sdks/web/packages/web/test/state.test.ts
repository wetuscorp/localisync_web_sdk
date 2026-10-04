import { describe, it, expect } from 'vitest'
import { LocalisyncClient, LocalisyncError } from 'localisync_sdk/core'
import type { Candidate, UpdateDriver } from 'localisync_sdk/core'
import { compileBundle } from '../src/compiler.js'
import { nextCache } from '../src/cache.js'

const bundle = compileBundle({
  version: 1,
  languages: [
    { locale: 'en', fallback: null },
    { locale: 'tr', fallback: 'en' }
  ],
  locales: ['en', 'tr'].map(locale => ({
    locale,
    entries: [{ key: 'message', value: locale, format: 'plain', parameters: [] }]
  }))
})
function candidate(locale: string): Candidate {
  return { id: locale, revision: 1, locale, bundle: { ...bundle, releaseId: 'published' } }
}
class Driver implements UpdateDriver {
  reads = 0
  checks = 0
  commits = 0
  disposed = false
  blockCommit: Promise<void> = Promise.resolve()
  failure: LocalisyncError | null = null
  async restore() {
    this.reads++
    return null
  }
  async refresh(locale: string) {
    this.checks++
    if (this.failure) throw this.failure
    return candidate(locale)
  }
  async locale(locale: string) {
    if (this.failure) throw this.failure
    return candidate(locale)
  }
  async commit() {
    this.commits++
    await this.blockCommit
    return { persisted: true }
  }
  dispose() {
    this.disposed = true
  }
}
describe('client lifecycle and request isolation', () => {
  it('starts once and merges concurrent refreshes', async () => {
    const driver = new Driver(),
      client = new LocalisyncClient({ bundle, locale: 'en' }, driver)
    expect(driver.reads + driver.checks).toBe(0)
    await Promise.all([client.start(), client.start()])
    expect(driver.reads).toBe(1)
    expect(driver.checks).toBe(1)
    await Promise.all([client.refresh(), client.refresh(), client.refresh()])
    expect(driver.checks).toBe(2)
    client.dispose()
    expect(driver.disposed).toBe(true)
    expect(() => client.refresh()).toThrow()
  })
  it('keeps manual updates pending and immutable captured views independent', async () => {
    const driver = new Driver(),
      client = new LocalisyncClient({ bundle, locale: 'en', activation: 'manual' }, driver)
    const old = client.capture('tr')
    await client.start()
    expect(client.getStatus().phase).toBe('pending')
    expect(driver.commits).toBe(0)
    await client.activatePending()
    expect(driver.commits).toBe(1)
    await client.setLocale('tr')
    expect(client.capture('en').locale).toBe('en')
    expect(client.getSnapshot().locale).toBe('tr')
    expect(old.translate('message')).toBe('tr')
    driver.failure = new LocalisyncError('network', 'Unavailable')
    await client.refresh()
    expect(client.translate('message')).toBe('tr')
    await client.setLocale('en')
    expect(client.getSnapshot().locale).toBe('tr')
    client.dispose()
  })
  it('does not allow a late activation to override a newer locale selection', async () => {
    const driver = new Driver(),
      client = new LocalisyncClient({ bundle, locale: 'en', checkOnStart: false }, driver)
    let release: () => void = () => undefined
    driver.blockCommit = new Promise<void>(resolve => {
      release = resolve
    })
    const refreshing = client.refresh()
    await Promise.resolve()
    await Promise.resolve()
    await client.setLocale('tr')
    release()
    await refreshing
    expect(client.getSnapshot().locale).toBe('tr')
    client.dispose()
  })
  it('keeps cache and status failures visible without losing translations', async () => {
    class StorageFailure extends Driver {
      override async commit() {
        return { persisted: false, error: new LocalisyncError('storage', 'Quota exceeded') }
      }
    }
    const client = new LocalisyncClient({ bundle, locale: 'en' }, new StorageFailure())
    await client.start()
    expect(client.translate('message')).toBe('en')
    expect(client.getStatus().persisted).toBe(false)
    expect(client.getStatus().error?.code).toBe('storage')
    client.dispose()
  })
  it('compares cache floors and preserves the prior generation', () => {
    const floor = { catalog: 'signed', revision: 5, digest: 'abc' },
      raw = { catalog: 'signed', manifest: 'a', locales: ['en'], files: { hash: 'text' } }
    const first = nextCache(null, { floor, generation: raw, maxBytes: 1000 })
    const next = nextCache(first, {
      floor: { ...floor, revision: 6 },
      generation: { ...raw, manifest: 'b' },
      maxBytes: 1000
    })
    expect(next.previous).toEqual(raw)
    expect(() => nextCache(next, { floor, maxBytes: 1000 })).toThrow()
    expect(() => nextCache(next, { floor: { ...floor, revision: 6, digest: 'different' }, maxBytes: 1000 })).toThrow()
    expect(() => nextCache(next, { floor: { ...floor, revision: 7 }, generation: raw, maxBytes: 1 })).toThrow()
  })
})
