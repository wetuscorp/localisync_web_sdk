import { parse, TYPE } from '@formatjs/icu-messageformat-parser'
import type { MessageFormatElement } from '@formatjs/icu-messageformat-parser'
import { z } from 'zod'
import { localeSchema, runtimeEntrySchema, limits } from '@localisync/delivery-protocol/runtime'
import { LocalisyncError, freezePrepared } from './core/index.js'
import type { MessageNode, Parameter, PreparedBundle, PreparedEntry } from './core/index.js'

const bundleSourceSchema = z
  .object({
    version: z.literal(1),
    languages: z.array(z.object({ locale: localeSchema, fallback: localeSchema.nullable() }).strict()).min(1),
    locales: z
      .array(z.object({ locale: localeSchema, entries: z.array(runtimeEntrySchema).max(limits.keys) }).strict())
      .min(1)
  })
  .strict()
function signature(parameters: readonly Parameter[]) {
  return [...parameters]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(p => `${p.name}:${p.type}`)
    .join('|')
}
export function sameContract(
  a: Pick<PreparedEntry, 'format' | 'parameters'>,
  b: Pick<PreparedEntry, 'format' | 'parameters'>
) {
  return a.format === b.format && signature(a.parameters) === signature(b.parameters)
}
export function compileEntry(input: unknown): PreparedEntry {
  const entry = runtimeEntrySchema.parse(input)
  const declared = new Map(entry.parameters.map(p => [p.name, p.type]))
  if (declared.size !== entry.parameters.length || (entry.format === 'plain' && declared.size))
    throw new LocalisyncError('verification', 'Invalid message parameter contract.')
  if (entry.value === null || entry.format === 'plain') return freezePrepared({ ...entry, program: null })
  let ast: MessageFormatElement[]
  try {
    ast = parse(entry.value, {
      ignoreTag: true,
      requiresOtherClause: true,
      captureLocation: false,
      shouldParseSkeletons: false
    })
  } catch {
    throw new LocalisyncError('verification', 'Invalid ICU message syntax.')
  }
  let count = 0
  const argument = (name: string, type?: 'text' | 'number') => {
    const expected = declared.get(name)
    if (!expected || (type && expected !== type))
      throw new LocalisyncError('verification', 'ICU arguments do not match the key contract.')
  }
  const nodes = (elements: MessageFormatElement[], depth: number): readonly MessageNode[] =>
    elements.map(element => {
      if (++count > 1000 || depth > 10)
        throw new LocalisyncError('verification', 'ICU complexity exceeds the allowed limit.')
      if (element.type === TYPE.literal) return { kind: 'text', value: element.value }
      if (element.type === TYPE.pound) return { kind: 'pound' }
      if (element.type === TYPE.argument) {
        argument(element.value)
        return { kind: 'argument', name: element.value }
      }
      if (element.type === TYPE.select || element.type === TYPE.plural) {
        argument(element.value, element.type === TYPE.select ? 'text' : 'number')
        const options: Record<string, readonly MessageNode[]> = Object.create(null)
        for (const [key, branch] of Object.entries(element.options)) {
          const normalized = key.startsWith('=') ? '=' + Number(key.slice(1)) : key
          if (Object.hasOwn(options, normalized)) throw new LocalisyncError('verification', 'Duplicate ICU selector.')
          options[normalized] = nodes(branch.value, depth + 1)
        }
        return element.type === TYPE.select
          ? { kind: 'select', name: element.value, options }
          : {
              kind: 'plural',
              name: element.value,
              offset: element.offset,
              ordinal: element.pluralType === 'ordinal',
              options
            }
      }
      throw new LocalisyncError('verification', 'This ICU expression is not supported by the delivery protocol.')
    })
  const program = nodes(ast, 0)
  return freezePrepared({ ...entry, program })
}
/** Development/build-time compiler. Runtime reads never invoke this function. */
export function compileBundle(source: unknown): PreparedBundle {
  const value = bundleSourceSchema.parse(source)
  const languages = new Map(value.languages.map(l => [l.locale, l.fallback]))
  const locales = new Map(value.locales.map(l => [l.locale, l.entries]))
  if (
    languages.size !== value.languages.length ||
    locales.size !== value.locales.length ||
    languages.size !== locales.size
  )
    throw new LocalisyncError('verification', 'Invalid bundle language inventory.')
  const roots = new Set<string>()
  for (const locale of languages.keys()) {
    let cursor: string | null = locale
    const seen = new Set<string>()
    while (cursor !== null) {
      if (seen.has(cursor) || !languages.has(cursor) || !locales.has(cursor))
        throw new LocalisyncError('verification', 'Invalid bundle fallback graph.')
      seen.add(cursor)
      const parent: string | null = languages.get(cursor) ?? null
      if (parent === null) roots.add(cursor)
      cursor = parent
    }
  }
  if (roots.size !== 1) throw new LocalisyncError('verification', 'Fallback chains must have one source language.')
  const contracts = new Map<string, PreparedEntry>()
  let values = 0,
    bytes = 0
  const prepared = value.locales.map(file => {
    const keys = new Set<string>()
    const entries = file.entries.map(entry => {
      if (keys.has(entry.key)) throw new LocalisyncError('verification', 'Duplicate bundle key.')
      keys.add(entry.key)
      const compiled = compileEntry(entry),
        previous = contracts.get(entry.key)
      if (previous && !sameContract(compiled, previous))
        throw new LocalisyncError('verification', 'Language contracts do not agree.')
      contracts.set(entry.key, compiled)
      bytes += new TextEncoder().encode(entry.value ?? '').byteLength
      values++
      return compiled
    })
    return { locale: file.locale, entries }
  })
  if (contracts.size > limits.keys || values > limits.values || bytes > limits.bytes)
    throw new LocalisyncError('verification', 'The bundle exceeds delivery limits.')
  return { version: 1, releaseId: null, languages: value.languages, locales: prepared }
}

export { strictJson as parseSourceJson } from './json.js'
