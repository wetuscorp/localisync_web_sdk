---
title: Web quick start
description: Web quick start for Localisync applications.
sidebar:
  order: 1
---

The Web SDK reads prepared messages synchronously. Distribution requests run in a worker after `start()`; your first screen can use bundled text immediately. The npm, self-hosted script, React and Node integrations share delivery protocol v1.

## Prerequisites

Use Node 24 for building examples and server rendering. A project member can read SDK configuration in **Distributions → SDK setup → Web**. An Owner/Admin must create a channel read key and publish a release. Use the two **public** delivery addresses and trusted public signing keys. Never copy internal control addresses or private signing keys.

## Install the runtime

```sh
npm install localisync_sdk@0.1.0
```

One package supplies browser, core, DOM, Node and optional React entry points. React consumers use their application's React installation; a plain JavaScript consumer does not install React.

For the optional build-time generator, install the matching release asset as a development dependency:

```sh
npm install --save-dev https://github.com/wetuscorp/localisync_web_sdk/releases/download/v0.1.0/localisync_sdk_generator-0.1.0.tgz
```

The generator is not published as a second npm SDK. It is not imported by runtime code.
The [public source and four examples](https://github.com/wetuscorp/localisync_web_sdk) can also be built with `pnpm install --frozen-lockfile` and `pnpm build:sdk:web`. `pnpm sdk:web:pack` validates archive installation in a clean consumer without overrides.

## Prepare bundled messages

Create `messages.json`:

```json
{
  "version": 1,
  "languages": [{ "locale": "en", "fallback": null }],
  "locales": [
    {
      "locale": "en",
      "entries": [{ "key": "welcome", "format": "plain", "parameters": [], "value": "Welcome" }]
    }
  ]
}
```

Generate into a new directory:

```sh
npx localisync generate messages.json generated
```

The CLI writes `bundle.js`, its declaration, and typed `messages.ts`. It refuses an existing output directory. Keep the source input under version control; regenerate into a temporary directory, review and replace the old generated directory. Generated files contain no read key.

## Create and start a client

```ts
import { createClient } from 'localisync_sdk'
import bundle from './generated/bundle.js'

const client = createClient({
  ...distributionConfig,
  bundle,
  locale: 'en',
  appVersion: '1.0.0',
  workerUrl: '/assets/localisync/worker.js'
})

heading.textContent = client.translate('welcome')
const unsubscribe = client.subscribe(() => {
  heading.textContent = client.translate('welcome')
})
void client.start()
```

`distributionConfig` contains `projectId`, `distributionId`, `channel`, two `addresses`, `readKey` and `trustedKeys` from your deployment. It is application configuration, not a request to the management API at runtime. Copy `localisync_sdk`'s `dist/worker.js` to the same-origin URL above. Serve it as JavaScript. Use matching package and worker versions.

`start()` is idempotent. Rendering, focus, reconnect and client-side navigation do not check for a new publication. Call `await client.refresh()` explicitly to check later. On application teardown, call `unsubscribe()` and `await client.dispose()`.

## Run an example

The repository includes `sdks/web/examples/script`, `npm`, `react` and `next`. Each README explains local configuration and building. Add the ignored `public/localisync.json` file using your public distribution settings and a channel read key. These examples show a setup error until configured; they do not invent successful delivery.

If an update fails, bundled or previously verified text remains available. Inspect `client.getStatus().error.code`. Worker/CSP failures require correcting the worker URL or policy, rather than enabling an insecure main-thread fallback.
