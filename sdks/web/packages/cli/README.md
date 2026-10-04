# localisync_sdk_generator

Localisync cli package. Version 0.1.0, MIT licensed.

This development tool is not published to npm. Its versioned archive accompanies
the Web SDK GitHub Release.
Use the Web SDK guides in the documentation site and the runnable examples under
`sdks/web/examples`. Packages require delivery protocol v1. The server adapter uses
Node 24; React integration targets React 19.2.4 and later 19.x releases.

Translations are read from prepared memory. Startup restores verified durable cache
and performs one bounded update; later checks are explicit. Never use management
credentials as distribution read keys. Worker assets must match the SDK version.

See `licenses/` for required third-party notices. Platform and performance evidence
is recorded separately; package availability is not production approval.

## Development-only generator

Install the versioned `localisync_sdk_generator-0.1.0.tgz` release asset as a development dependency alongside `localisync_sdk@0.1.0`. It runs on Node 24 and is not imported by application runtime code.

```sh
pnpm exec localisync generate messages.json generated
pnpm exec localisync download delivery-config.json generated-release
```

The first command validates local message JSON, including explicit language/fallback links and Plain/ICU contracts. The second verifies a published release using public delivery configuration and a read key from `LOCALISYNC_READ_KEY`. Do not put that key into source, generated files or command history.

Each command targets a new output directory. It emits `bundle.js`, `bundle.d.ts` and `messages.ts` with `typedTranslations(client)`. Real translation keys remain string literals; names are never silently renamed. Unknown keys and incorrect parameter types are rejected by TypeScript. Unsupported or inconsistent messages fail generation atomically. To update existing output, generate into a new directory, review the changes, then replace your previous generated directory.
