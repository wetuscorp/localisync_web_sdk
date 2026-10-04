import { runPnpm } from './process.mjs'
import { createRequire } from 'node:module'
import { readFile, writeFile, mkdir, cp, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { compileBundle } from '../packages/web/dist/compiler.js'

const name = process.argv[2]
if (!['script', 'npm', 'react', 'next'].includes(name)) throw new Error('Unknown example.')
const directory = fileURLToPath(new URL(`../examples/${name}/`, import.meta.url))
const require = createRequire(new URL('../packages/web/package.json', import.meta.url))
const bundle = compileBundle(
  JSON.parse(await readFile(new URL('../examples/bundle-source.json', import.meta.url), 'utf8'))
)
await mkdir(directory + 'generated', { recursive: true })
await writeFile(directory + 'generated/bundle.json', JSON.stringify(bundle))
await writeFile(
  directory + 'generated/bundle.ts',
  "import type { PreparedBundle } from 'localisync_sdk/core'\nconst bundle: PreparedBundle = " +
    JSON.stringify(bundle) +
    '\nexport default bundle\n'
)
await mkdir(directory + 'public', { recursive: true })
await writeFile(directory + 'public/bundle.json', JSON.stringify(bundle))
for (const asset of ['worker.js', 'localisync.js'])
  await copyFile(new URL('../packages/web/dist/' + asset, import.meta.url), directory + 'public/' + asset)
await copyFile(new URL('../../../assets/brand/symbol.svg', import.meta.url), directory + 'public/symbol.svg')
if (name === 'next') {
  runPnpm(['exec', 'next', 'build', '--webpack'], { cwd: directory, stdio: 'inherit' })
} else {
  await mkdir(directory + 'dist', { recursive: true })
  await cp(directory + 'public', directory + 'dist', { recursive: true })
  await copyFile(directory + 'index.html', directory + 'dist/index.html')
  if (name === 'script') await copyFile(directory + 'app.js', directory + 'dist/app.js')
  else
    await require('esbuild').build({
      absWorkingDir: directory,
      entryPoints: [name === 'react' ? 'app.tsx' : 'app.ts'],
      outfile: 'dist/app.js',
      platform: 'browser',
      bundle: true,
      format: 'esm',
      target: 'es2022',
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"' }
    })
}
