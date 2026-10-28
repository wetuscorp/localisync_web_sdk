---
title: Self-hosted JavaScript and HTML
description: Self-hosted JavaScript and HTML for Localisync applications.
sidebar:
  order: 3
---

Use this integration for pages that own their DOM. Do not bind a subtree also managed by React.

## Assets

Download `localisync_sdk-0.1.1-script.zip` from the [versioned GitHub Release](https://github.com/wetuscorp/localisync_web_sdk/releases/tag/v0.1.1), verify it against the release `SHA256SUMS`, and extract the matching `localisync.js` and `worker.js`. You can also copy `dist/localisync.js` and `dist/worker.js` from the same Web package version onto your application origin. No CDN is required. The script exposes `window.Localisync.createClient` and `window.Localisync.bindDom`; it does not create a global client or change a global locale.

```html
<script src="/assets/localisync/localisync.js" defer></script>
<script src="/app.js" defer></script>
<main id="translations">
  <h1 data-localisync="welcome"></h1>
  <input data-localisync-placeholder="search" aria-label="Search" />
</main>
```

In `app.js`, create a client with your prepared bundle and configuration, then call:

```js
const binding = Localisync.bindDom(document.querySelector('#translations'), client, {
  onDiagnostic: (error) => showSetupError(error.code)
})
void client.start()
```

Pass parameters as a JSON object in `data-localisync-args`. Values must be strings or finite numbers. Dynamic additions/removals are observed only inside the chosen root. `binding.refresh()` rescans it; `binding.dispose()` removes observers and subscriptions. Dispose the client separately when the application ends.

## Safe binding boundaries

Text bindings require leaf elements. A container with interactive children is rejected so controls are not deleted. The adapter never interprets messages as HTML. It supports only `title`, `placeholder`, `aria-label` and `alt` through corresponding `data-localisync-*` attributes. URL attributes, event handlers, input `value` and editable content are excluded.

The adapter reports an unsafe target or malformed parameters; correct the markup or argument contract. It leaves form drafts untouched when translations update. For a complete runnable entry point, use `sdks/web/examples/script`.
