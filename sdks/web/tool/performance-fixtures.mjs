import { randomUUID } from 'node:crypto'
export async function createBenchmarkFixture(profile, { projectId, distributionId, sign, hash, revision = 1 }) {
  const compatibility = { min: null, max: null }
  const releaseId = randomUUID(),
    locales = ['en', 'tr', 'fr', 'de', 'es'],
    files = {},
    descriptors = []
  const count = profile === 'small' ? 100 : 10000
  for (const locale of locales) {
    const entries = Array.from({ length: count }, (_, i) => ({
      key: i === 0 ? 'plain' : i === 1 ? 'icu' : 'message_' + i,
      format: i === 0 || profile === 'long' ? 'plain' : 'icu',
      parameters: i === 0 || profile === 'long' ? [] : [{ name: 'n', type: 'number' }],
      value:
        i === 0
          ? 'Published'
          : profile === 'long'
            ? locale + ':' + i + ' ' + 'abcdefghijklmno '.repeat(120)
            : `${locale} ${i} {n, plural, offset:1 =0 {none ${i}} one {# item ${i}} other {# items ${i}}}`
    }))
    const body = JSON.stringify({ protocol: 1, releaseId, locale, entries }),
      digest = hash(body)
    files[digest] = body
    descriptors.push({ locale, digest, bytes: Buffer.byteLength(body) })
  }
  const manifest = await sign({
    protocol: 1,
    kind: 'release',
    projectId,
    releaseId,
    compatibility,
    requestedLocales: locales,
    languages: locales.map((locale, index) => ({ locale, fallback: index === 0 ? null : locales[index - 1] })),
    files: descriptors,
    keyCount: count
  })
  const catalog = await sign({
    protocol: 1,
    kind: 'catalog',
    projectId,
    distributionId,
    channel: 'preview',
    revision,
    publications: [{ id: randomUUID(), releaseId, manifestDigest: hash(manifest), sequence: 1, compatibility }]
  })
  const bytes = descriptors.reduce((n, file) => n + file.bytes, 0)
  if (bytes > 100 * 1024 * 1024) throw new Error('Benchmark fixture exceeds protocol')
  return { files, manifest, catalog, bytes, count }
}
