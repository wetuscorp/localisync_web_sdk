import { createBenchmarkFixture } from './performance-fixtures.mjs'
import { createServer } from 'node:http'
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../packages/web/package.json', import.meta.url)),
  { CompactSign, importPKCS8 } = require('jose')
const pair = generateKeyPairSync('ed25519'),
  key = await importPKCS8(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), 'EdDSA'),
  publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
const sign = value =>
    new CompactSign(new TextEncoder().encode(JSON.stringify(value)))
      .setProtectedHeader({ alg: 'EdDSA', kid: 'interaction', typ: 'localisync+json' })
      .sign(key),
  hash = value => createHash('sha256').update(value).digest('hex')
const projectId = randomUUID(),
  distributionId = randomUUID()
let artifact
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="en"><title>Localisync interaction benchmark</title><input aria-label="Draft"><script src="/sdk.js"></script></html>'
    )
    return
  }
  if (['/sdk.js', '/worker.js'].includes(req.url)) {
    res.setHeader('Content-Type', 'application/javascript')
    res.end(
      await readFile(
        new URL('../packages/web/dist/' + (req.url === '/sdk.js' ? 'localisync.js' : 'worker.js'), import.meta.url)
      )
    )
    return
  }
  if (req.headers.authorization !== 'Bearer interaction-only') {
    res.writeHead(401).end()
    return
  }
  res.end(
    req.url.includes('/files/')
      ? artifact.files[req.url.split('/').at(-1)]
      : req.url.includes('/releases/')
        ? artifact.manifest
        : artifact.catalog
  )
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port,
  browser = await chromium.launch({ headless: true }),
  results = []
const config = {
  projectId,
  distributionId,
  channel: 'preview',
  addresses: ['http://127.0.0.1:1', origin],
  trustedKeys: { interaction: publicKey },
  readKey: 'interaction-only',
  appVersion: '1.0.0',
  locale: 'en',
  preparedLocales: ['en', 'tr', 'fr', 'de', 'es'],
  bundle: {
    version: 1,
    releaseId: null,
    languages: [{ locale: 'en', fallback: null }],
    locales: [{ locale: 'en', entries: [] }]
  },
  allowDevelopmentHttp: true,
  workerUrl: '/worker.js'
}
const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return {
    samples: values.length,
    p95: sorted[Math.ceil(values.length * 0.95) - 1],
    p99: sorted[Math.ceil(values.length * 0.99) - 1],
    max: sorted.at(-1)
  }
}
try {
  for (const profile of ['small', 'icu', 'long']) {
    artifact = await createBenchmarkFixture(profile, { projectId, distributionId, sign, hash })
    const baseline = [],
      active = [],
      phases = {}
    for (let iteration = 0; iteration < 30; iteration++) {
      const context = await browser.newContext(),
        page = await context.newPage()
      await page.goto(origin)
      const input = page.getByRole('textbox', { name: 'Draft' })
      await input.focus()
      await input.fill('warm focus')
      let started = performance.now()
      await input.fill('baseline')
      baseline.push(performance.now() - started)
      await page.evaluate(config => {
        window.client = window.Localisync.createClient(config)
        window.update = window.client.start()
      }, config)
      await page.waitForFunction(() => ['checking', 'ready', 'error'].includes(window.client.getStatus().phase))
      // Deliberately sample after startup and during preparation/transfer for larger profiles.
      for (let probe = 0; probe < 5; probe++) {
        await new Promise(resolve => setTimeout(resolve, 150))
        const phase = await page.evaluate(() => window.client.getStatus().phase)
        phases[phase] = (phases[phase] ?? 0) + 1
        started = performance.now()
        await input.fill('active-' + probe)
        active.push(performance.now() - started)
      }
      const status = await page.evaluate(async () => {
        await window.update
        const status = window.client.getStatus()
        await window.client.dispose()
        return status
      })
      assert.equal(status.error, null)
      assert.equal(await input.inputValue(), 'active-4')
      await context.close()
    }
    results.push({
      profile,
      bytes: artifact.bytes,
      repeats: 30,
      baselineMs: summarize(baseline),
      activeMs: summarize(active),
      phases
    })
    console.info(results.at(-1))
  }
  await mkdir('.local/web-sdk-interaction', { recursive: true })
  await writeFile(
    '.local/web-sdk-interaction/results.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        node: process.version,
        mode: 'headless; warm focus on both baseline and active; includes automation roundtrip',
        results
      },
      null,
      2
    )
  )
} finally {
  await browser.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
