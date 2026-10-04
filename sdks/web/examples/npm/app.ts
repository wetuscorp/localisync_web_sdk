import { createClient } from 'localisync_sdk'
import { bindDom } from 'localisync_sdk/dom'
import bundle from './generated/bundle'

async function start() {
  const response = await fetch('/localisync.json')
  if (!response.ok) throw new Error('Add public/localisync.json with your distribution configuration.')
  const client = createClient({ ...(await response.json()), bundle, workerUrl: '/worker.js' })
  const root = document.querySelector('main'),
    feedback = document.querySelector('[role="status"]')
  if (!root || !feedback) throw new Error('Example markup is missing.')
  const binding = bindDom(root, client)
  client.subscribeStatus(() => {
    feedback.textContent = client.getStatus().error?.message ?? client.getStatus().phase
  })
  document.querySelector('#refresh')?.addEventListener('click', () => {
    void client.refresh()
  })
  document.querySelector('#locale')?.addEventListener('change', event => {
    if (event.target instanceof HTMLSelectElement) void client.setLocale(event.target.value)
  })
  window.addEventListener(
    'pagehide',
    () => {
      binding.dispose()
      client.dispose()
    },
    { once: true }
  )
  await client.start()
}
start().catch((error: unknown) => {
  const feedback = document.querySelector('[role="status"]')
  if (feedback) feedback.textContent = error instanceof Error ? error.message : 'Application setup failed.'
})
