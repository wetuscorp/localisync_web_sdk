import { LocalisyncError } from './core/index.js'
import { z } from 'zod'

export interface RawGeneration {
  readonly catalog: string
  readonly manifest: string
  readonly locales: readonly string[]
  readonly files: Readonly<Record<string, string>>
}
export interface Floor {
  readonly catalog: string
  readonly revision: number
  readonly digest: string
}
export interface CacheState {
  readonly version: 1
  readonly floor: Floor | null
  readonly active: RawGeneration | null
  readonly previous: RawGeneration | null
}
export interface CacheUpdate {
  readonly floor: Floor
  readonly generation?: RawGeneration
  readonly maxBytes: number
}
export interface DeliveryCache {
  read(scope: string): Promise<CacheState | null>
  readFloor?(scope: string): Promise<Floor | null>
  write(scope: string, update: CacheUpdate): Promise<void>
  close(): Promise<void>
}
export function nextCache(state: CacheState | null, update: CacheUpdate): CacheState {
  if (state && state.version !== 1) throw new LocalisyncError('storage', 'Unsupported cache schema.')
  if (
    state?.floor &&
    (state.floor.revision > update.floor.revision ||
      (state.floor.revision === update.floor.revision && state.floor.digest !== update.floor.digest))
  )
    throw new LocalisyncError('verification', 'Another cache writer observed a newer or conflicting catalog.')
  const active = update.generation ?? state?.active ?? null
  const previous =
    update.generation && state?.active?.manifest !== active?.manifest
      ? (state?.active ?? null)
      : (state?.previous ?? null)
  const next: CacheState = { version: 1, floor: update.floor, active, previous }
  // Blobs are stored once per scope, outside the small atomic generation record.
  const encoder = new TextEncoder()
  let bytes = encoder.encode(JSON.stringify(cacheReferences(next))).byteLength
  for (const body of cacheFiles(next).values()) bytes += encoder.encode(body).byteLength
  if (bytes > update.maxBytes)
    throw new LocalisyncError('storage', 'The cache budget cannot retain both verified generations.')
  return next
}
export function storageError(): LocalisyncError {
  return new LocalisyncError(
    'storage',
    'Persistent cache is unavailable; verified content remains available in memory.'
  )
}

const generationSchema = z
  .object({
    catalog: z.string(),
    manifest: z.string(),
    locales: z.array(z.string()),
    files: z.record(z.string(), z.string())
  })
  .strict()
export const cacheStateSchema = z
  .object({
    version: z.literal(1),
    floor: z
      .object({ catalog: z.string(), revision: z.number().int().nonnegative().safe(), digest: z.string() })
      .strict()
      .nullable(),
    active: generationSchema.nullable(),
    previous: generationSchema.nullable()
  })
  .strict()
export function cacheFiles(state: CacheState): Map<string, string> {
  return new Map([...Object.entries(state.previous?.files ?? {}), ...Object.entries(state.active?.files ?? {})])
}
export function hydrateCache(state: CacheState, files: ReadonlyMap<string, string>): CacheState {
  const hydrate = (generation: RawGeneration | null): RawGeneration | null =>
    generation && {
      ...generation,
      files: Object.fromEntries(
        Object.entries(generation.files).map(([digest, body]) => [digest, body || files.get(digest) || ''])
      )
    }
  return { ...state, active: hydrate(state.active), previous: hydrate(state.previous) }
}
export function cacheReferences(state: CacheState): CacheState {
  const references = (generation: RawGeneration | null): RawGeneration | null =>
    generation && {
      ...generation,
      files: Object.fromEntries(Object.keys(generation.files).map(digest => [digest, '']))
    }
  return { ...state, active: references(state.active), previous: references(state.previous) }
}
