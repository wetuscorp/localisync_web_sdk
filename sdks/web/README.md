# Localisync Web SDK

`localisync_sdk` provides prepared, synchronous translations for JavaScript,
TypeScript, React and Node 24. Core, browser, DOM, React and server entry points
share one MIT package and delivery protocol v1. The first screen can use bundled
messages without waiting for the network. The default policy checks once at startup;
subsequent refresh and optional activation are explicit.

The source is prepared for the first public release. Availability is recorded in
the release verification record; a build alone is not a registry publication.

- [Quick start](https://docs.localisync.com/sdks/web/quick-start/)
- [Browser package](packages/web/README.md)
- [Core](packages/web/CORE.md) and [React](packages/web/REACT.md)
- [Development generator](packages/cli/README.md)
- Four integrations: [npm](examples/npm/README.md), [script](examples/script/README.md),
  [React](examples/react/README.md), [Next.js](examples/next/README.md).

From the repository root, use `pnpm install --frozen-lockfile` and `pnpm build:sdk:web`.
Run `pnpm test:sdk:web`, the browser/react/next/cli variants, and `pnpm sdk:web:pack`.
The package check installs archives in a clean external consumer without overrides.
`pnpm sdk:web:benchmark` records environment-specific measurements, not SLA guarantees.

The npm archive contains the runtime, public declarations and license notices.
The script ZIP contains matching `localisync.js` and `worker.js` plus checksums and
licenses. Host both on the application origin. The generator is a separate release
archive for development use; it is not installed by runtime consumers.

The canonical product monorepo exports only reviewed SDK files. Public contributions
must first be incorporated there and then exported; never edit exported provenance
or rewrite a published release tag. Production credentials and translations must
never be included in issues, fixtures or package artifacts.
