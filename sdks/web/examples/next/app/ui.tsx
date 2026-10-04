'use client'
import { useState } from 'react'
import { createClient } from 'localisync_sdk'
import type { WebConfig } from 'localisync_sdk'
import type { PreparedBundle } from 'localisync_sdk/core'
import { LocalisyncProvider, useTranslation, useLocale, useLocalisyncStatus } from 'localisync_sdk/react'
import type { HydrationSnapshot } from 'localisync_sdk/react/server'

function Content() {
  const { translate } = useTranslation(),
    { locale, setLocale } = useLocale(),
    status = useLocalisyncStatus()
  return (
    <main>
      <h1>{translate('greeting', { name: 'Developer' })}</h1>
      <p>{translate('basket', { count: 2 })}</p>
      <label>
        Your draft <input />
      </label>
      <label>
        Language{' '}
        <select
          value={locale}
          onChange={event => {
            void setLocale(event.target.value)
          }}
        >
          <option value="en">English</option>
          <option value="tr">Turkish</option>
        </select>
      </label>
      <p role="status">{status.error?.message ?? status.phase}</p>
    </main>
  )
}
export function Application({
  configuration,
  bundle,
  initialSnapshot
}: {
  configuration: Omit<WebConfig, 'bundle' | 'workerUrl'>
  bundle: PreparedBundle
  initialSnapshot: HydrationSnapshot
}) {
  const [client] = useState(() => createClient({ ...configuration, bundle, workerUrl: '/worker.js' }))
  return (
    <LocalisyncProvider client={client} initialSnapshot={initialSnapshot}>
      <Content />
    </LocalisyncProvider>
  )
}
