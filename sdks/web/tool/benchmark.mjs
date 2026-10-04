import { createBenchmarkFixture } from './performance-fixtures.mjs'
import { createServer } from 'node:http'
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto'
import { mkdtemp, rm, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { tmpdir, cpus, totalmem } from 'node:os'
import { join, resolve } from 'node:path'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { createRequire } from 'node:module'
import { chromium } from '@playwright/test'
import { createServerClient } from '../packages/web/dist/server.js'
import { compileBundle } from '../packages/web/dist/compiler.js'
const require = createRequire(new URL('../packages/web/package.json', import.meta.url))
const { CompactSign, importPKCS8 } = require('jose')
const pair = generateKeyPairSync('ed25519'),
  privateKey = await importPKCS8(pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), 'EdDSA'),
  publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' })
const sign = value =>
  new CompactSign(new TextEncoder().encode(JSON.stringify(value)))
    .setProtectedHeader({ alg: 'EdDSA', kid: 'benchmark', typ: 'localisync+json' })
    .sign(privateKey)
const hash = value => createHash('sha256').update(value).digest('hex')
const projectId = randomUUID(),
  distributionId = randomUUID()
const output = resolve('.local/web-sdk-benchmark')
await mkdir(output, { recursive: true })
let artifact
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname
  if (path === '/') {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="en"><title>Localisync benchmark</title><h1>Benchmark</h1><input aria-label="Draft"><script src="/sdk.js"></script></html>'
    )
    return
  }
  if (path === '/sdk.js' || path === '/worker.js') {
    res.setHeader('Content-Type', 'application/javascript')
    res.end(
      await readFile(
        new URL('../packages/web/dist/' + (path === '/sdk.js' ? 'localisync.js' : 'worker.js'), import.meta.url)
      )
    )
    return
  }
  if (req.headers.authorization !== 'Bearer benchmark-only') {
    res.writeHead(401).end()
    return
  }
  const value = path.includes('/files/')
    ? artifact.files[path.split('/').at(-1)]
    : path.includes('/releases/')
      ? artifact.manifest
      : artifact.catalog
  if (!value) {
    res.writeHead(404).end()
    return
  }
  res.end(value)
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
})
const origin = 'http://127.0.0.1:' + server.address().port
const bundle = compileBundle({
  version: 1,
  languages: [{ locale: 'en', fallback: null }],
  locales: [{ locale: 'en', entries: [{ key: 'plain', format: 'plain', parameters: [], value: 'Bundled' }] }]
})
const repeats = 30,
  results = []
