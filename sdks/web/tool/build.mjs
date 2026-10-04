import { runPnpm } from './process.mjs'
import { createRequire } from 'node:module'
import { mkdir, readFile, readdir, writeFile, copyFile, unlink, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join, relative } from 'node:path'

const name = process.argv[2]
if (!['web', 'cli'].includes(name)) throw new Error('Unknown package.')
const directory = fileURLToPath(new URL(`../packages/${name}/`, import.meta.url))
const require = createRequire(directory + '/package.json')
const { build } = require('esbuild')
const packageVersion = JSON.parse(await readFile(directory + '/package.json', 'utf8')).version
if (name === 'web') {
  const wire = await readFile(directory + '/src/wire.ts', 'utf8')
  const diagnostics = await readFile(directory + '/src/diagnostics.ts', 'utf8')
  if (!wire.includes(`workerVersion = '${packageVersion}'`) || !diagnostics.includes(`sdkVersion: '${packageVersion}'`))
    throw new Error('Package, worker handshake and diagnostic versions must match.')
}
await rm(directory + '/dist', { recursive: true, force: true })
runPnpm(['exec', 'tsc', '--emitDeclarationOnly'], { cwd: directory, stdio: 'inherit' })
const entries = name === 'web' ? ['index', 'core', 'dom', 'server', 'compiler', 'react', 'react-server'] : ['index']
const inputs = new Set()
const common = {
  absWorkingDir: directory,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  mainFields: ['module', 'main'],
  legalComments: 'eof',
  sourcemap: true,
  metafile: true
}
async function emit(options) {
  const result = await build({ ...common, ...options })
  for (const input of Object.keys(result.metafile.inputs)) inputs.add(resolve(directory, input))
  return result.metafile
}
// A shared module graph preserves class identity across browser, core, React and SSR entries.
const graph = await emit({
  entryPoints: entries.map(entry => `src/${entry}.ts`),
  outdir: 'dist',
  splitting: true,
  platform: 'neutral',
  external: ['node:*', 'react', 'react/*', ...(name === 'cli' ? ['localisync_sdk', 'localisync_sdk/*'] : [])]
})
if (name === 'web') {
  // Guard transitive entry dependencies, not just the top-level import list.
  function inspect(file, seen = new Set()) {
    if (seen.has(file)) return
    seen.add(file)
    for (const dependency of graph.outputs[file]?.imports ?? []) {
      if (dependency.external) {
        if (!/^react(?:\/|$)/.test(dependency.path))
          throw new Error('Unexpected browser dependency: ' + dependency.path)
      } else inspect(dependency.path, seen)
    }
  }
  for (const entry of ['index', 'core', 'dom', 'compiler', 'react', 'react-server']) inspect(`dist/${entry}.js`)
  await writeFile(
    directory + '/dist/react.js',
    "'use client';\n" + (await readFile(directory + '/dist/react.js', 'utf8'))
  )
  const reactMapPath = directory + '/dist/react.js.map'
  const reactMap = JSON.parse(await readFile(reactMapPath, 'utf8'))
  reactMap.mappings = ';' + reactMap.mappings
  await writeFile(reactMapPath, JSON.stringify(reactMap))
  for (const entry of ['worker', 'node-worker'])
    await emit({
      entryPoints: [`src/${entry}.ts`],
      outfile: `dist/${entry}.js`,
      platform: entry === 'worker' ? 'browser' : 'node'
    })
  await emit({
    entryPoints: ['src/standalone.ts'],
    outfile: 'dist/localisync.js',
    format: 'iife',
    globalName: 'Localisync',
    platform: 'browser',
    minify: true,
    sourcemap: false
  })
}
await mkdir(directory + '/licenses', { recursive: true })
const licenses = new Map()
for (const input of inputs) {
  if (!input.replaceAll('\\', '/').includes('/node_modules/')) continue
  let parent = dirname(input)
  for (;;) {
    try {
      const manifest = JSON.parse(await readFile(join(parent, 'package.json'), 'utf8'))
      if (!manifest.name) {
        parent = dirname(parent)
        continue
      }
      if (!licenses.has(manifest.name)) {
        const file = (await readdir(parent)).find(name => /^licen[sc]e(?:\.|$)/i.test(name))
        if (!file) throw new Error('Missing bundled dependency license: ' + manifest.name)
        licenses.set(
          manifest.name,
          `${manifest.name} ${manifest.version}\n\n${(await readFile(join(parent, file), 'utf8')).replace(/\r\n/g, '\n')}`
        )
      }
      break
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error
      const next = dirname(parent)
      if (next === parent) throw new Error('Could not find dependency metadata.')
      parent = next
    }
  }
}
await writeFile(
  directory + '/licenses/DEPENDENCIES.txt',
  [...licenses]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value)
    .join('\n\n----------------------------------------\n\n')
)
await copyFile(
  new URL('../../../licenses/flutter/Unicode-LICENSE.txt', import.meta.url),
  directory + '/licenses/Unicode-LICENSE.txt'
)
await writeFile(
  directory + '/NOTICE',
  'Localisync SDK is MIT licensed. Unicode CLDR 48.2.1 rules and bundled dependency notices are preserved in licenses/.\n'
)

// Keep exactly the declarations reachable from supported entries, including internal subdirectories.
const declarations = new Set()
async function keepDeclaration(file) {
  if (declarations.has(file)) return
  declarations.add(file)
  const source = await readFile(file, 'utf8')
  for (const match of source.matchAll(/(?:from\s+|import\s*\()?["'](\.{1,2}\/[^"']+)["']/g)) {
    const dependency = resolve(dirname(file), match[1].replace(/\.js$/, '.d.ts'))
    if (relative(directory + '/dist', dependency).startsWith('..')) throw new Error('Declaration escaped package.')
    await keepDeclaration(dependency)
  }
}
for (const entry of entries) await keepDeclaration(resolve(directory, 'dist', entry + '.d.ts'))
for (const file of await readdir(directory + '/dist', { recursive: true }))
  if (file.endsWith('.d.ts') && !declarations.has(resolve(directory, 'dist', file)))
    await unlink(join(directory, 'dist', file))
