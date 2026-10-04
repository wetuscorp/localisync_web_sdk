import { LocalisyncError, freezePrepared } from './core/index.js'
import type { Candidate, PreparedBundle, PreparedEntry, UpdateDriver } from './core/index.js'
import { workerVersion, responseSchema, chunkSchema } from './wire.js'
import type { Command, Response } from './wire.js'
import type { RuntimeConfig } from './config.js'

export interface WorkerEndpoint {
  post(value: Command): void
  listen(receive: (value: unknown) => void, error: () => void): void
  terminate(): void | Promise<void>
}
interface Pending {
  resolve: (value: Candidate | null | { persisted: boolean; error?: LocalisyncError }) => void
  reject: (error: LocalisyncError) => void
  timer: ReturnType<typeof setTimeout>
  transferStarted?: number
  header?: Extract<Response, { type: 'begin' }>
  locales: Map<string, PreparedEntry[]>
}
export class WorkerDriver implements UpdateDriver {
  private endpoint: WorkerEndpoint | null = null
  private sequence = 0
  private ready: Promise<void> | null = null
  private readonly pending = new Map<number, Pending>()
  private closed = false
  private disposal: Promise<void> | null = null
  private onClosed: (() => void) | null = null
  constructor(
    private readonly factory: () => WorkerEndpoint,
    private readonly config: RuntimeConfig,
    private readonly bundle: PreparedBundle,
    private readonly directory?: string
  ) {}
  private initialize(): Promise<void> {
    if (this.ready) return this.ready
    const attempt = (async () => {
      if (this.closed) throw new LocalisyncError('disposed', 'The update worker is closed.')
      let endpoint: WorkerEndpoint
      try {
        endpoint = this.factory()
      } catch {
        throw new LocalisyncError('worker', 'The update worker could not start. Check worker URL and CSP.')
      }
      this.endpoint = endpoint
      endpoint.listen(
        value => {
          if (this.endpoint === endpoint) void this.receive(value)
        },
        () => {
          if (this.endpoint === endpoint)
            this.reset(new LocalisyncError('worker', 'The update worker stopped unexpectedly.'))
        }
      )
      await this.request({
        type: 'init',
        id: ++this.sequence,
        version: workerVersion,
        config: this.config,
        bundle: { version: 1, releaseId: null, languages: [], locales: [] },
        ...(this.directory ? { directory: this.directory } : {})
      })
      // Only contracts cross into the worker. Bundled values/ASTs stay on the rendering side.
      const seen = new Set<string>()
      let entries: PreparedEntry[] = []
      for (const file of this.bundle.locales)
        for (const entry of file.entries) {
          if (seen.has(entry.key)) continue
          seen.add(entry.key)
          entries.push({ ...entry, value: null, program: null })
          if (entries.length === 64) {
            await this.request({ type: 'contracts', id: ++this.sequence, entries })
            entries = []
          }
        }
      if (entries.length) await this.request({ type: 'contracts', id: ++this.sequence, entries })
    })()
    this.ready = attempt
    void attempt.catch(() => {
      if (this.ready === attempt) this.ready = null
    })
    return attempt
  }
  private request(command: Command) {
    return new Promise<Candidate | null | { persisted: boolean; error?: LocalisyncError }>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.reset(new LocalisyncError('worker', 'The update worker exceeded its operation deadline.'))
      }, this.config.refreshTimeoutMs + 30000)
      this.pending.set(command.id, { resolve, reject, timer, locales: new Map() })
      try {
        this.endpoint?.post(command)
      } catch {
        this.reset(new LocalisyncError('worker', 'The update worker could not receive its configuration.'))
      }
    })
  }
  private async receive(value: unknown) {
    const parsed = responseSchema.safeParse(value)
    if (!parsed.success) {
      this.reset(new LocalisyncError('worker', 'The worker returned an invalid message.'))
      return
    }
    const response = parsed.data
    if (response.type === 'closed') {
      this.onClosed?.()
      return
    }
    if (response.type === 'error' && response.id === 0) {
      this.reset(new LocalisyncError(response.code, response.message))
      return
    }
    const pending = this.pending.get(response.id)
    if (!pending) return
    if (response.type === 'begin') {
      pending.header = response
      pending.transferStarted = performance.now()
      return
    }
    if (response.type === 'chunk') {
      try {
        if (response.buffer.byteLength > 256 * 1024) throw new Error('Chunk limit')
        const data = chunkSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(response.buffer)))
        const entries = pending.locales.get(data.locale) ?? []
        entries.push(...freezePrepared(data.entries))
        pending.locales.set(data.locale, entries)
        // Backpressure permits the host to render between bounded preparation chunks.
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        this.endpoint?.post({ type: 'ack', id: response.id })
      } catch {
        this.reset(new LocalisyncError('worker', 'Prepared content failed the worker transfer contract.'))
      }
      return
    }
    clearTimeout(pending.timer)
    this.pending.delete(response.id)
    if (response.type === 'error') pending.reject(new LocalisyncError(response.code, response.message))
    else if (response.type === 'committed')
      pending.resolve({
        persisted: response.persisted,
        ...(response.error ? { error: new LocalisyncError(response.error.code, response.error.message) } : {})
      })
    else if (response.type === 'ready' || response.empty) pending.resolve(null)
    else {
      const h = pending.header
      if (!h) {
        pending.reject(new LocalisyncError('worker', 'Prepared content is incomplete.'))
        return
      }
      pending.resolve({
        id: h.candidateId,
        ...(h.timings
          ? {
              timings: { ...h.timings, transferMs: performance.now() - (pending.transferStarted ?? performance.now()) }
            }
          : {}),
        locale: h.locale,
        revision: h.revision,
        bundle: {
          version: 1,
          releaseId: h.releaseId,
          languages: h.languages,
          locales: Array.from(pending.locales, ([locale, entries]) => ({ locale, entries }))
        }
      })
    }
  }
  private async load(type: 'restore' | 'refresh' | 'locale', locale: string, releaseId?: string) {
    await this.initialize()
    const result = await this.request(
      type === 'locale'
        ? { type, locale, releaseId: releaseId ?? '', id: ++this.sequence }
        : { type, locale, id: ++this.sequence }
    )
    if (result && !('bundle' in result)) throw new LocalisyncError('worker', 'Unexpected preparation response.')
    return result
  }
  restore(locale: string) {
    return this.load('restore', locale)
  }
  refresh(locale: string) {
    return this.load('refresh', locale)
  }
  async locale(locale: string, releaseId: string) {
    const result = await this.load('locale', locale, releaseId)
    if (!result) throw new LocalisyncError('locale', 'Locale preparation returned no content.')
    return result
  }
  async commit(candidateId: string) {
    await this.initialize()
    const result = await this.request({ type: 'commit', id: ++this.sequence, candidateId })
    if (!result || !('persisted' in result)) throw new LocalisyncError('worker', 'Unexpected activation response.')
    return result
  }
  private failAll(error: LocalisyncError) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    this.pending.clear()
  }
  private reset(error: LocalisyncError) {
    this.failAll(error)
    const endpoint = this.endpoint
    this.endpoint = null
    this.ready = null
    void endpoint?.terminate()
  }
  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    this.closed = true
    const endpoint = this.endpoint
    this.failAll(new LocalisyncError('disposed', 'The update worker was disposed.'))
    this.disposal = (async () => {
      if (!endpoint) return
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 3000)
        this.onClosed = () => {
          clearTimeout(timer)
          resolve()
        }
        try {
          endpoint.post({ type: 'dispose', id: ++this.sequence })
        } catch {
          clearTimeout(timer)
          resolve()
        }
      })
      this.onClosed = null
      await endpoint.terminate()
      this.endpoint = null
    })()
    return this.disposal
  }
}
