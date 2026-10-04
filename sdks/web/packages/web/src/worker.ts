import { serveWorker } from './worker-host.js'
import { IndexedDbCache } from './cache-browser.js'

const receive = serveWorker(
  (value, transfers = []) => globalThis.postMessage(value, { transfer: transfers }),
  () => new IndexedDbCache()
)
globalThis.addEventListener('message', (event: MessageEvent<unknown>) => receive(event.data))
