import { z } from 'zod'
import { appVersionSchema, channelSchema, localeSchema } from '@localisync/delivery-protocol/runtime'
import { LocalisyncError } from './core/index.js'
import type { DeliveryConfig } from './types.js'
export type { DeliveryConfig, WebConfig, ServerConfig } from './types.js'

export const deliveryConfigSchema = z.object({
  projectId: z.uuid(),
  distributionId: z.uuid(),
  channel: channelSchema,
  addresses: z.tuple([z.url(), z.url()]),
  readKey: z
    .string()
    .min(1)
    .max(4096)
    .regex(/^[\x21-\x7e]+$/),
  trustedKeys: z
    .record(z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/), z.string().min(1).max(1024))
    .refine(v => Object.keys(v).length > 0 && Object.keys(v).length <= 20),
  appVersion: appVersionSchema,
  allowDevelopmentHttp: z.boolean().default(false),
  requestTimeoutMs: z.number().int().min(1).max(120000).default(15000),
  refreshTimeoutMs: z.number().int().min(1).max(600000).default(60000),
  cacheMaxBytes: z
    .number()
    .int()
    .positive()
    .safe()
    .default(256 * 1024 * 1024),
  preparedLocales: z.array(localeSchema).max(50000).default([])
})
export type RuntimeConfig = z.output<typeof deliveryConfigSchema>
export function validateConfig(input: DeliveryConfig): RuntimeConfig {
  const parsed = deliveryConfigSchema.safeParse(input)
  if (!parsed.success) throw new LocalisyncError('configuration', 'Invalid Localisync delivery configuration.')
  const config = parsed.data
  for (const address of config.addresses) {
    const url = new URL(address)
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(
          config.allowDevelopmentHttp &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        ))
    )
      throw new LocalisyncError('configuration', 'Use HTTPS delivery origins, or explicitly enabled loopback HTTP.')
  }
  if (new URL(config.addresses[0]).origin === new URL(config.addresses[1]).origin)
    throw new LocalisyncError('configuration', 'Two distinct distribution origins are required.')
  return config
}
export function cacheScope(config: RuntimeConfig) {
  return JSON.stringify([
    1,
    config.projectId,
    config.distributionId,
    config.channel,
    config.addresses.map(a => new URL(a).origin).sort()
  ])
}
