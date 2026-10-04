export type Channel = 'preview' | 'production'
export type Parameters = Readonly<Record<string, string | number>>
export type Parameter = Readonly<{ name: string; type: 'text' | 'number' }>
export type MessageNode =
  | Readonly<{ kind: 'text'; value: string }>
  | Readonly<{ kind: 'argument'; name: string }>
  | Readonly<{ kind: 'pound' }>
  | Readonly<{ kind: 'select'; name: string; options: Readonly<Record<string, readonly MessageNode[]>> }>
  | Readonly<{
      kind: 'plural'
      name: string
      offset: number
      ordinal: boolean
      options: Readonly<Record<string, readonly MessageNode[]>>
    }>
export interface PreparedEntry {
  readonly key: string
  readonly format: 'plain' | 'icu'
  readonly parameters: readonly Parameter[]
  readonly value: string | null
  readonly program: readonly MessageNode[] | null
}
export interface PreparedBundle {
  readonly version: 1
  readonly releaseId: string | null
  readonly languages: readonly Readonly<{ locale: string; fallback: string | null }>[]
  readonly locales: readonly Readonly<{ locale: string; entries: readonly PreparedEntry[] }>[]
}
export type FailureCode =
  | 'configuration'
  | 'network'
  | 'authorization'
  | 'verification'
  | 'compatibility'
  | 'storage'
  | 'worker'
  | 'arguments'
  | 'locale'
  | 'cancelled'
  | 'disposed'
export class LocalisyncError extends Error {
  constructor(
    readonly code: FailureCode,
    message: string
  ) {
    super(message)
    this.name = 'LocalisyncError'
  }
}
export interface UpdateTimings {
  readonly downloadMs: number
  readonly verificationMs: number
  readonly preparationMs: number
  readonly transferMs: number
  readonly indexMs: number
  readonly commitMs: number
}
export interface Candidate {
  readonly timings?: UpdateTimings
  readonly id: string
  readonly bundle: PreparedBundle
  readonly revision: number
  readonly locale: string
}
export interface UpdateDriver {
  restore(locale: string): Promise<Candidate | null>
  refresh(locale: string): Promise<Candidate | null>
  locale(locale: string, releaseId: string): Promise<Candidate>
  commit(id: string): Promise<{ persisted: boolean; error?: LocalisyncError }>
  dispose(): void | Promise<void>
}
export type DiagnosticStage = 'start' | 'refresh' | 'locale' | 'activate' | 'translate' | 'cache' | 'worker'
export interface ClientOptions {
  readonly bundle: PreparedBundle
  readonly locale: string
  readonly activation?: 'immediate' | 'manual'
  readonly checkOnStart?: boolean
  readonly onDiagnostic?: (error: LocalisyncError, stage: DiagnosticStage) => void
}
export interface Resolution {
  readonly text: string
  readonly locale: string | null
  readonly source: 'remote' | 'bundle' | 'default' | 'key'
  readonly fallback: boolean
  readonly releaseId: string | null
}
export interface TranslateOptions {
  readonly defaultText?: string
}
export interface ClientStatus {
  readonly timings?: UpdateTimings
  readonly phase: 'idle' | 'starting' | 'checking' | 'ready' | 'pending' | 'error' | 'disposed'
  readonly revision: number | null
  readonly persisted: boolean
  readonly error: LocalisyncError | null
}
