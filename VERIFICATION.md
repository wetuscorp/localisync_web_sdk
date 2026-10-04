# Web SDK 0.1.0 release acceptance

Candidate preparation: 2026-10-04. Source provenance is recorded in
export-manifest.json. The version tag identifies the published source; its GitHub
Release links the successful same-commit CI run and matching archive hashes.
Preparation records alone do not establish registry publication.

## Executed local checks

- Node 24.16.0, pnpm 11.5.0, macOS arm64.
- Independent exported source: build, strict types, lint, formatting and 144 unit,
  shared ICU/protocol, worker, diagnostics and cache tests passed.
- Clean packed consumers without workspace overrides passed: framework-free install
  does not install React; public imports, shared client class identity, generated
  TypeScript positive/negative contracts and first offline translation are checked.
- Script/npm acceptance passed on Chromium 153.0.8010.12, Chrome 154.0.8037.95,
  Firefox 155.0 and WebKit 26.6. Each exercises failover, corrupt input, signed
  revision floors, offline cache, tab isolation, CSP/DOM safety and manual activation.
- React hydration, Strict Mode, locale isolation, ICU rendering and form/focus
  preservation passed on the same four browser engines/installations.
- Next.js 16.3.8 SSR used verified remote content; static output used bundled content.
  Hydration and form preservation passed. Signed generator download, failure
  isolation and refusal to overwrite existing output passed.
- Seven isolated PostgreSQL/two-node release integration tests passed with this SDK.
  Production infrastructure and customer data were not used.
- The standalone SDK dependency audit reported zero vulnerabilities. The product
  monorepo has two previously recorded high findings outside this standalone tree;
  they are not being represented as resolved by this SDK release.
- Export tests check explicit files, deterministic hashes, changed public files,
  path traversal/symlinks, Git metadata and refusal to release a dirty preview.

## Local performance revalidation

2026-10-04, Apple M2 Max, 64 GiB RAM, macOS arm64, Node 24.16.0,
headless Chromium 153.0.8010.12. Loopback HTTP, 30 cold/cache starts per profile;
5,000 lookup warmups and 20,000 measured lookups per repetition (600,000 samples
per profile). Download, verification, preparation, worker transfer and activation
are recorded separately by the benchmark tool. These are laboratory observations,
not internet timings, a controlled hardware comparison or service guarantees.

| Profile | Keys / values | Payload bytes | Browser cold/cache p95 ms | Node cold/cache p95 ms | Plain lookup p95/p99 µs | ICU lookup p95/p99 µs |
| --- | --- | --- | --- | --- | --- | --- |
| small | 100 / 500 | 82715 | 82.3 / 51.1 | 186.4 / 107.3 | 0.125 / 0.208 | 0.917 / 1.417 |
| icu | 10000 / 50000 | 8772215 | 1090.0 / 1023.7 | 1448.2 / 1382.0 | 0.125 / 0.167 | 0.959 / 1.166 |
| long | 10000 / 50000 | 99729725 | 1805.8 / 1645.9 | 2991.5 / 2866.4 | 0.125 / 0.167 | Plain-only profile |

The measured maximum frame interval was 16.8 ms, matching the control, with no
reported browser long tasks in these samples. Browser heap/storage estimates are
approximate and may be quantized or compressed. Node RSS includes the benchmark
fixture/server and retained runtime allocations, so it is not an SDK-only heap
measurement. The large-profile six-update test preserved 100 pinned views per
update and a verified offline restart. Process RSS ranged from 1.43 to 1.71 GB;
this short run does not establish a leak-free long-running service. Worker/cache
failure and disposal boundaries are also covered by acceptance tests.

Warm-focus interaction checks used 30 control inputs and 150 active inputs per
profile. Control/active p95 automation round-trip times were 1.89/6.95 ms (small),
1.50/3.65 ms (ICU), and 2.08/2.42 ms (large). Large/ICU probes ran during checking;
the small payload was already ready. These include browser automation overhead,
not a real-user interaction percentile.

## Public CI release gate

All six jobs must pass on the tagged candidate: Linux, macOS and Windows package
checks; Linux Chromium/Chrome/Firefox/WebKit, React and Next.js acceptance; and
separate real Safari/macOS and Edge/Windows acceptance. Result artifacts record
actual versions. No workflow publishes to npm. Initial Windows runs exposed the
native pnpm launcher and GNU tar drive-letter handling in release tools; these
were corrected before publication, without skipping Windows checks.

## Remaining platform limits

WebKit is not Safari, and Chromium is not Edge. Previous browser majors, physical mobile/minimum hardware, long-running
soak and production-network acceptance remain outside the executed local matrix.
No six-platform or production SLA claim follows from publication.
