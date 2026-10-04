# Localisync Web SDK

One `localisync_sdk` package for JavaScript, TypeScript, React and Node.js.
Prepared translations are synchronous; bundled and verified cached messages remain
available during delivery failures. Updates check once at startup, then on explicit
`refresh()` calls. React is optional. SDK code is MIT licensed.

- [Package and API](sdks/web/packages/web/README.md)
- [Core](sdks/web/packages/web/CORE.md) · [React](sdks/web/packages/web/REACT.md)
- [Guides](docs/guides/quick-start.md) · [Development generator](sdks/web/packages/cli/README.md)
- [npm example](sdks/web/examples/npm/README.md) · [script](sdks/web/examples/script/README.md)
- [React example](sdks/web/examples/react/README.md) · [Next.js](sdks/web/examples/next/README.md)

Use Node 24.16.0 and pnpm 11.5.0. Run `pnpm install --frozen-lockfile`,
`pnpm check`, `pnpm test:sdk:web`, and the `:browser`, `:react`, `:next`, `:cli`
variants. Install test browsers with `pnpm exec playwright install chromium firefox webkit chrome`.
`pnpm sdk:web:pack` verifies the published archive boundaries in a fresh application.
`pnpm sdk:web:benchmark` records measured behavior on the current machine, not an SLA.

The runtime archive excludes tests, fixture data and development tools. GitHub
Release assets also provide a matching self-hosted script/worker ZIP and a private
development-generator tarball. Serve the script and worker on your application
origin with matching versions; no shared CDN service is required.

## Contributions and releases

This repository is an explicit reviewed export from the canonical product source.
`export-manifest.json` records its source commit and file hashes. Contributions
must be incorporated into the canonical source and exported again. Do not change
provenance records independently or rewrite published version tags.

Do not attach secrets, management keys or production translation content to issues.
Use isolated examples and include version, platform and safe diagnostic codes.
See the verification record for executed checks and outstanding platform limits.
