import type { DiagnosticsConfig } from './diagnostics.js'
import type { ClientOptions } from './core/index.js'

export interface DeliveryConfig {
  readonly diagnostics?: DiagnosticsConfig
  readonly projectId: string
  readonly distributionId: string
  readonly channel: 'preview' | 'production'
  readonly addresses: readonly [string, string]
  readonly readKey: string
  readonly trustedKeys: Readonly<Record<string, string>>
  readonly appVersion: string
  readonly allowDevelopmentHttp?: boolean
  readonly requestTimeoutMs?: number
  readonly refreshTimeoutMs?: number
  readonly cacheMaxBytes?: number
  readonly preparedLocales?: readonly string[]
}
export interface WebConfig extends ClientOptions, DeliveryConfig {
  readonly workerUrl: string | URL
}
export interface ServerConfig extends ClientOptions, DeliveryConfig {
  readonly cacheDirectory: string
}
