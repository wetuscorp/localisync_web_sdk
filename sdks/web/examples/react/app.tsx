import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from 'localisync_sdk'
import { LocalisyncProvider, useTranslation, useLocale, useLocalisyncStatus } from 'localisync_sdk/react'
import bundle from './generated/bundle'

function Application() {
  const { translate } = useTranslation(),
    { locale, setLocale } = useLocale(),
    status = useLocalisyncStatus()
  return (
    <main>
      <img src="/symbol.svg" alt="Localisync" width={40} height={40} />
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
async function start() {
  const response = await fetch('/localisync.json')
  if (!response.ok) throw new Error('Add public/localisync.json with your distribution configuration.')
  const client = createClient({ ...(await response.json()), bundle, workerUrl: '/worker.js' })
  const element = document.querySelector('#root')
  if (!element) throw new Error('Example root is missing.')
  createRoot(element).render(
    <StrictMode>
      <LocalisyncProvider client={client}>
        <Application />
      </LocalisyncProvider>
    </StrictMode>
  )
  window.addEventListener(
    'pagehide',
    () => {
      client.dispose()
    },
    { once: true }
  )
}
start().catch((error: unknown) => {
  const root = document.querySelector('#root')
  if (root) root.textContent = error instanceof Error ? error.message : 'Application setup failed.'
})
