---
title: JavaScript and TypeScript API
description: JavaScript and TypeScript API for Localisync applications.
sidebar:
  order: 2
---

Import `createClient` from `localisync_sdk`; import `createServerClient` from `localisync_sdk/server` only in Node code. Each instance owns its locale, subscriptions, network and worker lifecycle.

## Configuration

| Field                                  | Requirement                                                         |
| -------------------------------------- | ------------------------------------------------------------------- |
| `projectId`, `distributionId`          | UUIDs from SDK setup                                                |
| `channel`                              | `preview` or `production`                                           |
| `addresses`                            | Exactly two distinct HTTPS origins                                  |
| `readKey`                              | Channel-scoped bearer read key                                      |
| `trustedKeys`                          | Map of trusted signing `kid` to Ed25519 public PEM                  |
| `appVersion`                           | Strict SemVer, including optional prerelease/build metadata         |
| `locale`, `bundle`                     | Explicit initial locale and prepared bundled messages               |
| `workerUrl`                            | Same-origin module worker; browser only                             |
| `cacheDirectory`                       | Private writable directory for this Node runtime                    |
| `activation`                           | `immediate` by default, or `manual`                                 |
| `checkOnStart`                         | Defaults to true; false restores cache without checking publication |
| `preparedLocales`                      | Additional locales prepared with their fallback chains              |
| `requestTimeoutMs`, `refreshTimeoutMs` | Defaults: 15,000 and 60,000 milliseconds                            |
| `cacheMaxBytes`                        | Defaults to 256 MiB                                                 |
| `allowDevelopmentHttp`                 | Explicit loopback-only HTTP exception, default false                |
| `onDiagnostic`                         | Receives typed errors; do not log translation arguments             |

## Client methods

| Method                                          | Result                                                          |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `start(): Promise<void>`                        | Restore verified cache and perform the configured single check  |
| `translate(key, parameters?, options?): string` | Synchronous prepared message, optional `defaultText`            |
| `resolve(...)`                                  | Text, message locale, source, fallback flag and release ID      |
| `refresh(): Promise<void>`                      | Coalesced explicit check; inspect status for failures           |
| `setLocale(locale): Promise<void>`              | Prepare the same release's locale chain, then switch atomically |
| `activatePending(): Promise<void>`              | Activate the verified manual candidate                          |
| `getSnapshot()`                                 | Stable immutable content view until content/locale changes      |
| `capture(locale?)`                              | Pin one already-prepared locale for a request without I/O       |
| `subscribe(listener)`                           | Content/locale changes; returns unsubscribe                     |
| `getStatus()`, `subscribeStatus(listener)`      | Separate lifecycle/error state subscription                     |
| `dispose(): Promise<void>`                      | Abort work, release cache writer and close the worker           |

Status phases are `idle`, `starting`, `checking`, `ready`, `pending`, `error`, `disposed`. Status includes the verified revision and whether activation was persisted. Successful updates also expose `timings`: download, signature verification, content preparation, bounded worker transfer, indexing and cache commit durations in milliseconds. These are local diagnostic measurements, not an SLA. Awaiting `refresh()` does not imply success; inspect the status.

Diagnostic codes distinguish configuration, network, authorization, verification, compatibility, storage, worker, arguments, locale, cancellation and disposal failures. Translation calls on the client report parameter errors and return `defaultText` or the key. A captured snapshot is a strict formatting view: invalid arguments throw a typed error.

## Typed generation

`localisync generate` validates local JSON and emits a `TranslationKey` union and a per-key parameter map. `typedTranslations(client)` checks argument names and types at compile time. New remote keys remain available through the dynamic API; regenerate to expose them in TypeScript.

`pnpm exec localisync download config.json generated` downloads and verifies a published release before generation. Put the read key in the `LOCALISYNC_READ_KEY` environment variable, not the config file or shell history. The config includes public delivery identity, addresses, trust keys, version and locale. Set `preparedLocales` for additional bundled languages. A failed verification leaves no partial output directory.

A remote change to an existing generated key's format or variable types is rejected. Release publishing does not add new TypeScript methods to a compiled application.
