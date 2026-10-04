import {
  catalogSchema,
  releaseManifestSchema,
  localeFileSchema,
  selectPublication,
  limits
} from '@localisync/delivery-protocol/runtime'
import type { Catalog, ReleaseManifest } from '@localisync/delivery-protocol/runtime'
import { LocalisyncError } from './core/index.js'
import type { Candidate, PreparedBundle, PreparedEntry } from './core/index.js'
import type { RuntimeConfig } from './config.js'
import { cacheScope } from './config.js'
import type { DeliveryCache, Floor, RawGeneration } from './cache.js'
import { storageError } from './cache.js'
import { Verifier, decode, digest } from './verification.js'
import { strictJson } from './json.js'
import { compileEntry, sameContract } from './compiler.js'

const encoder = new TextEncoder()
export class DeliveryEngine {
  private timings = { downloadMs: 0, verificationMs: 0, preparationMs: 0, transferMs: 0, indexMs: 0, commitMs: 0 }
  private readonly verifier: Verifier
  private readonly scope: string
  private floor: Floor | null = null
  private active: RawGeneration | null = null
  private readonly candidates = new Map<string, { raw: RawGeneration; candidate: Candidate; floor: Floor }>()
  private readonly abort = new AbortController()
  private readonly contracts: Map<string, PreparedEntry>
  private lastStorageError: LocalisyncError | undefined
  constructor(
    private readonly config: RuntimeConfig,
    private readonly cache: DeliveryCache,
    bundle: PreparedBundle
  ) {
    this.verifier = new Verifier(config.trustedKeys)
    this.scope = cacheScope(config)
    this.contracts = new Map(bundle.locales.flatMap(file => file.entries.map(entry => [entry.key, entry] as const)))
  }
  registerContracts(entries: readonly PreparedEntry[]) {
    for (const entry of entries) {
      const previous = this.contracts.get(entry.key)
      if (previous && !sameContract(previous, entry))
        throw new LocalisyncError('configuration', 'Bundled key contracts disagree.')
      this.contracts.set(entry.key, entry)
    }
    if (this.contracts.size > limits.keys) throw new LocalisyncError('configuration', 'Too many bundled key contracts.')
  }
  private base() {
    return `/delivery/v1/distributions/${this.config.distributionId}/channels/${this.config.channel}`
  }
  private async catalog(source: string, compare = true): Promise<{ catalog: Catalog; floor: Floor }> {
    const verifyStarted = performance.now()
    const catalog = await this.verifier.verify(source, catalogSchema, limits.catalog)
    this.timings.verificationMs += performance.now() - verifyStarted
    const hash = await digest(encoder.encode(source))
    if (
      catalog.projectId !== this.config.projectId ||
      catalog.distributionId !== this.config.distributionId ||
      catalog.channel !== this.config.channel
    )
      throw new LocalisyncError('verification', 'The catalog belongs to another delivery scope.')
    if (
      compare &&
      this.floor &&
      (catalog.revision < this.floor.revision ||
        (catalog.revision === this.floor.revision && hash !== this.floor.digest))
    )
      throw new LocalisyncError('verification', 'The catalog is stale or conflicts with a verified revision.')
    return { catalog, floor: { catalog: source, revision: catalog.revision, digest: hash } }
  }
  private async fetchValid<T>(
    path: string,
    max: number,
    validate: (text: string, bytes: Uint8Array) => Promise<T>,
    signal: AbortSignal,
    cached?: Floor
  ): Promise<T> {
    let failure = new LocalisyncError('network', 'No distribution node supplied a valid response.')
    for (let round = 0; round < 2; round++) {
      for (const address of this.config.addresses) {
        if (signal.aborted) throw new LocalisyncError('cancelled', 'The update was cancelled or timed out.')
        const timeout = AbortSignal.timeout(this.config.requestTimeoutMs)
        try {
          const headers: Record<string, string> = { Authorization: 'Bearer ' + this.config.readKey }
          if (cached) headers['If-None-Match'] = '"' + cached.digest + '"'
          const downloadStarted = performance.now()
          const response = await fetch(new URL(path, address), {
            headers,
            credentials: 'omit',
            redirect: 'error',
            cache: 'no-store',
            signal: AbortSignal.any([signal, timeout])
          })
          if (response.status === 304 && cached) return await validate(cached.catalog, encoder.encode(cached.catalog))
          if (!response.ok || !response.body) {
            await response.body?.cancel()
            throw new LocalisyncError(
              response.status === 401 || response.status === 403 ? 'authorization' : 'network',
              'The distribution request was rejected.'
            )
          }
          const declared = response.headers.get('Content-Length')
          if (declared && Number(declared) > max) {
            await response.body.cancel()
            throw new LocalisyncError('verification', 'The response exceeds the size limit.')
          }
          const reader = response.body.getReader(),
            chunks: Uint8Array[] = []
          let size = 0
          try {
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              size += value.byteLength
              if (size > max) throw new LocalisyncError('verification', 'The response exceeds the size limit.')
              chunks.push(value)
            }
          } finally {
            await reader.cancel().catch(() => undefined)
          }
          const bytes = new Uint8Array(size)
          let offset = 0
          for (const chunk of chunks) {
            bytes.set(chunk, offset)
            offset += chunk.byteLength
          }
          this.timings.downloadMs += performance.now() - downloadStarted
          return await validate(decode(bytes), bytes)
        } catch (error) {
          failure =
            error instanceof LocalisyncError
              ? error
              : new LocalisyncError('network', 'The distribution request failed.')
        }
      }
      if (failure.code !== 'network') break
      if (round === 0)
        await new Promise<void>((resolve, reject) => {
          const finish = () => {
            signal.removeEventListener('abort', cancel)
            resolve()
          }
          const timer = setTimeout(finish, 250 + Math.random() * 250)
          const cancel = () => {
            clearTimeout(timer)
            reject(new LocalisyncError('cancelled', 'The update was cancelled.'))
          }
          signal.addEventListener('abort', cancel, { once: true })
        })
    }
    throw failure
  }
  private signal() {
    return AbortSignal.any([this.abort.signal, AbortSignal.timeout(this.config.refreshTimeoutMs)])
  }
  private async persist(floor: Floor, generation?: RawGeneration) {
    try {
      await this.cache.write(this.scope, {
        floor,
        ...(generation ? { generation } : {}),
        maxBytes: this.config.cacheMaxBytes
      })
      this.lastStorageError = undefined
      return true
    } catch (error) {
      if (error instanceof LocalisyncError && error.code === 'verification') throw error
      this.lastStorageError = storageError()
      return false
    }
  }
  async restore(locale: string): Promise<Candidate | null> {
    this.resetTimings()
    let stored
    try {
      stored = await this.cache.read(this.scope)
    } catch {
      this.lastStorageError = storageError()
      throw this.lastStorageError
    }
    if (!stored) return null
    if (stored.floor) {
      const checked = await this.catalog(stored.floor.catalog)
      if (checked.floor.revision !== stored.floor.revision || checked.floor.digest !== stored.floor.digest)
        throw new LocalisyncError('verification', 'The cached revision record is corrupt.')
      this.floor = checked.floor
    }
    for (const raw of [stored.active, stored.previous])
      if (raw) {
        try {
          return await this.prepare(raw, locale)
        } catch {
          /* A verified previous generation may recover a damaged active generation. */
        }
      }
    if (stored.active || stored.previous)
      throw new LocalisyncError(
        'verification',
        'No cached generation is valid for the selected locale and application version.'
      )
    return null
  }
  async refresh(locale: string): Promise<Candidate | null> {
    this.resetTimings()
    const signal = this.signal()
    // Observe another tab's signed floor before issuing a conditional network request.
    try {
      const floor = this.cache.readFloor
        ? await this.cache.readFloor(this.scope)
        : (await this.cache.read(this.scope))?.floor
      if (floor) {
        const observed = await this.catalog(floor.catalog, false)
        if (!this.floor || observed.floor.revision > this.floor.revision) this.floor = observed.floor
        else if (observed.floor.revision === this.floor.revision && observed.floor.digest !== this.floor.digest)
          throw new LocalisyncError('verification', 'Cached catalogs conflict at the same revision.')
      }
    } catch (error) {
      if (error instanceof LocalisyncError && error.code === 'verification') throw error
      this.lastStorageError = storageError()
    }
    const checked = await this.fetchValid(
      this.base() + '/manifest',
      Math.ceil((limits.catalog * 4) / 3) + 4096,
      text => this.catalog(text),
      signal,
      this.floor ?? undefined
    )
    this.floor = checked.floor
    await this.persist(checked.floor)
    const publication = selectPublication(checked.catalog, this.config.appVersion)
    if (!publication)
      throw new LocalisyncError('compatibility', 'No published release supports this application version.')
    const base = this.base() + '/releases/' + publication.releaseId
    const source = await this.fetchValid(
      base + '/manifest',
      limits.bytes,
      async (text, bytes) => {
        if ((await digest(bytes)) !== publication.manifestDigest)
          throw new LocalisyncError('verification', 'The release manifest digest does not match the catalog.')
        await this.verifyManifest(text, checked.catalog)
        return text
      },
      signal
    )
    const raw: RawGeneration = {
      catalog: checked.floor.catalog,
      manifest: source,
      locales: [locale, ...this.config.preparedLocales],
      files: this.active?.manifest === source ? this.active.files : {}
    }
    return this.obtain(raw, locale, signal)
  }
  private async verifyManifest(source: string, catalog: Catalog): Promise<ReleaseManifest> {
    const publication = selectPublication(catalog, this.config.appVersion)
    if (!publication || (await digest(encoder.encode(source))) !== publication.manifestDigest)
      throw new LocalisyncError('compatibility', 'This generation is not compatible with the application.')
    const verifyStarted = performance.now()
    const manifest = await this.verifier.verify(source, releaseManifestSchema, limits.bytes)
    this.timings.verificationMs += performance.now() - verifyStarted
    if (
      manifest.projectId !== this.config.projectId ||
      manifest.releaseId !== publication.releaseId ||
      manifest.compatibility.min !== publication.compatibility.min ||
      manifest.compatibility.max !== publication.compatibility.max
    )
      throw new LocalisyncError('verification', 'Release manifest scope does not match its publication.')
    if (manifest.files.reduce((n, file) => n + file.bytes, 0) > limits.bytes)
      throw new LocalisyncError('verification', 'The release exceeds the delivery byte limit.')
    return manifest
  }
  private chain(manifest: ReleaseManifest, locales: readonly string[]) {
    const languages = new Map(manifest.languages.map(l => [l.locale, l.fallback]))
    const needed = new Set<string>()
    for (const selected of locales) {
      if (!manifest.requestedLocales.includes(selected))
        throw new LocalisyncError('locale', 'The selected locale is not published.')
      let locale: string | null = selected
      while (locale !== null && !needed.has(locale)) {
        needed.add(locale)
        locale = languages.get(locale) ?? null
      }
    }
    return needed
  }
  private async obtain(raw: RawGeneration, locale: string, signal: AbortSignal) {
    const checked = await this.catalog(raw.catalog, false),
      manifest = await this.verifyManifest(raw.manifest, checked.catalog)
    const needed = this.chain(manifest, [locale, ...this.config.preparedLocales]),
      files: Record<string, string> = { ...raw.files }
    for (const descriptor of manifest.files)
      if (needed.has(descriptor.locale)) {
        const existing = raw.files[descriptor.digest]
        files[descriptor.digest] =
          existing ??
          (await this.fetchValid(
            this.base() + '/releases/' + manifest.releaseId + '/files/' + descriptor.digest,
            descriptor.bytes,
            async (source, bytes) => {
              if (bytes.byteLength !== descriptor.bytes || (await digest(bytes)) !== descriptor.digest)
                throw new LocalisyncError('verification', 'The locale file failed integrity verification.')
              return source
            },
            signal
          ))
      }
    return this.prepare({ ...raw, locales: [locale, ...this.config.preparedLocales], files }, locale)
  }
  private async prepare(raw: RawGeneration, locale: string): Promise<Candidate> {
    const checked = await this.catalog(raw.catalog, false),
      manifest = await this.verifyManifest(raw.manifest, checked.catalog)
    const needed = this.chain(manifest, [locale, ...this.config.preparedLocales])
    const locales: { locale: string; entries: PreparedEntry[] }[] = []
    let inventory: Map<string, PreparedEntry> | null = null
    for (const descriptor of manifest.files)
      if (needed.has(descriptor.locale)) {
        const source = raw.files[descriptor.digest]
        if (typeof source !== 'string')
          throw new LocalisyncError('verification', 'A required cached locale is missing.')
        const bytes = encoder.encode(source)
        if (bytes.byteLength !== descriptor.bytes || (await digest(bytes)) !== descriptor.digest)
          throw new LocalisyncError('verification', 'The cached locale failed integrity verification.')
        const preparationStarted = performance.now()
        const file = localeFileSchema.parse(strictJson(source, descriptor.bytes))
        if (
          file.locale !== descriptor.locale ||
          file.releaseId !== manifest.releaseId ||
          file.entries.length !== manifest.keyCount
        )
          throw new LocalisyncError('verification', 'The locale file has a different scope or key inventory.')
        const entries = file.entries.map(input => {
          const entry = compileEntry(input),
            compiled = this.contracts.get(entry.key),
            sibling = inventory?.get(entry.key)
          if (
            (compiled && !sameContract(entry, compiled)) ||
            (inventory && (!sibling || !sameContract(entry, sibling)))
          )
            throw new LocalisyncError('compatibility', 'The release changes a required key contract.')
          return entry
        })
        inventory ??= new Map(entries.map(entry => [entry.key, entry]))
        locales.push({ locale: file.locale, entries })
        this.timings.preparationMs += performance.now() - preparationStarted
      }
    const candidate: Candidate = {
      timings: { ...this.timings },
      id: crypto.randomUUID(),
      locale,
      revision: checked.catalog.revision,
      bundle: { version: 1, releaseId: manifest.releaseId, languages: manifest.languages, locales }
    }
    this.candidates.clear()
    this.candidates.set(candidate.id, { raw, candidate, floor: checked.floor })
    return candidate
  }
  async locale(locale: string, releaseId: string) {
    this.resetTimings()
    if (!this.active) throw new LocalisyncError('locale', 'No active remote release is available.')
    const checked = await this.catalog(this.active.catalog, false),
      manifest = await this.verifyManifest(this.active.manifest, checked.catalog)
    if (manifest.releaseId !== releaseId)
      throw new LocalisyncError('verification', 'The requested release is no longer active.')
    return this.obtain(this.active, locale, this.signal())
  }
  async commit(id: string): Promise<{ persisted: boolean; error?: LocalisyncError }> {
    const selected = this.candidates.get(id)
    if (!selected) throw new LocalisyncError('verification', 'This prepared generation has been superseded.')
    const persisted = await this.persist(this.floor ?? selected.floor, selected.raw)
    this.active = selected.raw
    this.candidates.delete(id)
    return { persisted, ...(this.lastStorageError ? { error: this.lastStorageError } : {}) }
  }
  private resetTimings() {
    this.timings = { downloadMs: 0, verificationMs: 0, preparationMs: 0, transferMs: 0, indexMs: 0, commitMs: 0 }
  }
  cancel() {
    this.abort.abort()
  }
  async dispose() {
    this.abort.abort()
    this.candidates.clear()
    await this.cache.close()
  }
}
