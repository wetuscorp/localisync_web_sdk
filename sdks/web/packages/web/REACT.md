# localisync_sdk/react

Localisync react package. Version 0.1.0, MIT licensed.

Source: https://github.com/wetuscorp/localisync_web_sdk. See the matching GitHub Release for tested platforms and release assets.
Use the Web SDK guides in the documentation site and the runnable examples under
`sdks/web/examples`. Packages require delivery protocol v1. The server adapter uses
Node 24; React integration targets React 19.2.4 and later 19.x releases.

Translations are read from prepared memory. Startup restores verified durable cache
and performs one bounded update; later checks are explicit. Never use management
credentials as distribution read keys. Worker assets must match the SDK version.

See `licenses/` for required third-party notices. Platform and performance evidence
is recorded separately; package availability is not production approval.

## Optional React integration

React 19.2.4–19.x is a peer dependency. Your application supplies both React and an independent Web SDK client.

```tsx
import { LocalisyncProvider, useTranslation } from 'localisync_sdk/react'
function Heading() {
  const { translate } = useTranslation()
  return <h1>{translate('welcome')}</h1>
}
function Application() {
  return (
    <LocalisyncProvider client={client}>
      <Heading />
    </LocalisyncProvider>
  )
}
```

`useLocale` changes instance locale; `useLocalisyncStatus` subscribes separately to lifecycle state. Keep the client stable and let the application own disposal. Strict Mode replays do not create extra startup checks. Do not dispose a stable client in an effect cleanup that React immediately replays.

For SSR, use `dehydrate`, `hydrate` and `serializeHydration` from `localisync_sdk/react/server`. Pass `initialSnapshot` to the provider so server HTML and first hydration agree. Capture one immutable server view per request; do not mutate a shared runtime's locale. Serialization selects requested keys and the relevant locale chain, not credentials or persistent cache trust.
