import { createServer } from 'node:http'
import { spawnPnpm } from './process.mjs'
import { readFile, writeFile, unlink, mkdir, open } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
const fixture = JSON.parse(await readFile('test/sdk-protocol/delivery.json', 'utf8')),
  directory = resolve('sdks/web/examples/next'),
  configPath = directory + '/public/localisync.json',
  output = resolve('.local/web-sdk-next')
await mkdir(output, { recursive: true })
await mkdir(directory + '/public', { recursive: true })
const server = createServer((req, res) => {
  if (req.headers.origin) res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, If-None-Match')
  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }
  const path = req.url
  const value = path.includes('/files/')
    ? fixture.files[path.split('/').at(-1)]
    : path.includes('/releases/')
      ? fixture.manifestJws
      : fixture.catalogJws
  res.end(value)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port
const config = {
  projectId: fixture.projectId,
  distributionId: fixture.distributionId,
  channel: 'preview',
  addresses: ['http://127.0.0.1:1', origin],
  readKey: 'test-only',
  trustedKeys: { 'test-1': fixture.publicKey },
  appVersion: '1.2.3',
  locale: 'tr',
  allowDevelopmentHttp: true,
  requestTimeoutMs: 1000
}
async function command(args, env = {}) {
  const child = spawnPnpm(args, { cwd: directory, env: { ...process.env, ...env }, stdio: 'inherit' })
  await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', code => (code === 0 ? resolve() : reject(new Error('Command failed ' + args.join(' ')))))
  })
}
let processServer,
  browser,
  ownsConfig = false
try {
  const handle = await open(configPath, 'wx')
  ownsConfig = true
  await handle.writeFile(JSON.stringify(config))
  await handle.close()
  await command(['build'])
  processServer = spawnPnpm(['exec', 'next', 'start', '-p', '4346', '-H', '127.0.0.1'], {
    cwd: directory,
    stdio: 'inherit'
  })
  let html = ''
  for (let n = 0; n < 100; n++) {
    html = await fetch('http://127.0.0.1:4346')
      .then(r => r.text())
      .catch(() => '')
    if (html.includes(fixture.releaseId)) break
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert(html.includes(fixture.releaseId), 'Node SSR must use the verified remote snapshot from the startup runtime')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage(),
    errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('http://127.0.0.1:4346')
  await page.getByRole('heading').filter({ hasText: 'Merhaba Developer' }).waitFor()
  await page.getByRole('textbox').fill('persistent draft')
  await page.getByRole('combobox').selectOption('en')
  await page.getByRole('heading').filter({ hasText: 'Hello Developer' }).waitFor()
  assert.equal(await page.getByRole('textbox').inputValue(), 'persistent draft')
  assert.deepEqual(errors, [])
  processServer.kill('SIGTERM')
  await browser.close()
  browser = null
  await command(['build'], { LOCALISYNC_STATIC: 'true' })
  const staticHtml = await readFile(directory + '/out/index.html', 'utf8')
  assert(staticHtml.includes('Merhaba'))
  assert(!staticHtml.includes(fixture.releaseId), 'Static export uses build-time bundled content')
  await writeFile(
    output + '/results.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        node: process.version,
        next: '16.3.8',
        ssrRemote: true,
        hydration: true,
        draft: true,
        locale: true,
        staticBundle: true
      },
      null,
      2
    )
  )
} finally {
  processServer?.kill('SIGTERM')
  await browser?.close()
  if (ownsConfig) await unlink(configPath)
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
