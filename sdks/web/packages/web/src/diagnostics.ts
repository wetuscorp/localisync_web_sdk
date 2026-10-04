import { LocalisyncError } from './core/index.js'
import type { LocalisyncClient, UpdateDriver } from './core/index.js'
import type { FailureCode, DiagnosticStage } from './core/index.js'
export interface DiagnosticsConfig {
  readonly endpoint: string
  readonly key: string
}
type Item = { code: FailureCode; stage: DiagnosticStage; count: number; time: number }
const allowed = new Set([
  'configuration',
  'network',
  'authorization',
  'verification',
  'compatibility',
  'storage',
  'worker',
  'arguments',
  'locale'
])
/** Memory only. A failed report is never fed back into client diagnostics. */
export class DiagnosticsReporter {
  private readonly items = new Map<string, Item>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly abort = new AbortController()
  private closed = false
  private running = false
  private context: (() => { releaseId: string | null; revision: number | null }) | undefined
  constructor(
    private readonly config: DiagnosticsConfig,
    private readonly appVersion: string,
    development = false
  ) {
    const url = new URL(config.endpoint)
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/telemetry/v1/sdk-events' ||
      !/^lsd_[\w-]{43}$/.test(config.key) ||
      !(
        url.protocol === 'https:' ||
        (development && url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      )
    )
      throw new LocalisyncError('configuration', 'Use a diagnostic endpoint and a separate write-only diagnostic key.')
  }
  attach(client: LocalisyncClient) {
    this.context = () => ({
      releaseId: client.getSnapshot().remote?.releaseId ?? null,
      revision: client.getStatus().revision
    })
  }
  record(code: FailureCode, stage: DiagnosticStage) {
    if (this.closed || !allowed.has(code)) return
    const now = Date.now(),
      identity = code + ':' + stage,
      existing = this.items.get(identity)
    if (existing && now - existing.time < 900000) existing.count = Math.min(1000000, existing.count + 1)
    else {
      if (this.items.size >= 100) return
      // Each in-memory entry is bounded below 256 bytes; 100 entries are below 128 KiB.
      this.items.set(identity, { code, stage, count: 1, time: now })
    }
    this.schedule()
  }
  private schedule() {
    if (!this.closed && !this.running && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined
        void this.flush()
      }, 1000)
    }
  }
  private async flush() {
    if (this.closed || this.running) return
    this.running = true
    try {
      const now = Date.now(),
        events: object[] = [],
        context = this.context?.()
      for (const [id, item] of this.items) {
        this.items.delete(id)
        if (now - item.time < 900000)
          events.push({
            id: crypto.randomUUID(),
            observedAt: new Date(item.time).toISOString(),
            sdk: 'web',
            sdkVersion: '0.1.0',
            appVersion: this.appVersion,
            code: item.code,
            stage: item.stage,
            count: item.count,
            ...(context?.releaseId ? { releaseId: context.releaseId } : {}),
            ...(context?.revision !== null && context?.revision !== undefined ? { revision: context.revision } : {})
          })
        if (events.length === 20) break
      }
      if (!events.length) return
      const body = JSON.stringify({ version: 1, events })
      if (new TextEncoder().encode(body).length > 32768) return
      for (let attempt = 0; attempt < 2 && !this.closed; attempt++) {
        try {
          const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.config.key },
            body,
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(5000)])
          })
          await response.body?.cancel()
          if (response.ok || response.status < 500) break
        } catch {
          if (this.closed) break
        }
        if (attempt === 0)
          await new Promise<void>(resolve => {
            const timer = setTimeout(done, 500)
            const signal = this.abort.signal
            function done() {
              clearTimeout(timer)
              signal.removeEventListener('abort', done)
              resolve()
            }
            signal.addEventListener('abort', done, { once: true })
          })
      }
    } catch {
      // Diagnostics are best-effort and never produce a second diagnostic.
    } finally {
      this.running = false
      if (this.items.size) this.schedule()
    }
  }
  dispose() {
    this.closed = true
    this.abort.abort()
    if (this.timer) clearTimeout(this.timer)
    this.items.clear()
    this.context = undefined
  }
}
export function diagnosticDriver(driver: UpdateDriver, reporter: DiagnosticsReporter): UpdateDriver {
  return {
    restore: locale => driver.restore(locale),
    refresh: locale => driver.refresh(locale),
    locale: (locale, id) => driver.locale(locale, id),
    commit: id => driver.commit(id),
    dispose: () => {
      reporter.dispose()
      return driver.dispose()
    }
  }
}
