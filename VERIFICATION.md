# Web SDK 0.1.0 release acceptance

Candidate preparation: 2026-10-04. Publication and hosted CI are not yet recorded
as completed. Source provenance is recorded separately in export-manifest.json.

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

## Remaining evidence

Performance revalidation and final versioned archives are being finalized. Hosted
Web CI is authorized and its first candidate run is pending. Real Edge and current Safari execution
for this release have not yet been recorded. WebKit is not Safari, and Chromium is
not Edge. Previous browser majors, physical mobile/minimum hardware, long-running
soak and production-network acceptance remain outside the executed local matrix.
No six-platform or production SLA claim follows from publication.
