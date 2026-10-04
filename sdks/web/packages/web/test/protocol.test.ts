import { describe, it, expect } from 'vitest'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer, type Server } from 'node:http'
import { ContentView, LocalisyncClient } from 'localisync_sdk/core'
import { compileBundle, compileEntry } from '../src/compiler.js'
import { strictJson } from '../src/json.js'
import { DeliveryEngine } from '../src/delivery.js'
import { validateConfig } from '../src/config.js'
import { NodeCache } from '../src/cache-node.js'
import { Verifier } from '../src/verification.js'
import { catalogSchema, compatible } from '@localisync/delivery-protocol/runtime'
import { z } from 'zod'

const fixture = z
  .object({
    publicKey: z.string(),
    projectId: z.string(),
    distributionId: z.string(),
    releaseId: z.string(),
    catalogJws: z.string(),
    manifestJws: z.string(),
    rollbackJws: z.string(),
    conflictJws: z.string(),
    emptyJws: z.string(),
    files: z.record(z.string(), z.string()),
    versions: z.array(
      z.object({
        version: z.string(),
        bounds: z.object({ min: z.string().nullable(), max: z.string().nullable() }),
        compatible: z.boolean()
      })
    )
  })
  .parse(JSON.parse(await readFile(new URL('../../../../../test/sdk-protocol/delivery.json', import.meta.url), 'utf8')))
const icu = z
  .object({
    valid: z.array(
      z.object({
        locale: z.string(),
        message: z.string(),
        args: z.record(z.string(), z.union([z.string(), z.number()])),
        parameters: z.array(z.object({ name: z.string(), type: z.enum(['text', 'number']) })),
        expected: z.string()
      })
    ),
    invalid: z.array(z.string())
  })
  .parse(JSON.parse(await readFile(new URL('../../../../../test/sdk-protocol/icu.json', import.meta.url), 'utf8')))
const bundle = compileBundle({
  version: 1,
  languages: [
    { locale: 'en', fallback: null },
    { locale: 'tr', fallback: 'en' }
  ],
  locales: ['en', 'tr'].map(locale => ({
    locale,
    entries: [{ key: 'plain', value: 'Bundled', format: 'plain', parameters: [] }]
  }))
})
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Port')
  return `http://127.0.0.1:${address.port}`
}
const config = (addresses: [string, string]) =>
  validateConfig({
    projectId: fixture.projectId,
    distributionId: fixture.distributionId,
    channel: 'preview',
    addresses,
    readKey: 'test-only',
    trustedKeys: { 'test-1': fixture.publicKey },
    appVersion: '1.2.3',
    allowDevelopmentHttp: true,
    requestTimeoutMs: 500,
    refreshTimeoutMs: 5000
  })

describe('shared SDK protocol', () => {
  for (const item of fixture.versions)
    it(`SemVer ${item.version}`, () => expect(compatible(item.version, item.bounds)).toBe(item.compatible))
  for (const [index, item] of icu.valid.entries())
    it(`ICU fixture ${index}: ${item.locale}`, () => {
      const entry = compileEntry({ key: 'test', value: item.message, format: 'icu', parameters: item.parameters })
      const view = new ContentView(
        {
          version: 1,
          releaseId: null,
          languages: [{ locale: item.locale, fallback: null }],
          locales: [{ locale: item.locale, entries: [entry] }]
        },
        item.locale,
        'bundle'
      )
      expect(view.resolve('test', item.args)?.text).toBe(item.expected)
    })
  for (const message of icu.invalid)
    it(`rejects unsupported ICU ${message}`, () =>
      expect(() =>
        compileEntry({ key: 'test', value: message, format: 'icu', parameters: [{ name: 'n', type: 'number' }] })
      ).toThrow())
  it('rejects duplicate JSON and unsafe nesting', () => {
    for (const value of [
      '{"a":1,"a":2}',
      '{"__proto__":{}}',
      '[1,]',
      '{/*x*/"a":1}',
      '['.repeat(65) + '0' + ']'.repeat(65)
    ])
      expect(() => strictJson(value, 10000)).toThrow()
  })
  it('rejects a changed signed payload and an unknown key', async () => {
    const verifier = new Verifier({ 'test-1': fixture.publicKey })
    expect((await verifier.verify(fixture.catalogJws, catalogSchema, 1024 * 1024)).revision).toBe(1)
    await expect(new Verifier({}).verify(fixture.catalogJws, catalogSchema, 1024 * 1024)).rejects.toThrow()
    await expect(
      verifier.verify(fixture.catalogJws.slice(0, -10) + 'AAAAAAAAAA', catalogSchema, 1024 * 1024)
    ).rejects.toThrow()
  })
  it('updates, fails over, preserves a revision floor and restores offline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'localisync-web-'))
    let catalog = fixture.catalogJws,
      requests = 0
    const server = createServer((req, res) => {
      requests++
      if (req.headers.authorization !== 'Bearer test-only') {
        res.writeHead(401).end()
        return
      }
      const path = req.url ?? ''
      if (path.endsWith('/manifest')) res.end(path.includes('/releases/') ? fixture.manifestJws : catalog)
      else {
        const value = fixture.files[path.split('/').at(-1) ?? '']
        if (value) res.end(value)
        else res.writeHead(404).end()
      }
    })
    const origin = await listen(server)
    const cache = new NodeCache(directory),
      engine = new DeliveryEngine(config(['http://127.0.0.1:1', origin]), cache, bundle)
    const client = new LocalisyncClient({ bundle, locale: 'tr' }, engine)
    try {
      expect(client.translate('plain')).toBe('Bundled')
      await Promise.all([client.start(), client.start()])
      expect(client.getStatus().error).toBeNull()
      expect(client.translate('greeting', { name: 'Ada' })).toBe('Merhaba Ada')
      expect(client.resolve('fallback').locale).toBe('en')
      const first = requests
      client.translate('plain')
      client.translate('basket', { count: 2 })
      expect(requests).toBe(first)
      catalog = fixture.rollbackJws
      await client.refresh()
      expect(client.getStatus().revision).toBe(3)
      catalog = fixture.catalogJws
      await client.refresh()
      expect(client.getStatus().error?.code).toBe('verification')
      expect(client.translate('plain')).toBe('Published text')
      const before = client.capture('en')
      await client.setLocale('en')
      expect(client.getSnapshot().locale).toBe('en')
      expect(before.locale).toBe('en')
      await engine.dispose()
      await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
      const restart = new DeliveryEngine(config(['http://127.0.0.1:1', origin]), new NodeCache(directory), bundle)
      const restored = await restart.restore('tr')
      expect(restored?.bundle.releaseId).toBe(fixture.releaseId)
      await restart.dispose()
    } finally {
      client.dispose()
      server.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
