import { mkdir, open, readFile, rename, unlink, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { LocalisyncError } from './core/index.js'
import { nextCache, storageError, cacheStateSchema, cacheFiles, cacheReferences, hydrateCache } from './cache.js'
import type { CacheState, CacheUpdate, DeliveryCache } from './cache.js'
import { strictJson } from './json.js'

export class NodeCache implements DeliveryCache {
  private token: string | null = null
  private opening: Promise<void> | null = null
  private readonly root: string
  constructor(
    root: string,
    private readonly lease: string = randomUUID()
  ) {
    this.root = resolve(root)
  }
  private initialize() {
    return (this.opening ??= this.acquire().catch(error => {
      this.opening = null
      throw error
    }))
  }
  private async acquire(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 })
    const lock = join(this.root, 'writer.lock')
    const token = this.lease
    try {
      const handle = await open(lock, 'wx', 0o600)
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, token }))
        await handle.sync()
      } finally {
        await handle.close()
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw storageError()
      // Reclaim only a proven dead local process. An incomplete/ambiguous lock is never stolen.
      const owner = z.object({ pid: z.number().int().positive(), token: z.string().uuid() }).safeParse(
        await readFile(lock, 'utf8')
          .then(v => strictJson(v, 1024))
          .catch(() => null)
      )
      if (owner.success) {
        let dead = false
        try {
          process.kill(owner.data.pid, 0)
        } catch (error) {
          dead = error instanceof Error && 'code' in error && error.code === 'ESRCH'
        }
        if (dead) {
          const reaper = await open(join(this.root, 'recovery.lock'), 'wx', 0o600).catch(() => null)
          if (reaper) {
            try {
              const current = await readFile(lock, 'utf8')
              if (JSON.stringify(owner.data) === current) await unlink(lock)
            } finally {
              await reaper.close()
              await unlink(join(this.root, 'recovery.lock'))
            }
            return this.acquire()
          }
        }
      }
      throw new LocalisyncError(
        'storage',
        'This cache directory already has a writer. Use a private directory per server instance.'
      )
    }
    this.token = token
    for (const name of await readdir(this.root))
      if (/^pending-[a-f0-9-]+$/.test(name)) await unlink(join(this.root, name))
  }
  private prefix(scope: string) {
    return createHash('sha256').update(scope).digest('hex')
  }
  private path(scope: string) {
    return join(this.root, this.prefix(scope) + '.json')
  }
  private blobPath(scope: string, digest: string) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw storageError()
    return join(this.root, this.prefix(scope) + '-' + digest + '.blob')
  }
  private async readMetadata(scope: string): Promise<CacheState | null> {
    try {
      const path = this.path(scope)
      if ((await stat(path)).size > 512 * 1024 * 1024) throw storageError()
      return cacheStateSchema.parse(strictJson(await readFile(path, 'utf8'), 512 * 1024 * 1024))
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null
      throw storageError()
    }
  }
  async readFloor(scope: string) {
    await this.initialize()
    return (await this.readMetadata(scope))?.floor ?? null
  }
  async read(scope: string): Promise<CacheState | null> {
    await this.initialize()
    const metadata = await this.readMetadata(scope)
    if (!metadata) return null
    const files = cacheFiles(metadata)
    // Sequential reads bound transient buffers. Missing blobs invalidate only their generation.
    for (const [digest, body] of files)
      if (!body) {
        try {
          const path = this.blobPath(scope, digest)
          if ((await stat(path)).size > 100 * 1024 * 1024) throw storageError()
          files.set(digest, await readFile(path, 'utf8'))
        } catch {
          files.set(digest, '')
        }
      }
    return hydrateCache(metadata, files)
  }
  private async atomicFile(path: string, body: string) {
    const temporary = join(this.root, 'pending-' + randomUUID())
    const handle = await open(temporary, 'wx', 0o600)
    try {
      await handle.writeFile(body)
      await handle.sync()
      await handle.close()
      await rename(temporary, path)
    } catch {
      await handle.close().catch(() => undefined)
      await unlink(temporary).catch(() => undefined)
      throw storageError()
    }
  }
  private async syncDirectory() {
    if (process.platform === 'win32') return
    const directory = await open(this.root, 'r')
    try {
      await directory.sync()
    } finally {
      await directory.close()
    }
  }
  async write(scope: string, update: CacheUpdate) {
    await this.initialize()
    if (!update.generation) {
      const metadata = await this.readMetadata(scope)
      await this.atomicFile(this.path(scope), JSON.stringify(nextCache(metadata, update)))
      await this.syncDirectory()
      return
    }
    const current = await this.read(scope),
      next = nextCache(current, update)
    const previousFiles = current ? cacheFiles(current) : new Map<string, string>()
    const files = cacheFiles(next)
    for (const [digest, body] of files) {
      const path = this.blobPath(scope, digest)
      // Existing valid blobs are immutable; a verified replacement can repair corruption.
      if (previousFiles.get(digest) !== body || !(await stat(path).catch(() => null))) await this.atomicFile(path, body)
    }
    await this.syncDirectory()
    await this.atomicFile(this.path(scope), JSON.stringify(cacheReferences(next)))
    await this.syncDirectory()
    // Commit is durable. Cleanup failure cannot turn a successful commit into a failed write.
    const prefix = this.prefix(scope) + '-'
    await readdir(this.root)
      .then(async names => {
        for (const name of names)
          if (name.startsWith(prefix) && name.endsWith('.blob') && !files.has(name.slice(prefix.length, -5)))
            await unlink(join(this.root, name)).catch(() => undefined)
      })
      .catch(() => undefined)
  }
  async close() {
    if (!this.token) return
    const lock = join(this.root, 'writer.lock')
    const owner = z.object({ token: z.string() }).safeParse(
      await readFile(lock, 'utf8')
        .then(v => strictJson(v, 1024))
        .catch(() => null)
    )
    if (owner.success && owner.data.token === this.token) await unlink(lock)
    this.token = null
    this.opening = null
  }
}

/** Called by the owning process only after its worker has exited. */
export async function releaseWorkerLease(root: string, token: string) {
  const lock = join(resolve(root), 'writer.lock')
  const owner = z.object({ pid: z.number(), token: z.string() }).safeParse(
    await readFile(lock, 'utf8')
      .then(v => strictJson(v, 1024))
      .catch(() => null)
  )
  if (owner.success && owner.data.pid === process.pid && owner.data.token === token)
    await unlink(lock).catch(() => undefined)
}
