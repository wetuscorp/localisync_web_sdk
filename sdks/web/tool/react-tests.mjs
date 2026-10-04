import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, firefox, webkit } from '@playwright/test'
import { safariBrowser } from './safari.mjs'
import { ContentView, TranslationSnapshot, LocalisyncClient } from '../packages/web/dist/core.js'
import { dehydrate, serializeHydration } from '../packages/web/dist/react-server.js'
import assert from 'node:assert/strict'
const require = createRequire(new URL('../packages/web/package.json', import.meta.url)),
  React = require('react'),
  { renderToString } = require('react-dom/server'),
  { build } = require('esbuild')
const { LocalisyncProvider, useTranslation, useLocale } = await import('../packages/web/dist/react.js')
const output = resolve('.local/web-sdk-react')
await mkdir(output, { recursive: true })
const bundle = value => ({
  version: 1,
  releaseId: null,
  languages: [
    { locale: 'en', fallback: null },
    { locale: 'tr', fallback: 'en' }
  ],
  locales: ['en', 'tr'].map(locale => ({
    locale,
    entries: [
      { key: 'title', value: locale + value, format: 'plain', parameters: [], program: null },
      {
        key: 'items',
        format: 'icu',
        value: '{count, plural, one {# item} other {# items}}',
        parameters: [{ name: 'count', type: 'number' }],
        program: [
          {
            kind: 'plural',
            name: 'count',
            offset: 0,
            ordinal: false,
            options: {
              one: [{ kind: 'pound' }, { kind: 'text', value: ' item' }],
              other: [{ kind: 'pound' }, { kind: 'text', value: ' items' }]
            }
          }
        ]
      }
    ]
  }))
})
const initial = bundle(' bundled'),
  remote = bundle(' SSR <script>'),
  seed = dehydrate(
    new TranslationSnapshot('tr', new ContentView(remote, 'tr', 'remote'), new ContentView(initial, 'tr', 'bundle')),
    ['title', 'items']
  )
