# localisync_sdk

Localisync web package. Version 0.1.0, MIT licensed.

Source: https://github.com/wetuscorp/localisync_web_sdk. See the matching GitHub Release for tested platforms and release assets.
Use the Web SDK guides in the documentation site and the runnable examples under
`sdks/web/examples`. Packages require delivery protocol v1. The server adapter uses
Node 24; React integration targets React 19.2.4 and later 19.x releases.

Translations are read from prepared memory. Startup restores verified durable cache
and performs one bounded update; later checks are explicit. Never use management
credentials as distribution read keys. Worker assets must match the SDK version.

Optional `diagnostics: { endpoint, key }` enables memory-bounded SDK error counters;
it is absent by default and requires a separate write-only diagnostic key. It never
collects host application errors, translation keys, values or ICU arguments. Reporting
failure cannot replace active content. `dispose()` cancels pending reports. Follow
**Operations → SDK diagnostics** for endpoint/origin setup and credential rotation.

See `licenses/` for required third-party notices. Platform and performance evidence
is recorded separately; package availability is not production approval.

## Installation

```sh
npm install localisync_sdk@0.1.0
```

React applications import `localisync_sdk/react` and keep their existing React installation.
For build-time message generation, install the matching generator release asset:

```sh
npm install --save-dev https://github.com/wetuscorp/localisync_web_sdk/releases/download/v0.1.0/localisync_sdk_generator-0.1.0.tgz
npx localisync generate messages.json generated
```

Plain HTML pages can download `localisync_sdk-0.1.0-script.zip` from the same release
and host `localisync.js` and `worker.js` together. No npm installation is required
for serving the script. Prepared messages can be generated during development.

## Entry points

- `localisync_sdk`: browser `createClient` and public types.
- `localisync_sdk/core`: platform-independent state and prepared message types.
- `localisync_sdk/react`: optional Provider and hooks using your React installation.
- `localisync_sdk/react/server`: immutable SSR hydration helpers.
- `localisync_sdk/dom`: optional safe `bindDom` adapter.
- `localisync_sdk/server`: Node 24 `createServerClient`.
- `localisync_sdk/compiler`: build-time preparation; keep out of application render bundles.
- `dist/localisync.js` and `dist/worker.js`: matching self-hosted script and module worker assets.

```ts
import { createClient } from 'localisync_sdk'
import bundle from './generated/bundle.js'
const client = createClient({
  ...publicSetup,
  readKey,
  appVersion: '1.0.0',
  locale: 'en',
  bundle,
  workerUrl: '/worker.js'
})
const initialText = client.translate('welcome')
void client.start()
```

`publicSetup` comes from your distribution's SDK setup screen. Serve the worker on your application origin and allow both delivery origins through CSP/CORS. Inspect `getStatus()` after updates. Use explicit `refresh()` after startup; `activation: 'manual'` requires `activatePending()`. Await `dispose()` when ending a runtime. Node requires a private cache directory per active instance. Cache failures preserve verified in-memory text and report `persisted: false`.
