import { parentPort, workerData } from 'node:worker_threads'
import { serveWorker } from './worker-host.js'
import { NodeCache } from './cache-node.js'
import { z } from 'zod'
import { LocalisyncError } from './core/index.js'

const port = parentPort
if (!port) throw new LocalisyncError('worker', 'This entry point runs inside a Node worker.')
const receive = serveWorker(
  (value, transfers = []) => port.postMessage(value, transfers),
  directory => {
    if (!directory) throw new LocalisyncError('configuration', 'A private Node cache directory is required.')
    return new NodeCache(directory, z.object({ lease: z.string().uuid() }).parse(workerData).lease)
  }
)
port.on('message', receive)
