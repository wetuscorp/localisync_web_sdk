import { ContentView, TranslationSnapshot } from '../core/index.js'
import type { PreparedBundle } from '../core/index.js'

export interface HydrationSnapshot {
  readonly version: 1
  readonly locale: string
  readonly remote: PreparedBundle | null
  readonly bundled: PreparedBundle | null
}
/** Serialize only the keys required by this request. Contains no SDK credentials. */
export function dehydrate(snapshot: TranslationSnapshot, keys: readonly string[]): HydrationSnapshot {
  const wanted = new Set(keys)
  const select = (bundle: PreparedBundle | undefined): PreparedBundle | null => {
    if (!bundle) return null
    const chain = new Set<string>()
    let locale: string | null = snapshot.locale
    while (locale !== null && !chain.has(locale)) {
      chain.add(locale)
      locale = bundle.languages.find(language => language.locale === locale)?.fallback ?? null
    }
    return {
      ...bundle,
      languages: bundle.languages.filter(language => chain.has(language.locale)),
      locales: bundle.locales
        .filter(file => chain.has(file.locale))
        .map(file => ({ locale: file.locale, entries: file.entries.filter(entry => wanted.has(entry.key)) }))
    }
  }
  return {
    version: 1,
    locale: snapshot.locale,
    remote: select(snapshot.remote?.bundle),
    bundled: select(snapshot.bundled?.bundle)
  }
}
/** Application-supplied SSR data is a rendering seed, never a signed cache record. */
export function hydrate(data: HydrationSnapshot): TranslationSnapshot {
  if (data.version !== 1) throw new Error('Unsupported Localisync hydration version.')
  return new TranslationSnapshot(
    data.locale,
    data.remote ? new ContentView(data.remote, data.locale, 'remote') : null,
    data.bundled ? new ContentView(data.bundled, data.locale, 'bundle') : null
  )
}
export function serializeHydration(data: HydrationSnapshot): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
