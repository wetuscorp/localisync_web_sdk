# localisync_sdk/core

Localisync platform-independent core entry. Version 0.1.0, MIT licensed.

Source: https://github.com/wetuscorp/localisync_web_sdk. See the matching GitHub Release for tested platforms and release assets.
Use the Web SDK guides in the documentation site and the runnable examples under
`sdks/web/examples`. Packages require delivery protocol v1. The server adapter uses
Node 24; React integration targets React 19.2.4 and later 19.x releases.

Translations are read from prepared memory. Startup restores verified durable cache
and performs one bounded update; later checks are explicit. Never use management
credentials as distribution read keys. Worker assets must match the SDK version.

See `licenses/` for required third-party notices. Platform and performance evidence
is recorded separately; package availability is not production approval.

## Boundary

This entry has no external runtime dependencies and imports no DOM, React, filesystem or networking API. `PreparedBundle`, `ContentView`, `TranslationSnapshot` and `LocalisyncClient` provide compiled message lookup and instance-local state. Platform implementations supply an `UpdateDriver`; applications normally use `localisync_sdk` rather than construct an unverified driver.

`capture(locale)` returns a pinned, immutable request view. Its synchronous lookup performs no parsing or I/O. Fallback follows explicit bundle links; cardinal/ordinal rules use generated CLDR 48.2.1 data. Captured views throw typed errors for invalid arguments. Client lookups report the diagnostic and return a supplied default or key.
