---
title: Platforms, maintenance and verification
description: Platforms, maintenance and verification for Localisync applications.
sidebar:
  order: 7
---

The support target is the current and preceding major Chrome, Edge, Firefox and Safari releases, plus long-lived Node 24. Targets are not evidence that every combination has run. Local browser results and outstanding platform gates are maintained in the repository verification record. Version [0.1.0 is published on npm](https://www.npmjs.com/package/localisync_sdk). Its [public release](https://github.com/wetuscorp/localisync_web_sdk/releases/tag/v0.1.0) links the same-commit Linux/macOS/Windows and real-browser CI results, matching assets and measured limits. Only executed checks count as release evidence.

## Reproduce checks

From the repository root:

```sh
pnpm build:sdk:web
pnpm test:sdk:web
pnpm test:sdk:web:browser
pnpm test:sdk:web:react
pnpm test:sdk:web:next
pnpm test:sdk:web:cli
pnpm sdk:web:pack
pnpm sdk:web:benchmark
```

The default browser harness uses installed Playwright Chromium/Firefox/WebKit and Google Chrome. `SDK_BROWSER_TARGETS=safari` uses Apple's `safaridriver`; enable remote automation on the test Mac and start the driver on port 4447. `SDK_BROWSER_TARGETS=edge` requires a real Edge installation. WebKit is not reported as Safari, nor Chromium as Edge.

Package checks install tarballs into a clean external consumer. Public package contents include the MIT license and bundled dependency/Unicode notices; private server packages and test fixtures are excluded. Keep React a peer dependency. Do not release until platform, failure, package and documentation gates have evidence.

## Performance method

Benchmarks use small, 10,000-key/50,000-value ICU, and near-100-MiB long-text profiles. Cold/cache startup uses 30 repetitions per profile. Lookups use 5,000 warm-up and 20,000 measured calls per repetition. Results include Node/Chromium versions, CPU, sample counts, p95/p99, memory, frame intervals and asset sizes. Loopback update timings include HTTP plus preparation and must not be presented as internet speed or a universal SLA.

Run normal application workloads alongside measurements. A successful throughput run alone does not establish an acceptable main-thread latency or leak budget. Keep failed or incomplete runs visible in the internal verification record.

## Upgrade and rollback

Pin the tested SDK and worker together. Run shared protocol/ICU fixtures and packed consumer tests before dependency upgrades. Review generated accessors against message contracts and keep the application's bundled messages available. Deploy the previous SDK and its matching worker to roll back application code; use a new catalog revision through publication rollback for translation content. Never bypass the revision floor by lowering a manifest version or clearing cache programmatically.

## Architecture

`localisync_sdk/core` owns prepared reading and lifecycle; `localisync_sdk` owns HTTP/verification, browser and Node workers/storage; optional `localisync_sdk/react` owns subscriptions/hydration; `localisync_sdk_generator` owns generation. Entry points keep Node code out of browser bundles. Reads do no I/O or parsing. Runtime data and diagnostics must not log read keys, translation bodies or parameter values.

## Cache format and debugging

Generation records contain signed catalogs/manifests, revision floors and content hashes. Locale bodies live in a separate IndexedDB object store or private Node blob files. Derived prepared messages are not persisted as a replacement for signed data. Startup verifies stored signatures, file sizes/hashes and application compatibility again. Node `writer.lock` contains only process/lease ownership, never credentials. Do not remove a live or ambiguous lock; stop the owning runtime and call `dispose()` before recovery.

For a reproducible report, include SDK/browser/Node versions, error code, package sizes and a synthetic input profile. Do not attach production translation bodies, read keys or request headers. `node sdks/web/tool/stress.mjs` exercises six successive near-limit releases, 100 pinned locale views per update and an offline restart. Its RSS includes the local fixture server and is not an isolated SDK allocation measurement.

`node sdks/web/tool/interaction-benchmark.mjs` uses 30 repetitions per profile with equally warmed input focus, then records five automated form edits during each update. These timings include browser automation overhead; they are not physical-device input latency.
