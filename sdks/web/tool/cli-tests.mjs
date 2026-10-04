import { createServer } from 'node:http'
import { readFile, writeFile, mkdtemp, mkdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import assert from 'node:assert/strict'
import { ContentView } from '../packages/web/dist/core.js'
const fixture = JSON.parse(await readFile('test/sdk-protocol/delivery.json', 'utf8'))
let corrupt = false
const server = createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer fixture-cli-key') {
    res.writeHead(401).end()
    return
  }
  const body = req.url.includes('/files/')
    ? fixture.files[req.url.split('/').at(-1)]
    : req.url.includes('/releases/')
      ? fixture.manifestJws
      : fixture.catalogJws
  res.end(body + (corrupt && req.url.includes('/files/') ? 'corrupt' : ''))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const directory = await mkdtemp(join(tmpdir(), 'localisync-cli-test-')),
  executable = resolve('sdks/web/packages/cli/dist/index.js')
const run = promisify(execFile)
try {
  const config = {
    projectId: fixture.projectId,
    distributionId: fixture.distributionId,
    channel: 'preview',
    addresses: ['http://127.0.0.1:1', 'http://127.0.0.1:' + server.address().port],
    trustedKeys: { 'test-1': fixture.publicKey },
    appVersion: '1.2.3',
    locale: 'tr',
    preparedLocales: ['en'],
    allowDevelopmentHttp: true
  }
  const input = join(directory, 'config.json'),
    output = join(directory, 'generated')
  await writeFile(input, JSON.stringify(config))
  await run(process.execPath, [executable, 'download', input, output], {
    env: { ...process.env, LOCALISYNC_READ_KEY: 'fixture-cli-key' },
    timeout: 30000
  })
  const bundle = (await import(pathToFileURL(join(output, 'bundle.js')).href)).default
  assert.equal(new ContentView(bundle, 'tr', 'bundle').resolve('greeting', { name: 'Ada' }).text, 'Merhaba Ada')
  const generated = await readFile(join(output, 'bundle.js'), 'utf8')
  assert(!generated.includes('fixture-cli-key'))
  await assert.rejects(
    run(process.execPath, [executable, 'download', input, output], {
      env: { ...process.env, LOCALISYNC_READ_KEY: 'fixture-cli-key' },
      timeout: 30000
    })
  )
  assert.equal(await readFile(join(output, 'bundle.js'), 'utf8'), generated)
  corrupt = true
  const invalid = join(directory, 'invalid')
  await assert.rejects(
    run(process.execPath, [executable, 'download', input, invalid], {
      env: { ...process.env, LOCALISYNC_READ_KEY: 'fixture-cli-key' },
      timeout: 30000
    })
  )
  assert.equal(await stat(invalid).catch(() => null), null)
  await mkdir('.local/web-sdk-cli', { recursive: true })
  await writeFile(
    '.local/web-sdk-cli/results.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        node: process.version,
        signedDownload: true,
        preparedIcu: true,
        noReadKeyInOutput: true,
        existingOutputPreserved: true,
        corruptDownloadNoPartialOutput: true
      },
      null,
      2
    )
  )
  console.info('Signed CLI generation and failure isolation passed.')
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
