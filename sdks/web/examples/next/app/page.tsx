import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ContentView, TranslationSnapshot } from 'localisync_sdk/core'
import { connection } from 'next/server'
import { dehydrate } from 'localisync_sdk/react/server'
import bundle from '../generated/bundle'
import { getRuntime } from '../runtime'
import { Application } from './ui'

export default async function Page() {
  if (process.env.LOCALISYNC_STATIC !== 'true') await connection()
  let configuration
  try {
    configuration = JSON.parse(await readFile(resolve('public/localisync.json'), 'utf8'))
  } catch {
    return (
      <main>
        <h1>Localisync setup required</h1>
        <p>
          Add public/localisync.json with your distribution configuration, read key, locale and application version.
        </p>
      </main>
    )
  }
  const snapshot =
    getRuntime()?.capture(configuration.locale) ??
    new TranslationSnapshot(configuration.locale, null, new ContentView(bundle, configuration.locale, 'bundle'))
  return (
    <Application
      configuration={configuration}
      bundle={bundle}
      initialSnapshot={dehydrate(snapshot, ['greeting', 'basket'])}
    />
  )
}