const serverClient = new LocalisyncClient(
  { bundle: initial, locale: 'en' },
  {
    restore: async () => null,
    refresh: async () => null,
    locale: async () => {
      throw Error()
    },
    commit: async () => ({ persisted: false }),
    dispose() {}
  }
)
function Content() {
  const { translate } = useTranslation(),
    { locale } = useLocale()
  return React.createElement(
    'main',
    null,
    React.createElement('h1', null, translate('title')),
    React.createElement('input', { 'aria-label': 'Draft', defaultValue: '' }),
    React.createElement('p', null, locale),
    React.createElement('span', null, translate('items', { count: 1000 }))
  )
}
const html = renderToString(
  React.createElement(
    LocalisyncProvider,
    { client: serverClient, initialSnapshot: seed, start: false },
    React.createElement(Content)
  )
)
assert(!html.includes('<script>'))
assert(!serializeHydration(seed).includes('<'))
const captures = await Promise.all(
  ['en', 'tr'].map(async locale => {
    const snapshot = serverClient.capture(locale)
    await Promise.resolve()
    return snapshot.translate('title')
  })
)
assert.deepEqual(captures, ['en bundled', 'tr bundled'])
await build({
  stdin: {
    resolveDir: resolve('sdks/web/examples/react'),
    loader: 'tsx',
    contents: `
import React from 'react';import {hydrateRoot,createRoot} from 'react-dom/client';import {LocalisyncClient} from 'localisync_sdk/core';import {LocalisyncProvider,useTranslation,useLocale} from 'localisync_sdk/react';
const initial=${JSON.stringify(initial)},seed=${serializeHydration(seed)};let checks=0,reads=0;
const driver={async restore(){reads++;return null},async refresh(locale){checks++;return {id:'candidate',revision:checks,locale,bundle:{...initial,releaseId:'release',locales:initial.locales.map(file=>({...file,entries:file.entries.map(entry=>({...entry,value:file.locale+' updated'}))}))}}},async locale(locale){return this.refresh(locale)},async commit(){return{persisted:true}},dispose(){}};
const client=new LocalisyncClient({bundle:initial,locale:'tr',checkOnStart:false},driver);
let renders=0;function Content(){renders++;const{translate}=useTranslation(),{locale}=useLocale();return <main><h1>{translate('title')}</h1><input aria-label='Draft' defaultValue=''/><p>{locale}</p><span>{translate('items',{count:1000})}</span></main>}
window.client=client;window.metrics=()=>({reads,checks,renders});window.recoveries=[];window.root=hydrateRoot(document.getElementById('root'),<React.StrictMode><LocalisyncProvider client={client} initialSnapshot={seed}><Content/></LocalisyncProvider></React.StrictMode>,{onRecoverableError:error=>window.recoveries.push(error.message)});
function Secondary(){const{translate}=useTranslation();return <h2>{translate('title')}</h2>}
window.mountSecondary=()=>{window.secondary=new LocalisyncClient({bundle:initial,locale:'en',checkOnStart:false},{...driver,restore:async()=>null}); window.secondRoot=createRoot(document.getElementById('secondary'));window.secondRoot.render(<LocalisyncProvider client={window.secondary} start={false}><Secondary/></LocalisyncProvider>)};
`
  },
  bundle: true,
  platform: 'browser',
  format: 'iife',
  outfile: output + '/app.js',
  define: { 'process.env.NODE_ENV': '"development"' }
})
const server = createServer(async (req, res) => {
  if (req.url === '/app.js') {
    res.setHeader('Content-Type', 'application/javascript')
    res.end(await readFile(output + '/app.js'))
  } else {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      '<!doctype html><html lang="en"><title>Localisync React acceptance</title><div id="root">' +
        html +
        '</div><div id="secondary"></div><script src="/app.js"></script></html>'
    )
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = 'http://127.0.0.1:' + server.address().port,
  results = []
try {
  for (const target of (process.env.SDK_BROWSER_TARGETS ?? 'chromium,firefox,webkit,chrome').split(',')) {
    const browser =
      target === 'safari'
        ? await safariBrowser()
        : await { chromium, chrome: chromium, edge: chromium, firefox, webkit }[target].launch({
            headless: true,
            ...(['chrome', 'edge'].includes(target) ? { channel: target === 'edge' ? 'msedge' : 'chrome' } : {})
          })
    try {
      const context = await browser.newContext(),
        page = await context.newPage()
      await page.goto(origin)
      await page.getByRole('heading').filter({ hasText: 'tr SSR <script>' }).waitFor()
      let metrics = await page.evaluate(async () => {
        await window.client.start()
        return window.metrics()
      })
      assert.equal(metrics.reads, 1)
      assert.equal(metrics.checks, 0)
      await page.evaluate(() => window.mountSecondary())
      await page.getByRole('heading').filter({ hasText: 'en bundled' }).waitFor()
      assert.equal(await page.evaluate(() => document.querySelector('#root span').textContent), '1.000 items')
      await page.evaluate(() => {
        const input = document.querySelector('input')
        input.value = 'keep draft'
        input.focus()
      })
      await page.evaluate(() => window.client.refresh())
      await page.getByRole('heading').filter({ hasText: 'tr updated' }).waitFor()
      assert.equal(await page.getByRole('textbox').inputValue(), 'keep draft')
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('input')), true)
      assert.deepEqual(await page.evaluate(() => window.recoveries), [])
      await page.evaluate(() => window.client.setLocale('en'))
      await page.getByRole('heading').filter({ hasText: 'en updated' }).waitFor()
      assert.equal(await page.evaluate(() => window.secondary.translate('title')), 'en bundled')
      assert.equal(await page.evaluate(() => window.secondary.getSnapshot().locale), 'en')
      await page.evaluate(async () => {
        window.secondRoot.unmount()
        await window.secondary.dispose()
        window.root.unmount()
        await window.client.dispose()
      })
      results.push({
        target,
        version: browser.version(),
        strictMode: true,
        hydration: true,
        requestLocales: true,
        icuHydration: true,
        independentProviders: true,
        form: true,
        focus: true,
        locale: true
      })
      await context.close()
    } finally {
      await browser.close()
    }
  }
} finally {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
  await serverClient.dispose()
}
await writeFile(
  output + '/results-' + (process.env.SDK_BROWSER_TARGETS ?? 'default') + '.json',
  JSON.stringify(results, null, 2)
)
console.info(results)
