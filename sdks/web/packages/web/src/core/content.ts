import { pluralCategory } from './plural.js'
import { LocalisyncError } from './types.js'
import type { MessageNode, Parameters, PreparedBundle, PreparedEntry, Resolution, TranslateOptions } from './types.js'

/** Freeze prepared data once; worker chunks can apply this before backpressure acknowledgment. */
export function freezePrepared<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezePrepared(child)
    Object.freeze(value)
  }
  return value
}

function evaluate(
  nodes: readonly MessageNode[],
  args: Parameters,
  locale: string,
  number: Intl.NumberFormat,
  pound?: number
): string {
  let result = ''
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        result += node.value
        break
      case 'argument':
        result += String(args[node.name])
        break
      case 'pound':
        result += pound === undefined ? '#' : number.format(pound)
        break
      case 'select': {
        const selected = String(args[node.name])
        const branch =
          (Object.hasOwn(node.options, selected) ? node.options[selected] : undefined) ?? node.options.other
        if (branch) result += evaluate(branch, args, locale, number, pound)
        break
      }
      case 'plural': {
        const value = args[node.name]
        if (typeof value !== 'number') throw new LocalisyncError('arguments', 'Expected a numeric message argument.')
        const branch =
          node.options['=' + value] ??
          node.options[pluralCategory(locale, value - node.offset, node.ordinal)] ??
          node.options.other
        if (branch) result += evaluate(branch, args, locale, number, value - node.offset)
        break
      }
    }
  }
  return result
}
function format(entry: PreparedEntry, args: Parameters, locale: string, number: Intl.NumberFormat): string {
  if (
    entry.parameters.length !== Object.keys(args).length ||
    entry.parameters.some(p => {
      const value = Object.hasOwn(args, p.name) ? args[p.name] : undefined
      return p.type === 'number' ? typeof value !== 'number' || !Number.isFinite(value) : typeof value !== 'string'
    })
  )
    throw new LocalisyncError('arguments', 'Message arguments do not match the key contract.')
  return entry.format === 'plain' ? (entry.value ?? '') : evaluate(entry.program ?? [], args, locale, number)
}
export class ContentView {
  readonly locale: string
  readonly releaseId: string | null
  private readonly entries = new Map<
    string,
    Readonly<{ entry: PreparedEntry; locale: string; number: Intl.NumberFormat }>
  >()
  constructor(
    readonly bundle: PreparedBundle,
    locale: string,
    private readonly source: 'remote' | 'bundle'
  ) {
    freezePrepared(bundle)
    this.locale = locale
    this.releaseId = bundle.releaseId
    const languages = new Map(bundle.languages.map(l => [l.locale, l.fallback]))
    if (!languages.has(locale)) throw new LocalisyncError('locale', 'The selected locale is not available.')
    const files = new Map(bundle.locales.map(l => [l.locale, l.entries]))
    const seen = new Set<string>()
    let cursor: string | null = locale
    while (cursor !== null) {
      if (seen.has(cursor) || !languages.has(cursor))
        throw new LocalisyncError('verification', 'Invalid fallback graph.')
      seen.add(cursor)
      const list = files.get(cursor)
      if (!list) throw new LocalisyncError('locale', 'The locale chain has not been prepared.')
      const number = new Intl.NumberFormat(cursor, { maximumFractionDigits: 3 })
      for (const entry of list)
        if (entry.value !== null && !this.entries.has(entry.key))
          this.entries.set(entry.key, { entry, locale: cursor, number })
      cursor = languages.get(cursor) ?? null
    }
    Object.freeze(this)
  }
  resolve(key: string, args: Parameters = {}): Resolution | null {
    const match = this.entries.get(key)
    return match
      ? Object.freeze({
          text: format(match.entry, args, match.locale, match.number),
          locale: match.locale,
          source: this.source,
          fallback: match.locale !== this.locale,
          releaseId: this.releaseId
        })
      : null
  }
}
/** An immutable request/render view. Subsequent client updates cannot change it. */
export class TranslationSnapshot {
  constructor(
    readonly locale: string,
    readonly remote: ContentView | null,
    readonly bundled: ContentView | null
  ) {
    Object.freeze(this)
  }
  resolve(key: string, args: Parameters = {}, options: TranslateOptions = {}): Resolution {
    return (
      this.remote?.resolve(key, args) ??
      this.bundled?.resolve(key, args) ??
      Object.freeze({
        text: options.defaultText ?? key,
        locale: null,
        source: options.defaultText === undefined ? 'key' : 'default',
        fallback: false,
        releaseId: null
      })
    )
  }
  translate(key: string, args?: Parameters, options?: TranslateOptions) {
    return this.resolve(key, args, options).text
  }
}
