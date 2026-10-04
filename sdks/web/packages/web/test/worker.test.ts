import { describe, it, expect } from 'vitest'
import { WorkerDriver } from '../src/worker-driver.js'
import type { WorkerEndpoint } from '../src/worker-driver.js'
import type { Response, Command } from '../src/wire.js'
import { validateConfig } from '../src/config.js'
import { compileBundle } from '../src/compiler.js'
const config = validateConfig({
  projectId: '10000000-0000-4000-8000-000000000001',
  distributionId: '20000000-0000-4000-8000-000000000001',
  channel: 'preview',
  addresses: ['https://primary.localisync.test', 'https://secondary.localisync.test'],
  readKey: 'test-only',
  trustedKeys: { test: 'test-only' },
  appVersion: '1.0.0'
})
const bundle = compileBundle({
  version: 1,
  languages: [{ locale: 'en', fallback: null }],
  locales: [{ locale: 'en', entries: [] }]
})
class Endpoint implements WorkerEndpoint {
  receive: (value: unknown) => void = () => undefined
  error: () => void = () => undefined
  terminated = false
  commands: Command[] = []
  listen(receive: (value: unknown) => void, error: () => void) {
    this.receive = receive
    this.error = error
  }
  post(command: Command) {
    this.commands.push(command)
    let response: Response | undefined
    if (command.type === 'init' || command.type === 'contracts')
      response = { type: 'ready', version: '0.1.0', id: command.id }
    else if (command.type === 'dispose') response = { type: 'closed', id: command.id }
    else if (command.type === 'restore') response = { type: 'end', empty: true, id: command.id }
    if (response) queueMicrotask(() => this.receive(response))
  }
  terminate() {
    this.terminated = true
  }
}
describe('worker lifecycle isolation', () => {
  it('can retry after a transient worker constructor failure', async () => {
    let attempts = 0
    const endpoint = new Endpoint(),
      driver = new WorkerDriver(
        () => {
          if (++attempts === 1) throw Error('CSP')
          return endpoint
        },
        config,
        bundle
      )
    await expect(driver.restore('en')).rejects.toMatchObject({ code: 'worker' })
    expect(await driver.restore('en')).toBeNull()
    expect(attempts).toBe(2)
    await driver.dispose()
    expect(endpoint.terminated).toBe(true)
  })
  it('passes only bounded contract batches, without bundled text or ASTs', async () => {
    const large = compileBundle({
      version: 1,
      languages: [{ locale: 'en', fallback: null }],
      locales: [
        {
          locale: 'en',
          entries: Array.from({ length: 130 }, (_, i) => ({
            key: 'key_' + i,
            format: 'plain',
            parameters: [],
            value: 'x'.repeat(16000)
          }))
        }
      ]
    })
    const endpoint = new Endpoint(),
      driver = new WorkerDriver(() => endpoint, config, large)
    await driver.restore('en')
    const batches = endpoint.commands.filter(command => command.type === 'contracts')
    expect(batches.map(batch => batch.entries.length)).toEqual([64, 64, 2])
    expect(batches.every(batch => batch.entries.every(entry => entry.value === null && entry.program === null))).toBe(
      true
    )
    const initialization = endpoint.commands.find(command => command.type === 'init')
    expect(initialization?.bundle.locales).toEqual([])
    await driver.dispose()
  })
  it('ignores a stale worker error after replacing that worker', async () => {
    const endpoints = [new Endpoint(), new Endpoint()]
    let index = 0
    const driver = new WorkerDriver(
      () => {
        const endpoint = endpoints[index++]
        if (!endpoint) throw Error('Unexpected restart')
        return endpoint
      },
      config,
      bundle
    )
    await driver.restore('en')
    endpoints[0]?.error()
    await driver.restore('en')
    endpoints[0]?.error()
    expect(await driver.restore('en')).toBeNull()
    expect(index).toBe(2)
    expect(endpoints[1]?.terminated).toBe(false)
    await driver.dispose()
  })
})
