import { ContentView, TranslationSnapshot } from './content.js'
import { LocalisyncError } from './types.js'
import type {
  DiagnosticStage,
  Candidate,
  ClientOptions,
  ClientStatus,
  Parameters,
  PreparedBundle,
  TranslateOptions,
  UpdateDriver
} from './types.js'

export class LocalisyncClient {
  private snapshot: TranslationSnapshot
  private status: ClientStatus = Object.freeze({ phase: 'idle', revision: null, persisted: false, error: null })
  private readonly contentListeners = new Set<() => void>()
  private readonly statusListeners = new Set<() => void>()
  private started: Promise<void> | null = null
  private refreshing: Promise<void> | null = null
  private pending: Candidate | null = null
  private disposed = false
  private disposal: Promise<void> | null = null
  private intent = 0
  private remoteBundle: PreparedBundle | null = null
  private readonly captures = new Map<string, TranslationSnapshot>()
  constructor(
    private readonly options: ClientOptions,
    private readonly driver: UpdateDriver
  ) {
    if (options.bundle.version !== 1) throw new LocalisyncError('configuration', 'Unsupported bundled content version.')
    this.snapshot = new TranslationSnapshot(
      options.locale,
      null,
      new ContentView(options.bundle, options.locale, 'bundle')
    )
  }
  readonly getSnapshot = () => this.snapshot
  readonly getStatus = () => this.status
  readonly subscribe = (listener: () => void) => {
    this.contentListeners.add(listener)
    return () => {
      this.contentListeners.delete(listener)
    }
  }
  readonly subscribeStatus = (listener: () => void) => {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }
  translate(key: string, args?: Parameters, options?: TranslateOptions) {
    return this.resolve(key, args, options).text
  }
  resolve(key: string, args?: Parameters, options?: TranslateOptions) {
    try {
      return this.snapshot.resolve(key, args, options)
    } catch (error) {
      if (!(error instanceof LocalisyncError)) throw error
      this.diagnostic(error, 'translate')
      return {
        text: options?.defaultText ?? key,
        locale: null,
        source: options?.defaultText === undefined ? ('key' as const) : ('default' as const),
        fallback: false,
        releaseId: null
      }
    }
  }
  start(): Promise<void> {
    this.assertOpen()
    return (this.started ??= this.boot())
  }
  private async boot() {
    this.report('starting')
    const intent = this.intent
    try {
      const cached = await this.driver.restore(this.snapshot.locale)
      if (cached && intent === this.intent) await this.activate(cached, intent)
    } catch (error) {
      this.failure(error, 'cache')
    }
    if (this.disposed) return
    if (this.options.checkOnStart !== false) await this.refresh()
    else if (this.status.phase !== 'error') this.report('ready')
  }
  refresh(): Promise<void> {
    this.assertOpen()
    return (this.refreshing ??= this.check().finally(() => {
      this.refreshing = null
    }))
  }
  private async check() {
    const intent = this.intent
    this.report('checking')
    try {
      const candidate = await this.driver.refresh(this.snapshot.locale)
      if (this.disposed || intent !== this.intent) return
      if (!candidate) {
        this.report('ready')
        return
      }
      if (this.options.activation === 'manual') {
        this.pending = candidate
        this.report('pending')
        return
      }
      await this.activate(candidate, intent)
    } catch (error) {
      this.failure(error)
    }
  }
  async activatePending() {
    this.assertOpen()
    const candidate = this.pending
    if (!candidate) return
    try {
      await this.activate(candidate)
      if (this.pending === candidate) this.pending = null
    } catch (error) {
      this.failure(error, 'activate')
    }
  }
  async setLocale(locale: string) {
    this.assertOpen()
    if (locale === this.snapshot.locale) return
    const intent = ++this.intent
    try {
      if (this.remoteBundle?.releaseId) {
        const candidate = await this.driver.locale(locale, this.remoteBundle.releaseId)
        if (intent === this.intent && !this.disposed) await this.activate(candidate, intent)
      } else {
        const bundled = new ContentView(this.options.bundle, locale, 'bundle')
        this.snapshot = new TranslationSnapshot(locale, null, bundled)
        this.emit(this.contentListeners)
      }
      this.pending = null
    } catch (error) {
      if (intent === this.intent) this.failure(error, 'locale')
    }
  }
  private async activate(candidate: Candidate, intent = this.intent) {
    if (this.disposed || intent !== this.intent) return
    const indexStarted = performance.now()
    const remote = new ContentView(candidate.bundle, candidate.locale, 'remote')
    const bundled = this.options.bundle.languages.some(l => l.locale === candidate.locale)
      ? new ContentView(this.options.bundle, candidate.locale, 'bundle')
      : null
    const indexMs = performance.now() - indexStarted,
      commitStarted = performance.now()
    const saved = await this.driver.commit(candidate.id)
    if (this.disposed || intent !== this.intent) return
    this.remoteBundle = candidate.bundle
    this.captures.clear()
    this.snapshot = new TranslationSnapshot(candidate.locale, remote, bundled)
    this.status = Object.freeze({
      phase: saved.error ? 'error' : 'ready',
      ...(candidate.timings
        ? { timings: Object.freeze({ ...candidate.timings, indexMs, commitMs: performance.now() - commitStarted }) }
        : {}),
      revision: candidate.revision,
      persisted: saved.persisted,
      error: saved.error ?? null
    })
    this.emit(this.contentListeners)
    this.emit(this.statusListeners)
    if (saved.error) this.diagnostic(saved.error, 'cache')
  }
  /** Captures one loaded locale without mutating client locale or performing I/O. */
  capture(locale = this.snapshot.locale): TranslationSnapshot {
    this.assertOpen()
    if (locale === this.snapshot.locale) return this.snapshot
    const cached = this.captures.get(locale)
    if (cached) return cached
    const remote = this.remoteBundle?.locales.some(l => l.locale === locale)
      ? new ContentView(this.remoteBundle, locale, 'remote')
      : null
    const bundled = this.options.bundle.languages.some(l => l.locale === locale)
      ? new ContentView(this.options.bundle, locale, 'bundle')
      : null
    if (!remote && !bundled)
      throw new LocalisyncError('locale', 'The locale is not prepared for synchronous rendering.')
    const snapshot = new TranslationSnapshot(locale, remote, bundled)
    this.captures.set(locale, snapshot)
    return snapshot
  }
  dispose(): Promise<void> {
    if (this.disposal) return this.disposal
    this.disposed = true
    ++this.intent
    this.pending = null
    this.disposal = Promise.resolve(this.driver.dispose())
    this.report('disposed')
    this.contentListeners.clear()
    this.statusListeners.clear()
    return this.disposal
  }
  private assertOpen() {
    if (this.disposed) throw new LocalisyncError('disposed', 'This Localisync client has been disposed.')
  }
  private report(phase: ClientStatus['phase']) {
    if (this.disposed && phase !== 'disposed') return
    this.status = Object.freeze({ ...this.status, phase, error: null })
    this.emit(this.statusListeners)
  }
  private diagnostic(error: LocalisyncError, stage: DiagnosticStage) {
    try {
      this.options.onDiagnostic?.(error, stage)
    } catch {
      /* Developer callbacks cannot break usable content. */
    }
  }
  private failure(error: unknown, stage: DiagnosticStage = 'refresh') {
    if (this.disposed) return
    const failure =
      error instanceof LocalisyncError
        ? error
        : new LocalisyncError('verification', 'The update could not be verified.')
    this.status = Object.freeze({ ...this.status, phase: 'error', error: failure })
    this.emit(this.statusListeners)
    this.diagnostic(failure, stage)
  }
  private emit(listeners: Set<() => void>) {
    for (const listener of listeners) listener()
  }
}
