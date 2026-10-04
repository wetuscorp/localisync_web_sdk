const feedback = document.querySelector('[role="status"]')
async function start() {
  const [configuration, bundleResponse] = await Promise.all([fetch('/localisync.json'), fetch('/bundle.json')])
  if (!configuration.ok || !bundleResponse.ok) throw new Error('Add public/localisync.json with your distribution configuration, read key and application version.')
  const client = Localisync.createClient({ ...await configuration.json(), bundle: await bundleResponse.json(), workerUrl: '/worker.js' })
  const binding = Localisync.bindDom(document.querySelector('main'), client)
  client.subscribeStatus(() => { feedback.textContent = client.getStatus().error?.message ?? client.getStatus().phase })
  document.querySelector('#refresh').addEventListener('click', () => { void client.refresh() })
  document.querySelector('#locale').addEventListener('change', event => { void client.setLocale(event.target.value) })
  window.addEventListener('pagehide', () => { binding.dispose(); client.dispose() }, { once: true })
  await client.start()
}
start().catch(error => { feedback.textContent = error.message })
