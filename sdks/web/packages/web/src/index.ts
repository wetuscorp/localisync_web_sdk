import { DiagnosticsReporter, diagnosticDriver } from './diagnostics.js'
export type { DiagnosticsConfig } from './diagnostics.js'
import { LocalisyncClient, LocalisyncError } from './core/index.js'
import { validateConfig } from './config.js'
import type { WebConfig } from './types.js'
import { WorkerDriver } from './worker-driver.js'

export { LocalisyncClient, LocalisyncError } from './core/index.js'
export type {
  PreparedBundle,
  PreparedEntry,
  Parameters,
  Resolution,
  ClientStatus,
  TranslateOptions
} from './core/index.js'
export type { WebConfig, DeliveryConfig } from './types.js'
export function createClient(config: WebConfig): LocalisyncClient {
  const delivery = validateConfig(config)
  const driver = new WorkerDriver(
    () => {
      const url = new URL(config.workerUrl, location.href)
      if (url.origin !== location.origin || url.username || url.password || url.hash)
        throw new LocalisyncError('configuration', 'Host the worker on the application origin.')
      const worker = new Worker(url, { type: 'module', name: 'localisync-update' })
      return {
        post: value => worker.postMessage(value),
        listen: (receive, error) => {
          worker.onmessage = event => receive(event.data)
          worker.onerror = error
          worker.onmessageerror = error
        },
        terminate: () => worker.terminate()
      }
    },
    delivery,
    config.bundle
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
