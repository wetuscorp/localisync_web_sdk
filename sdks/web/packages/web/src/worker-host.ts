import { LocalisyncError } from './core/index.js'
import type { Candidate, PreparedEntry } from './core/index.js'
import { commandSchema, workerVersion } from './wire.js'
import type { Response } from './wire.js'
import { DeliveryEngine } from './delivery.js'
import type { DeliveryCache } from './cache.js'

export function serveWorker(
  post: (value: Response, transfers?: ArrayBuffer[]) => void,
  cache: (directory?: string) => DeliveryCache
) {
  let engine: DeliveryEngine | null = null,
    queue = Promise.resolve()
  let closed = false
  const acknowledgments = new Map<number, () => void>()
  const chunk = async (id: number, locale: string, entries: PreparedEntry[]) => {
    if (closed) throw new LocalisyncError('cancelled', 'Prepared content transfer was cancelled.')
    const data = new TextEncoder().encode(JSON.stringify({ locale, entries }))
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        acknowledgments.delete(id)
        reject(new LocalisyncError('worker', 'The rendering thread did not acknowledge prepared content.'))
      }, 30000)
      acknowledgments.set(id, () => {
        clearTimeout(timer)
        resolve()
      })
      post({ type: 'chunk', id, buffer: data.buffer }, [data.buffer])
    })
  }
  const send = async (id: number, candidate: Candidate | null) => {
    if (!candidate) {
      post({ type: 'end', id, empty: true })
      return
    }
    post({
      type: 'begin',
      ...(candidate.timings ? { timings: candidate.timings } : {}),
      id,
      candidateId: candidate.id,
      locale: candidate.locale,
      revision: candidate.revision,
      releaseId: candidate.bundle.releaseId,
      languages: [...candidate.bundle.languages]
    })
    for (const file of candidate.bundle.locales) {
      let batch: PreparedEntry[] = [],
        bytes = 0
      for (const entry of file.entries) {
        const size = new TextEncoder().encode(JSON.stringify(entry)).byteLength
        if (batch.length && bytes + size > 128 * 1024) {
          await chunk(id, file.locale, batch)
          batch = []
          bytes = 0
        }
        batch.push(entry)
        bytes += size
      }
      if (batch.length || file.entries.length === 0) await chunk(id, file.locale, batch)
    }
    post({ type: 'end', id, empty: false })
  }
  return (value: unknown) => {
    const parsed = commandSchema.safeParse(value)
    if (!parsed.success) {
      post({ type: 'error', id: 0, code: 'worker', message: 'The worker protocol or version is incompatible.' })
      return
    }
    const command = parsed.data
    if (command.type === 'ack') {
      acknowledgments.get(command.id)?.()
      acknowledgments.delete(command.id)
      return
    }
    if (command.type === 'dispose') {
      closed = true
      engine?.cancel()
      for (const done of acknowledgments.values()) done()
      acknowledgments.clear()
      void queue.finally(async () => {
        await engine?.dispose()
        post({ type: 'closed', id: command.id })
      })
      return
    }
    queue = queue
      .then(async () => {
        if (command.type === 'init') {
          if (engine) throw new LocalisyncError('worker', 'The worker is already initialized.')
          engine = new DeliveryEngine(command.config, cache(command.directory), command.bundle)
          post({ type: 'ready', id: command.id, version: workerVersion })
          return
        }
        if (!engine) throw new LocalisyncError('worker', 'The worker is not initialized.')
        if (command.type === 'contracts') {
          engine.registerContracts(command.entries)
          post({ type: 'ready', id: command.id, version: workerVersion })
          return
        }
        switch (command.type) {
          case 'restore':
            await send(command.id, await engine.restore(command.locale))
            break
          case 'refresh':
            await send(command.id, await engine.refresh(command.locale))
            break
          case 'locale':
            await send(command.id, await engine.locale(command.locale, command.releaseId))
            break
          case 'commit': {
            const result = await engine.commit(command.candidateId)
            post({
              type: 'committed',
              id: command.id,
              persisted: result.persisted,
              ...(result.error ? { error: { code: result.error.code, message: result.error.message } } : {})
            })
            break
          }
        }
      })
      .catch(error => {
        const failure =
          error instanceof LocalisyncError
            ? error
            : new LocalisyncError('verification', 'The update could not be prepared.')
        post({ type: 'error', id: command.id, code: failure.code, message: failure.message })
      })
  }
}
