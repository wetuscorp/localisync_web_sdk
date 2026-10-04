import { runPnpm } from './process.mjs'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile, mkdtemp, stat } from 'node:fs/promises'
import { resolve, join, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'

const started = performance.now()
const destination = resolve('.local/web-sdk-pack')
await mkdir(destination, { recursive: true })
const results = []
for (const name of ['web', 'cli']) {
  const cwd = resolve('sdks/web/packages/' + name)
  const output = runPnpm(['pack', '--pack-destination', destination, '--json'], { cwd, encoding: 'utf8' })
  const result = JSON.parse(output),
    archive = isAbsolute(result.filename) ? result.filename : join(destination, result.filename)
  const listing = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
  assert(listing.includes('package/LICENSE'))
  assert(!listing.split('\n').some(path => /(?:^|\/)(?:test|fixture|\.env|node_modules)(?:\/|$)/.test(path)))
  const manifest = JSON.parse(execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }))
  assert(!JSON.stringify(manifest.dependencies ?? {}).includes('workspace:'))
  assert(!JSON.stringify(manifest.dependencies ?? {}).includes('delivery-protocol'))
  if (manifest.name === 'localisync_sdk') {
    assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0)
    assert.equal(manifest.peerDependenciesMeta.react.optional, true)
    assert(!listing.includes('package/test/'))
  }
  results.push({
    name: manifest.name,
    version: manifest.version,
    archive,
    fileCount: listing.trim().split('\n').length
  })
}
// A framework-free install must not pull React or private workspace packages.
const plain = await mkdtemp(join(tmpdir(), 'localisync-web-plain-'))
await writeFile(
  join(plain, 'package.json'),
  JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      localisync_sdk: 'file:' + results.find(result => result.name === 'localisync_sdk').archive
    }
  })
)
runPnpm(['install', '--ignore-scripts', '--store-dir', resolve('.pnpm-store')], {
  cwd: plain,
  stdio: 'inherit'
})
assert.equal(await stat(join(plain, 'node_modules/react')).catch(() => null), null)
execFileSync(
  'node',
  [
    '--input-type=module',
    '-e',
    "await import('localisync_sdk'); await import('localisync_sdk/core'); await import('localisync_sdk/server'); await import('localisync_sdk/compiler')"
  ],
  { cwd: plain, stdio: 'inherit' }
)
const consumer = await mkdtemp(join(tmpdir(), 'localisync-web-consumer-'))
const archive = name => results.find(result => result.name === name).archive
await writeFile(
  join(consumer, 'package.json'),
  JSON.stringify(
    {
      private: true,
      type: 'module',
      dependencies: {
        localisync_sdk: 'file:' + archive('localisync_sdk'),
        localisync_sdk_generator: 'file:' + archive('localisync_sdk_generator'),
        react: '19.2.4',
        typescript: '5.9.3',
        '@types/react': '19.2.18'
      }
    },
    null,
    2
  )
)
runPnpm(['install', '--ignore-scripts', '--store-dir', resolve('.pnpm-store')], {
  cwd: consumer,
  stdio: 'inherit'
})
execFileSync(
  'node',
  [
    '--input-type=module',
    '-e',
    "const core=await import('localisync_sdk/core'); const sdk=await import('localisync_sdk'); if(core.LocalisyncClient !== sdk.LocalisyncClient) throw new Error('Split client identity'); await import('localisync_sdk'); await import('localisync_sdk/server'); await import('localisync_sdk/react'); await import('localisync_sdk_generator'); console.info('Clean package imports passed.')"
  ],
  { cwd: consumer, stdio: 'inherit' }
)
await writeFile(join(consumer, 'messages.json'), await readFile('sdks/web/examples/bundle-source.json'))
runPnpm(['exec', 'localisync', 'generate', 'messages.json', 'generated'], {
  cwd: consumer,
  stdio: 'inherit'
})
await writeFile(
  join(consumer, 'check.ts'),
  "import {typedTranslations} from './generated/messages.js'\nimport {createClient} from 'localisync_sdk'\nimport {createServerClient} from 'localisync_sdk/server'\nimport {compileBundle} from 'localisync_sdk/compiler'\nimport {LocalisyncProvider} from 'localisync_sdk/react'\nimport {dehydrate} from 'localisync_sdk/react/server'\nimport type {WebConfig} from 'localisync_sdk'\ndeclare const config: WebConfig\nconst translate=typedTranslations(createClient(config))\ntranslate('greeting',{name:'Ada'})\ntranslate('basket',{count:2})\n"
)
await writeFile(
  join(consumer, 'first-translation.mjs'),
  `
import assert from 'node:assert/strict';
import {createClient} from 'localisync_sdk';
import bundle from './generated/bundle.js';
const client=createClient({projectId:'11111111-1111-4111-8111-111111111111',distributionId:'22222222-2222-4222-8222-222222222222',channel:'preview',addresses:['https://one.example.test','https://two.example.test'],readKey:'test-only',trustedKeys:{test:'not-used-without-start'},appVersion:'1.0.0',locale:'en',workerUrl:'https://app.example.test/worker.js',bundle});
assert.equal(client.translate('greeting',{name:'Ada'}),'Hello Ada');
await client.dispose();
console.info('First bundled translation passed without network or Worker.');
`
)
execFileSync('node', ['first-translation.mjs'], { cwd: consumer, stdio: 'inherit' })
const checkArgs = [
  'exec',
  'tsc',
  '--noEmit',
  '--strict',
  '--target',
  'ES2022',
  '--module',
  'NodeNext',
  '--moduleResolution',
  'NodeNext',
  'check.ts'
]
runPnpm(checkArgs, { cwd: consumer, stdio: 'inherit' })
await writeFile(
  join(consumer, 'check.ts'),
  "import {typedTranslations} from './generated/messages.js'\nimport type {LocalisyncClient} from 'localisync_sdk/core'\ndeclare const client:LocalisyncClient\nconst translate=typedTranslations(client)\ntranslate('basket',{count:'wrong'})\ntranslate('unknown')\n"
)
let rejected = false
try {
  runPnpm(checkArgs, { cwd: consumer, stdio: 'pipe' })
} catch {
  rejected = true
}
assert(rejected, 'Generated contracts must reject wrong key and parameter types')
await writeFile(
  join(destination, 'results.json'),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      node: process.version,
      consumer,
      elapsedMs: performance.now() - started,
      results
    },
    null,
    2
  )
)
console.info(JSON.stringify(results, null, 2))
