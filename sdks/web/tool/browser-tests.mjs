import { chromium, firefox, webkit } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { safariBrowser } from './safari.mjs'

const require = createRequire(new URL('../packages/web/package.json', import.meta.url))
const { build } = require('esbuild')
const fixture = JSON.parse(await readFile(new URL('../../../test/sdk-protocol/delivery.json', import.meta.url), 'utf8'))
const output = resolve('.local/web-sdk-browser')
await mkdir(output, { recursive: true })
await build({
  stdin: {
    contents: `import {createClient} from 'localisync_sdk'; import {bindDom} from 'localisync_sdk/dom'; window.sdk={createClient,bindDom};`,
    resolveDir: resolve('sdks/web/packages/cli')
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outfile: output + '/npm.js'
})
let online = true,
  primaryOnline = true,
  catalog = fixture.catalogJws,
  requests = 0,
  leaked = false,
  corrupt = false,
  redirect = false
function serve(primary) {
  return async (req, res) => {
    const path = new URL(req.url, 'http://127.0.0.1').pathname
    if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, If-None-Match')
    res.setHeader('Access-Control-Expose-Headers', 'ETag')
    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }
    if (path.startsWith('/delivery/v1/')) {
      requests++
      if (req.headers.cookie) leaked = true
      if (!online || (primary && !primaryOnline)) {
        res.writeHead(503).end()
        return
      }
      if (redirect) {
        res.writeHead(302, { Location: '/must-not-follow' }).end()
        return
      }
      if (req.headers.authorization !== 'Bearer fixture-read-key') {
        res.writeHead(401).end()
        return
      }
      let body = path.includes('/files/')
        ? fixture.files[path.split('/').at(-1)]
        : path.includes('/releases/')
          ? fixture.manifestJws
          : catalog
      if (corrupt && path.includes('/files/')) body = (body ?? '') + 'corrupt'
      if (!body) {
        res.writeHead(404).end()
        return
      }
      const etag = '"' + createHash('sha256').update(body).digest('hex') + '"'
      res.setHeader('ETag', etag)
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304).end()
        return
      }
      res.end(body)
      return
    }
    if (path === '/') {
      res.setHeader('Content-Type', 'text/html')
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; worker-src 'self'; connect-src http://127.0.0.1:*; style-src 'self'"
      )
      res.end(
        '<!doctype html><html lang="en"><head><title>Localisync SDK acceptance</title></head><body><main><h1 data-localisync="plain">Initial</h1><input aria-label="Draft" data-localisync-placeholder="plain"><p data-localisync="greeting" data-localisync-args=\'{"name":"Ada"}\'></p></main><script src="/localisync.js"></script><script src="/npm.js"></script></body></html>'
      )
      return
    }
    const files = {
      '/localisync.js': resolve('sdks/web/packages/web/dist/localisync.js'),
      '/worker.js': resolve('sdks/web/packages/web/dist/worker.js'),
      '/npm.js': output + '/npm.js'
    }
    if (!files[path]) {
      res.writeHead(404).end()
      return
    }
    res.setHeader('Content-Type', 'application/javascript')
    try {
      res.end(await readFile(files[path]))
    } catch {
      res.writeHead(500).end()
    }
  }
}
const servers = [createServer(serve(true)), createServer(serve(false))],
  addresses = []
