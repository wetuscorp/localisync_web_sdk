import { createBenchmarkFixture } from './performance-fixtures.mjs'
import { createServerClient } from '../packages/web/dist/server.js'
import { compileBundle } from '../packages/web/dist/compiler.js'
import { createRequire } from 'node:module'
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../packages/web/package.json', import.meta.url)),
  { CompactSign, importPKCS8 } = require('jose')
const pair = generateKeyPairSync('ed25519'),
  key = await importPKCS8(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), 'EdDSA'),
  publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
const sign = value =>
    new CompactSign(new TextEncoder().encode(JSON.stringify(value)))
      .setProtectedHeader({ alg: 'EdDSA', kid: 'stress', typ: 'localisync+json' })
      .sign(key),
  hash = value => createHash('sha256').update(value).digest('hex'),
  projectId = randomUUID(),
  distributionId = randomUUID()
let artifact = await createBenchmarkFixture('long', { projectId, distributionId, sign, hash })
const server = createServer((req, res) => {
  const path = req.url
  res.end(
    path.includes('/files/')
      ? artifact.files[path.split('/').at(-1)]
      : path.includes('/releases/')
        ? artifact.manifest
        : artifact.catalog
  )
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port,
  directory = await mkdtemp(join(tmpdir(), 'localisync-sdk-stress-'))
const config = {
  projectId,
  distributionId,
  channel: 'preview',
  addresses: ['http://127.0.0.1:1', origin],
  trustedKeys: { stress: publicKey },
  readKey: 'test-only',
  appVersion: '1.0.0',
  locale: 'en',
  preparedLocales: ['en', 'tr', 'fr', 'de', 'es'],
  bundle: compileBundle({
    version: 1,
    languages: [{ locale: 'en', fallback: null }],
    locales: [{ locale: 'en', entries: [] }]
  }),
  allowDevelopmentHttp: true,
  cacheDirectory: directory
}
const client = createServerClient(config),
  samples = []
try {
  await client.start()
  assert.equal(client.getStatus().error, null)
  for (let revision = 2; revision <= 7; revision++) {
    artifact = await createBenchmarkFixture('long', { projectId, distributionId, sign, hash, revision })
    const old = client.capture(),
      started = performance.now()
    await client.refresh()
    assert.equal(client.getStatus().error, null)
    assert.equal(client.getStatus().revision, revision)
    assert.notEqual(old.remote.releaseId, client.capture().remote.releaseId)
    const requests = await Promise.all(
      Array.from({ length: 100 }, async (_, i) => {
        const view = client.capture(['en', 'tr', 'fr', 'de', 'es'][i % 5])
        await Promise.resolve()
        return view.translate('message_2')
      })
    )
    assert.equal(requests.length, 100)
    samples.push({
      revision,
      updateMs: performance.now() - started,
      rss: process.memoryUsage().rss,
      heap: process.memoryUsage().heapUsed,
      concurrentPinnedRequests: 100
    })
    console.info(samples.at(-1))
  }
  await client.dispose()
  const restart = createServerClient({ ...config, checkOnStart: false })
  try {
    await restart.start()
    assert.equal(restart.getStatus().error, null)
    assert.equal(restart.getStatus().revision, 7)
  } finally {
    await restart.dispose()
  }
  await mkdir(resolve('.local/web-sdk-stress'), { recursive: true })
  await writeFile(
    resolve('.local/web-sdk-stress/results.json'),
    JSON.stringify({ node: process.version, bytes: artifact.bytes, samples, restart: true }, null, 2)
  )
} finally {
  await client.dispose()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
