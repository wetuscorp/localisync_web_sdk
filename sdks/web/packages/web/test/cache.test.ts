import { describe, it, expect } from 'vitest'
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises'
import { randomUUID, createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { NodeCache, releaseWorkerLease } from '../src/cache-node.js'
import { cacheStateSchema } from '../src/cache.js'
import { ContentView } from 'localisync_sdk/core'
import { compileBundle } from '../src/compiler.js'

const floor = { catalog: 'signed', digest: 'a', revision: 1 }
describe('exclusive cache lifecycle', () => {
  it('rejects a second writer and releases only the owning lease', async () => {
    const path = await mkdtemp(join(tmpdir(), 'localisync-cache-lock-')),
      lease = randomUUID()
    const first = new NodeCache(path, lease),
      second = new NodeCache(path)
    try {
      await first.write('scope', { floor, maxBytes: 10000 })
      await expect(second.read('scope')).rejects.toMatchObject({ code: 'storage' })
      await releaseWorkerLease(path, randomUUID())
      expect(await readFile(join(path, 'writer.lock'), 'utf8')).toContain(lease)
      await first.close()
      expect((await second.read('scope'))?.floor?.revision).toBe(1)
    } finally {
      await first.close()
      await second.close()
      await rm(path, { recursive: true, force: true })
    }
  })
  it('recovers a proven dead writer and ignores unfinished generation files', async () => {
    const path = await mkdtemp(join(tmpdir(), 'localisync-cache-recovery-'))
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'])
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject)
      child.once('exit', () => resolve())
    })
    await writeFile(join(path, 'writer.lock'), JSON.stringify({ pid: child.pid, token: randomUUID() }))
    await writeFile(join(path, 'pending-' + randomUUID()), 'incomplete')
    const cache = new NodeCache(path)
    try {
      expect(await cache.read('scope')).toBeNull()
      expect((await readdir(path)).filter(name => name.startsWith('pending-'))).toEqual([])
    } finally {
      await cache.close()
      await rm(path, { recursive: true, force: true })
    }
  })
  it('preserves committed cache when a later generation exceeds quota', async () => {
    const path = await mkdtemp(join(tmpdir(), 'localisync-cache-quota-')),
      cache = new NodeCache(path)
    try {
      await cache.write('scope', { floor, maxBytes: 1000 })
      await expect(
        cache.write('scope', {
          floor: { ...floor, revision: 2 },
          generation: { catalog: 'signed', manifest: 'manifest', locales: ['en'], files: { hash: 'x'.repeat(5000) } },
          maxBytes: 1000
        })
      ).rejects.toMatchObject({ code: 'storage' })
      expect((await cache.read('scope'))?.floor?.revision).toBe(1)
    } finally {
      await cache.close()
      await rm(path, { recursive: true, force: true })
    }
  })
  it('migrates inline generations, deduplicates blobs and recovers the prior generation after an incomplete file', async () => {
    const path = await mkdtemp(join(tmpdir(), 'localisync-cache-objects-')),
      cache = new NodeCache(path)
    const digest = (body: string) => createHash('sha256').update(body).digest('hex')
    const firstBody = '{"value":"first"}',
      secondBody = '{"value":"second"}'
    const generation = (body: string) => ({
      catalog: 'signed',
      manifest: body,
      locales: ['en'],
      files: { [digest(body)]: body }
    })
    const metadataPath = join(path, digest('scope') + '.json')
    try {
      await writeFile(
        metadataPath,
        JSON.stringify({ version: 1, floor, active: generation(firstBody), previous: null })
      )
      expect((await cache.read('scope'))?.active?.files[digest(firstBody)]).toBe(firstBody)
      await cache.write('scope', {
        floor: { ...floor, revision: 2 },
        generation: generation(secondBody),
        maxBytes: 10000
      })
      const metadata = await readFile(metadataPath, 'utf8')
      expect(cacheStateSchema.parse(JSON.parse(metadata)).active?.files[digest(secondBody)]).toBe('')
      expect((await readdir(path)).filter(name => name.endsWith('.blob'))).toHaveLength(2)
      await rm(join(path, digest('scope') + '-' + digest(secondBody) + '.blob'))
      const recovered = await cache.read('scope')
      expect(recovered?.active?.files[digest(secondBody)]).toBe('')
      expect(recovered?.previous?.files[digest(firstBody)]).toBe(firstBody)
      await cache.write('scope', {
        floor: { ...floor, revision: 2 },
        generation: generation(secondBody),
        maxBytes: 10000
      })
      expect((await cache.read('scope'))?.active?.files[digest(secondBody)]).toBe(secondBody)
    } finally {
      await cache.close()
      await rm(path, { recursive: true, force: true })
    }
  })
  it('keeps captured messages immutable including nested ICU programs', () => {
    const bundle = compileBundle({
      version: 1,
      languages: [{ locale: 'en', fallback: null }],
      locales: [
        {
          locale: 'en',
          entries: [
            { key: 'hello', format: 'icu', parameters: [{ name: 'name', type: 'text' }], value: 'Hello {name}' }
          ]
        }
      ]
    })
    const view = new ContentView(bundle, 'en', 'bundle')
    const entry = bundle.locales[0]?.entries[0]
    expect(Object.isFrozen(entry?.program)).toBe(true)
    expect(Object.isFrozen(entry?.parameters)).toBe(true)
    expect(() => Object.defineProperty(entry, 'value', { value: 'changed' })).toThrow()
    expect(view.resolve('hello', { name: 'Ada' })?.text).toBe('Hello Ada')
  })
})