for (const server of servers) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  addresses.push('http://127.0.0.1:' + server.address().port)
}
const bundle = {
  version: 1,
  releaseId: null,
  languages: [
    { locale: 'en', fallback: null },
    { locale: 'tr', fallback: 'en' }
  ],
  locales: ['en', 'tr'].map(locale => ({
    locale,
    entries: [{ key: 'plain', format: 'plain', parameters: [], value: 'Bundled', program: null }]
  }))
}
const configuration = {
  projectId: fixture.projectId,
  distributionId: fixture.distributionId,
  channel: 'preview',
  addresses,
  readKey: 'fixture-read-key',
  trustedKeys: { 'test-1': fixture.publicKey },
  appVersion: '1.2.3',
  allowDevelopmentHttp: true,
  requestTimeoutMs: 500,
  refreshTimeoutMs: 5000,
  workerUrl: '/worker.js',
  locale: 'tr',
  bundle
}
const results = []
try {
  for (const name of (process.env.SDK_BROWSER_TARGETS ?? 'chromium,firefox,webkit,chrome').split(',')) {
    const type = { chromium, chrome: chromium, edge: chromium, firefox, webkit }[name]
    if (!type && name !== 'safari') throw new Error('Unknown browser target: ' + name)
    const browser =
      name === 'safari'
        ? await safariBrowser()
        : await type.launch({
            headless: true,
            ...(['chrome', 'edge'].includes(name) ? { channel: name === 'edge' ? 'msedge' : 'chrome' } : {})
          })
    try {
      for (const distribution of ['script', 'npm']) {
        online = true
        primaryOnline = true
        catalog = fixture.catalogJws
        corrupt = false
        const context = await browser.newContext(),
          page = await context.newPage(),
          errors = []
        page.on('pageerror', error => errors.push(error.message))
        await context.addCookies([{ name: 'must-not-send', value: 'cookie', url: addresses[0] }])
        await page.goto(addresses[0])
        const start = await page.evaluate(
          async ({ config, distribution }) => {
            const sdk = distribution === 'script' ? window.Localisync : window.sdk
            window.client = sdk.createClient(config)
            window.binding = sdk.bindDom(document.querySelector('main'), window.client)
            const initial = window.client.translate('plain')
            document.querySelector('input').value = 'keep my draft'
            await Promise.all([window.client.start(), window.client.start()])
            return {
              initial,
              value: window.client.translate('plain'),
              greeting: window.client.translate('greeting', { name: 'Ada' }),
              ordinal: window.client.translate('rank', { count: 22 }),
              status: window.client.getStatus()
            }
          },
          { config: configuration, distribution }
        )
        assert.equal(start.initial, 'Bundled')
        assert.equal(start.value, 'Published text', JSON.stringify(start.status))
        assert.equal(start.greeting, 'Merhaba Ada')
        assert.equal(start.ordinal, '22nd')
        await page.getByRole('heading').filter({ hasText: 'Published text' }).waitFor()
        assert.equal(await page.getByRole('textbox').inputValue(), 'keep my draft')
        const domSafety = await page.evaluate(async () => {
          const root = document.querySelector('main'),
            dynamic = document.createElement('span'),
            interactive = document.createElement('div'),
            editable = document.createElement('div')
          dynamic.dataset.localisync = 'greeting'
          dynamic.dataset.localisyncArgs = JSON.stringify({ name: '<img src=x onerror=alert(1)>' })
          interactive.dataset.localisync = 'plain'
          const button = document.createElement('button')
          button.textContent = 'Keep action'
          interactive.append(button)
          editable.contentEditable = 'true'
          const draft = document.createElement('span')
          draft.dataset.localisync = 'plain'
          draft.textContent = 'Editable draft'
          editable.append(draft)
          root.append(dynamic, interactive, editable)
          const deadline = performance.now() + 2000
          while (!dynamic.textContent && performance.now() < deadline)
            await new Promise(resolve => setTimeout(resolve, 10))
          const result = {
            dynamic: dynamic.textContent,
            literal: dynamic.querySelector('img') === null,
            interactive: interactive.contains(button),
            editable: draft.textContent
          }
          dynamic.remove()
          interactive.remove()
          editable.remove()
          return result
        })
        assert.equal(domSafety.dynamic, 'Merhaba <img src=x onerror=alert(1)>')
        assert.equal(domSafety.literal, true)
        assert.equal(domSafety.interactive, true)
        assert.equal(domSafety.editable, 'Editable draft')
        const before = requests
        await page.evaluate(() => {
          for (let n = 0; n < 100; n++) window.client.translate('basket', { count: n })
          window.dispatchEvent(new Event('online'))
          window.dispatchEvent(new Event('focus'))
        })
        assert.equal(requests, before)
        primaryOnline = false
        catalog = fixture.rollbackJws
        await page.evaluate(() => window.client.refresh())
        assert.equal(await page.evaluate(() => window.client.getStatus().revision), 3)
        catalog = fixture.conflictJws
        await page.evaluate(() => window.client.refresh())
        assert.equal(await page.evaluate(() => window.client.getStatus().error.code), 'verification')
        assert.equal(await page.evaluate(() => window.client.translate('plain')), 'Published text')
        online = false
        await page.evaluate(() => {
          window.binding.dispose()
          window.client.dispose()
        })
        await page.reload()
        const recovered = await page.evaluate(async config => {
          window.client = window.sdk.createClient({ ...config, checkOnStart: false })
          await window.client.start()
          return { text: window.client.translate('plain'), status: window.client.getStatus() }
        }, configuration)
        assert.equal(recovered.text, 'Published text', JSON.stringify(recovered.status))
        const peer = await context.newPage()
        await peer.goto(addresses[0])
        const second = await peer.evaluate(async config => {
          window.client = window.sdk.createClient({ ...config, checkOnStart: false, locale: 'en' })
          await window.client.start()
          return window.client.getSnapshot().locale
        }, configuration)
        assert.equal(second, 'en')
        assert.equal(await page.evaluate(() => window.client.getSnapshot().locale), 'tr')
        assert.deepEqual(errors, [])
        results.push({
          browser: name,
          version: browser.version(),
          distribution,
          startup: true,
          icu: true,
          failover: true,
          revision: true,
          offlineCache: true,
          independentTabs: true,
          draft: true,
          dynamicDomSafety: true,
          cookiesOmitted: !leaked
        })
        await context.close()
        for (const scenario of [
          'corrupt',
          'authorization',
          'scope',
          'quota',
          'manual',
          'redirect',
          'worker',
          'legacy'
        ]) {
          online = true
          primaryOnline = true
          catalog = fixture.catalogJws
          corrupt = scenario === 'corrupt'
          redirect = scenario === 'redirect'
          const isolated = await browser.newContext(),
            probe = await isolated.newPage()
          await probe.goto(addresses[0])
          const outcome = await probe.evaluate(
            async ({ config, scenario, fixture }) => {
              if (scenario === 'legacy')
                await new Promise((resolve, reject) => {
                  const request = indexedDB.open('localisync-web-v1', 1)
                  request.onupgradeneeded = () => request.result.createObjectStore('scopes')
                  request.onerror = () => reject(request.error)
                  request.onsuccess = () => {
                    const db = request.result,
                      transaction = db.transaction('scopes', 'readwrite')
                    const scope = JSON.stringify([
                      1,
                      config.projectId,
                      config.distributionId,
                      config.channel,
                      config.addresses.map(address => new URL(address).origin).sort()
                    ])
                    transaction.objectStore('scopes').put(
                      {
                        version: 1,
                        floor: null,
                        previous: null,
                        active: {
                          catalog: fixture.catalogJws,
                          manifest: fixture.manifestJws,
                          locales: ['tr'],
                          files: fixture.files
                        }
                      },
                      scope
                    )
                    transaction.oncomplete = () => {
                      db.close()
                      resolve()
                    }
                    transaction.onerror = () => reject(transaction.error)
                  }
                })
              const client = window.sdk.createClient({
                ...config,
                ...(scenario === 'quota' ? { cacheMaxBytes: 1 } : {}),
                ...(scenario === 'legacy' ? { checkOnStart: false } : {}),
                ...(scenario === 'manual' ? { activation: 'manual' } : {}),
                ...(scenario === 'worker' ? { workerUrl: '/absent-worker.js' } : {}),
                ...(scenario === 'authorization' ? { readKey: 'wrong' } : {}),
                ...(scenario === 'scope' ? { projectId: '10000000-0000-4000-8000-000000000009' } : {})
              })
              await client.start()
              const before = client.translate('plain'),
                status = client.getStatus()
              if (scenario === 'manual') await client.activatePending()
              const after = client.translate('plain')
              await client.dispose()
              return {
                before,
                after,
                phase: status.phase,
                error: status.error?.code ?? null,
                persisted: status.persisted
              }
            },
            { config: configuration, scenario, fixture }
          )
          if (scenario === 'legacy') {
            assert.equal(outcome.after, 'Published text')
            assert.equal(outcome.persisted, true)
            assert.equal(outcome.error, null)
          } else if (scenario === 'manual') {
            assert.equal(outcome.before, 'Bundled')
            assert.equal(outcome.phase, 'pending')
            assert.equal(outcome.after, 'Published text')
          } else if (scenario === 'quota') {
            assert.equal(outcome.after, 'Published text')
            assert.equal(outcome.persisted, false)
            assert.equal(outcome.error, 'storage')
          } else {
            assert.equal(outcome.after, 'Bundled')
            assert.equal(
              outcome.error,
              {
                corrupt: 'verification',
                scope: 'verification',
                authorization: 'authorization',
                redirect: 'network',
                worker: 'worker'
              }[scenario]
            )
          }
          await isolated.close()
        }
        corrupt = false
        redirect = false
        results.at(-1).failureIsolation = true
        results.at(-1).manualActivation = true
        results.at(-1).quotaFallback = true
        results.at(-1).legacyCacheMigration = true
      }
    } finally {
      await browser.close()
    }
  }
  assert.equal(leaked, false)
} finally {
  for (const server of servers) {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
  await writeFile(
    output + '/results-' + (process.env.SDK_BROWSER_TARGETS ?? 'default').replaceAll(',', '-') + '.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        results
      },
      null,
      2
    )
  )
}
console.info(JSON.stringify(results, null, 2))
