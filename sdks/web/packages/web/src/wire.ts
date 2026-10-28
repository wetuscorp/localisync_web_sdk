import { z } from 'zod'
import type { MessageNode, PreparedBundle, PreparedEntry } from './core/index.js'
import { deliveryConfigSchema } from './config.js'

export const workerVersion = '0.1.1'
const nodeSchema: z.ZodType<MessageNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), value: z.string() }),
    z.object({ kind: z.literal('argument'), name: z.string() }),
    z.object({ kind: z.literal('pound') }),
    z.object({ kind: z.literal('select'), name: z.string(), options: z.record(z.string(), z.array(nodeSchema)) }),
    z.object({
      kind: z.literal('plural'),
      name: z.string(),
      offset: z.number(),
      ordinal: z.boolean(),
      options: z.record(z.string(), z.array(nodeSchema))
    })
  ])
)
export const entrySchema = z.object({
  key: z.string(),
  format: z.enum(['plain', 'icu']),
  value: z.string().nullable(),
  parameters: z.array(z.object({ name: z.string(), type: z.enum(['text', 'number']) })),
  program: z.array(nodeSchema).nullable()
})
export const bundleSchema: z.ZodType<PreparedBundle> = z.object({
  version: z.literal(1),
  releaseId: z.string().nullable(),
  languages: z.array(z.object({ locale: z.string(), fallback: z.string().nullable() })),
  locales: z.array(z.object({ locale: z.string(), entries: z.array(entrySchema) }))
})
export const failureCodeSchema = z.enum([
  'configuration',
  'network',
  'authorization',
  'verification',
  'compatibility',
  'storage',
  'worker',
  'arguments',
  'locale',
  'cancelled',
  'disposed'
])
const contractBatchSchema: z.ZodType<readonly PreparedEntry[]> = z.array(entrySchema).max(64)
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('init'),
    id: z.number(),
    version: z.literal(workerVersion),
    config: deliveryConfigSchema,
    bundle: bundleSchema,
    directory: z.string().optional()
  }),
  z.object({ type: z.literal('contracts'), id: z.number(), entries: contractBatchSchema }),
  z.object({ type: z.enum(['restore', 'refresh']), id: z.number(), locale: z.string() }),
  z.object({ type: z.literal('locale'), id: z.number(), locale: z.string(), releaseId: z.string() }),
  z.object({ type: z.literal('commit'), id: z.number(), candidateId: z.string() }),
  z.object({ type: z.enum(['ack', 'dispose']), id: z.number() })
])
const timingsSchema = z.object({
  downloadMs: z.number().nonnegative(),
  verificationMs: z.number().nonnegative(),
  preparationMs: z.number().nonnegative(),
  transferMs: z.number().nonnegative(),
  indexMs: z.number().nonnegative(),
  commitMs: z.number().nonnegative()
})
export const responseSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('closed'), id: z.number() }),
  z.object({ type: z.literal('ready'), id: z.number(), version: z.literal(workerVersion) }),
  z.object({
    type: z.literal('begin'),
    timings: timingsSchema.optional(),
    id: z.number(),
    candidateId: z.string(),
    locale: z.string(),
    revision: z.number(),
    releaseId: z.string().nullable(),
    languages: z.array(z.object({ locale: z.string(), fallback: z.string().nullable() }))
  }),
  z.object({ type: z.literal('chunk'), id: z.number(), buffer: z.instanceof(ArrayBuffer) }),
  z.object({ type: z.literal('end'), id: z.number(), empty: z.boolean() }),
  z.object({
    type: z.literal('committed'),
    id: z.number(),
    persisted: z.boolean(),
    error: z.object({ code: failureCodeSchema, message: z.string() }).optional()
  }),
  z.object({ type: z.literal('error'), id: z.number(), code: failureCodeSchema, message: z.string() })
])
export const chunkSchema = z.object({ locale: z.string(), entries: z.array(entrySchema) })
export type Command = z.infer<typeof commandSchema>
export type Response = z.infer<typeof responseSchema>
