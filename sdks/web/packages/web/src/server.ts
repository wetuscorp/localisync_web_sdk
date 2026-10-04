import { DiagnosticsReporter, diagnosticDriver } from './diagnostics.js'
export type { DiagnosticsConfig } from './diagnostics.js'
import { randomUUID } from 'node:crypto'
import { releaseWorkerLease } from './cache-node.js'
import { Worker } from 'node:worker_threads'
import { LocalisyncClient, LocalisyncError } from './core/index.js'
import { validateConfig } from './config.js'
import type { ServerConfig } from './types.js'
import { WorkerDriver } from './worker-driver.js'

export type { ServerConfig } from './types.js'
export function createServerClient(config: ServerConfig): LocalisyncClient {
  if (!config.cacheDirectory.trim())
    throw new LocalisyncError('configuration', 'A private cache directory is required.')
  const driver = new WorkerDriver(
    () => {
      const lease = randomUUID()
      const worker = new Worker(new URL('./node-worker.js', import.meta.url), {
        workerData: { lease },
        resourceLimits: { maxOldGenerationSizeMb: 768 }
      })
      return {
        post: value => worker.postMessage(value),
        listen: (receive, error) => {
          worker.on('message', receive)
          worker.on('error', error)
          worker.on('exit', code => {
            void releaseWorkerLease(config.cacheDirectory, lease).finally(() => {
              if (code !== 0) error()
            })
          })
        },
        terminate: async () => {
          await worker.terminate()
          await releaseWorkerLease(config.cacheDirectory, lease)
        }
      }
    },
    validateConfig(config),
    config.bundle,
    config.cacheDirectory
  )
  const reporter = config.diagnostics
    ? new DiagnosticsReporter(config.diagnostics, config.appVersion, config.allowDevelopmentHttp)
    : undefined
  const client = new LocalisyncClient(
    reporter
      ? {
          ...config,
          onDiagnostic: (error, stage) => {
            reporter.record(error.code, stage)
            config.onDiagnostic?.(error, stage)
          }
        }
      : config,
    reporter ? diagnosticDriver(driver, reporter) : driver
  )
  reporter?.attach(client)
  return client
}
