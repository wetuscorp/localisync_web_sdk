---
title: Migrating repository Web packages
description: Replace the unpublished scoped packages with the single localisync_sdk package.
sidebar:
  order: 8
---

The first public Web release uses one `localisync_sdk` package. Applications that used the earlier repository archives should remove their archive dependencies and workspace overrides, then install `localisync_sdk@0.1.0`.

| Earlier import             | Public import                 |
| -------------------------- | ----------------------------- |
| `@localisync/web`          | `localisync_sdk`              |
| `@localisync/web/dom`      | `localisync_sdk/dom`          |
| `@localisync/web/server`   | `localisync_sdk/server`       |
| `@localisync/web/compiler` | `localisync_sdk/compiler`     |
| `@localisync/core`         | `localisync_sdk/core`         |
| `@localisync/react`        | `localisync_sdk/react`        |
| `@localisync/react/server` | `localisync_sdk/react/server` |

React stays an optional peer. The old CLI archive is replaced by the private development-generator asset documented in the [quick start](/sdks/web/quick-start/). Regenerate typed accessors so their imports use `localisync_sdk/core`.

Copy the worker from the same release as the runtime. The self-hosted script still exposes `Localisync.createClient` and `Localisync.bindDom`; it does not require an npm install on the serving host. For Next.js, update server package exclusions to `localisync_sdk` if your application customized bundling.

The client API, signed delivery protocol, cache schema, revision floors, bundled message shape and startup-only update policy are unchanged. Do not clear verified caches or lower catalog revisions as part of this migration. Preserve the previous runtime and matching worker together when preparing an application rollback.

Validate the first offline translation, signed refresh, React hydration or request-scoped Node rendering, and worker URLs in your own application before deploying the upgrade.
