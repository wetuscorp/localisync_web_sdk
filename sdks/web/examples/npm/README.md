# Localisync npm example

Build the SDK first with `pnpm build:sdk:web`. Copy your distribution configuration
into `public/localisync.json` and add the channel read key, application version and
locale. This ignored file is public application configuration; never add management
credentials. Follow the Web SDK quick start for origin permissions and HTTPS.

Run `pnpm --filter @localisync/example-npm build`. Serve the output from your
own application origin. The worker is copied with the same SDK build. The script/npm/
React examples write `dist`; the Next example uses `next start`. Use
`build:static` for the Next static export. Missing configuration is shown as an
error; no distribution or credentials are invented.