const percentile = (values, q) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * q) - 1]
const summarize = values => ({
  samples: values.length,
  p50: percentile(values, 0.5),
  p95: percentile(values, 0.95),
  p99: percentile(values, 0.99),
  max: values.reduce((max, value) => Math.max(max, value), -Infinity)
})
const createArtifact = profile => createBenchmarkFixture(profile, { projectId, distributionId, sign, hash })
const browser = await chromium.launch({ headless: true })
try {
  for (const profile of (process.env.SDK_BENCH_PROFILES ?? 'small,icu,long').split(',')) {
    artifact = await createArtifact(profile)
    const base = {
      projectId,
      distributionId,
      channel: 'preview',
      addresses: ['http://127.0.0.1:1', origin],
      trustedKeys: { benchmark: publicKey },
      readKey: 'benchmark-only',
      appVersion: '1.0.0',
      locale: 'en',
      preparedLocales: ['en', 'tr', 'fr', 'de', 'es'],
      bundle,
      allowDevelopmentHttp: true,
      requestTimeoutMs: 15000,
      refreshTimeoutMs: 60000
    }
    const phases = [],
      browserPhases = [],
      plainLookup = [],
      baselineFrames = [],
      baselineInputMs = [],
      activeInputMs = [],
      inputPhases = [],
      diskBytes = [],
      firstText = [],
      browserHeap = [],
      browserStorage = []
    const nodeCold = [],
      nodeCache = [],
      nodeLookup = [],
      browserCold = [],
      browserCache = [],
      frameMax = [],
      longTasks = [],
      memory = []
    for (let iteration = 0; iteration < repeats; iteration++) {
      const directory = await mkdtemp(join(tmpdir(), 'localisync-web-bench-'))
      let client = createServerClient({ ...base, cacheDirectory: directory }),
        started = performance.now()
      const first = performance.now()
      client.translate('plain')
      firstText.push(performance.now() - first)
      await client.start()
      phases.push(client.getStatus().timings)
      nodeCold.push(performance.now() - started)
      if (client.getStatus().error) throw client.getStatus().error
      const args = profile === 'long' ? undefined : { n: 42 },
        key = profile === 'long' ? 'message_2' : 'icu'
      for (let i = 0; i < 5000; i++) client.translate(key, args)
      for (let i = 0; i < 20000; i++) {
        const start = performance.now()
        client.translate(key, args)
        nodeLookup.push((performance.now() - start) * 1000)
      }
      for (let i = 0; i < 5000; i++) client.translate('plain')
      for (let i = 0; i < 20000; i++) {
        const start = performance.now()
        client.translate('plain')
        plainLookup.push((performance.now() - start) * 1000)
      }
      const files = await readdir(directory)
      diskBytes.push(
        (await Promise.all(files.map(file => stat(join(directory, file))))).reduce((sum, item) => sum + item.size, 0)
      )
      memory.push(process.memoryUsage().rss)
      await client.dispose()
      client = createServerClient({ ...base, cacheDirectory: directory, checkOnStart: false })
      started = performance.now()
      await client.start()
      nodeCache.push(performance.now() - started)
      if (client.translate('plain') !== 'Published') throw new Error('Cache did not restore')
      await client.dispose()
      await rm(directory, { recursive: true, force: true })
      const context = await browser.newContext(),
        page = await context.newPage()
      await page.goto(origin)
      baselineFrames.push(
        await page.evaluate(
          () =>
            new Promise(resolve => {
              let previous = performance.now(),
                maximum = 0,
                count = 0
              const tick = time => {
                maximum = Math.max(maximum, time - previous)
                previous = time
                if (++count < 10) requestAnimationFrame(tick)
                else resolve(maximum)
              }
              requestAnimationFrame(tick)
            })
        )
      )
      let inputStarted = performance.now()
      await page.getByRole('textbox', { name: 'Draft' }).fill('baseline')
      baselineInputMs.push(performance.now() - inputStarted)
      const samplePromise = page.evaluate(async config => {
        const frames = [],
          tasks = []
        let running = true,
          last = performance.now()
        const frame = t => {
          frames.push(t - last)
          last = t
          if (running) requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
        const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration)))
        observer.observe({ type: 'longtask', buffered: true })
        window.client = window.Localisync.createClient({ ...config, workerUrl: '/worker.js' })
        const start = performance.now()
        await window.client.start()
        const duration = performance.now() - start
        await new Promise(resolve => setTimeout(resolve, 100))
        running = false
        observer.disconnect()
        const status = window.client.getStatus()
        await window.client.dispose()
        const storage = await navigator.storage.estimate()
        return {
          duration,
          error: status.error?.message,
          frame: Math.max(...frames),
          tasks,
          timings: status.timings,
          heap: performance.memory?.usedJSHeapSize ?? null,
          storage: storage.usage ?? null
        }
      }, base)
      await page.waitForFunction(() => window.client !== undefined)
      inputPhases.push(await page.evaluate(() => window.client.getStatus().phase))
      inputStarted = performance.now()
      await page.getByRole('textbox', { name: 'Draft' }).fill('retained during update')
      activeInputMs.push(performance.now() - inputStarted)
      const sample = await samplePromise
      if ((await page.getByRole('textbox', { name: 'Draft' }).inputValue()) !== 'retained during update')
        throw new Error('The update lost form input')
      if (sample.error) throw new Error(sample.error)
      browserCold.push(sample.duration)
      browserPhases.push(sample.timings)
      if (sample.heap !== null) browserHeap.push(sample.heap)
      if (sample.storage !== null) browserStorage.push(sample.storage)
      frameMax.push(sample.frame)
      longTasks.push(...sample.tasks)
      await page.reload()
      const cached = await page.evaluate(async config => {
        const client = window.Localisync.createClient({ ...config, workerUrl: '/worker.js', checkOnStart: false })
        const start = performance.now()
        await client.start()
        const duration = performance.now() - start,
          text = client.translate('plain'),
          error = client.getStatus().error?.message
        await client.dispose()
        return { duration, text, error }
      }, base)
      if (cached.text !== 'Published' || cached.error) throw new Error('Browser cache failed: ' + cached.error)
      browserCache.push(cached.duration)
      await context.close()
      console.info(
        JSON.stringify({
          profile,
          iteration: iteration + 1,
          nodeMs: nodeCold.at(-1),
          browserMs: sample.duration,
          frameMs: sample.frame
        })
      )
    }
    results.push({
      profile,
      keys: artifact.count,
      values: artifact.count * 5,
      bytes: artifact.bytes,
      repeats,
      firstBundledLookupMs: summarize(firstText),
      phaseMs: Object.fromEntries(Object.keys(phases[0]).map(key => [key, summarize(phases.map(item => item[key]))])),
      browserPhaseMs: Object.fromEntries(
        Object.keys(browserPhases[0]).map(key => [key, summarize(browserPhases.map(item => item[key]))])
      ),
      plainLookupMicroseconds: summarize(plainLookup),
      nodeDiskBytes: summarize(diskBytes),
      browserHeapBytes: summarize(browserHeap),
      browserStorageBytes: summarize(browserStorage),
      baselineMaxFrameIntervalsMs: summarize(baselineFrames),
      baselineAutomatedInputMs: summarize(baselineInputMs),
      activeAutomatedInputMs: summarize(activeInputMs),
      inputPhases,
      nodeColdMs: summarize(nodeCold),
      nodeCacheMs: summarize(nodeCache),
      lookupMicroseconds: summarize(nodeLookup),
      nodeRssBytes: summarize(memory),
      browserColdMs: summarize(browserCold),
      browserCacheMs: summarize(browserCache),
      maxFrameIntervalsMs: summarize(frameMax),
      longTasksMs: longTasks.length ? summarize(longTasks) : { samples: 0 }
    })
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify(
        {
          date: new Date().toISOString(),
          node: process.version,
          browser: browser.version(),
          platform: process.platform,
          arch: process.arch,
          cpu: cpus()[0].model,
          memoryBytes: totalmem(),
          transport: 'loopback HTTP; includes network separate from synchronous lookup',
          results
        },
        null,
        2
      )
    )
  }
  const sizes = []
  for (const name of ['web', 'cli'])
    for (const file of await readdir(resolve('sdks/web/packages/' + name + '/dist')))
      if (file.endsWith('.js')) {
        const bytes = await readFile(resolve('sdks/web/packages/' + name + '/dist/' + file))
        sizes.push({
          name,
          file,
          bytes: bytes.length,
          gzip: gzipSync(bytes).length,
          brotli: brotliCompressSync(bytes).length
        })
      }
  await writeFile(join(output, 'sizes.json'), JSON.stringify(sizes, null, 2))
} finally {
  await browser.close()
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
