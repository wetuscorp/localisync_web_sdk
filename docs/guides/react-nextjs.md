---
title: React, SSR and Next.js
description: React, SSR and Next.js for Localisync applications.
sidebar:
  order: 4
---

The optional `localisync_sdk/react` entry uses your application's React 19 installation. Localisync does not mount a second React copy.

## React

Create one client for the application lifetime. Keep it outside render, or initialize it once with `useState`. Wrap the application in `LocalisyncProvider`:

```tsx
import { LocalisyncProvider, useTranslation, useLocale } from 'localisync_sdk/react'

function Greeting() {
  const { translate } = useTranslation()
  const { locale, setLocale } = useLocale()
  return (
    <section>
      <h1>{translate('welcome')}</h1>
      <select value={locale} onChange={(event) => void setLocale(event.target.value)}>
        <option value="en">English</option>
        <option value="tr">Turkish</option>
      </select>
    </section>
  )
}

function Application() {
  return (
    <LocalisyncProvider client={client}>
      <Greeting />
    </LocalisyncProvider>
  )
}
```

`useLocalisyncStatus` subscribes to update status separately. Download/check status does not rerender translation-only consumers. `useTranslation` follows the current immutable view; parameter errors throw from that view. Use generated access types and an application error boundary for unexpected programming errors.

The provider starts the client in an effect. Strict Mode does not add a second startup check. The application owns disposal; do not dispose in a Strict Mode effect cleanup that React immediately replays. Release changes update subscriptions without replacing the provider, form or navigation tree.

## Long-lived Node SSR

Import `createServerClient` from `localisync_sdk/server`, configure `preparedLocales` for every server-rendered locale, and use a private writable cache directory per runtime. Initialize once at process startup; call `void runtime.start()` so network access does not delay first HTML.

For each request, capture a view before rendering:

```ts
const snapshot = runtime.capture(requestLocale)
const heading = snapshot.translate('welcome')
```

Never call `setLocale` on a shared server runtime for an individual request. A captured view stays on its generation even if another task calls `refresh()` during streaming. Requests only use prepared memory; they do not fetch translations.

## Hydration

Use `dehydrate(snapshot, requiredKeys)` from `localisync_sdk/react/server`. It includes only the requested keys and the captured locale chain, with no SDK configuration. Pass the result as `initialSnapshot` to the browser provider. React's server snapshot and first hydration read that same content before the client starts cache/network activation.

For manually embedded JSON, use `serializeHydration` and a non-executable JSON container. It escapes HTML-sensitive characters. Do not embed arbitrary unescaped JSON in script markup. Hydration data is an application rendering seed, not a signed persistent cache entry.

## Next.js App Router

The runnable `sdks/web/examples/next` uses a Node runtime started from `instrumentation.ts`, a Server Component that captures content, and a Client Component provider. Keep `/server` imports outside Client Components. The example explicitly externalizes the Node adapter for webpack because monorepo symlinks resolve outside `node_modules`; this preserves the packaged `worker_threads` entry. Do not remove that rule while running from workspace links. Deployment must preserve the worker asset and give each Node instance a separate writable cache directory.

For static output set `LOCALISYNC_STATIC=true` while building the example. Static HTML contains build-time bundled messages; the browser can update after hydration. Node SSR can serve new verified content on later requests after an explicit server `refresh()`, without rebuilding the application. Multiple Node instances update independently. Serverless and Edge runtimes are outside this release's scope.
