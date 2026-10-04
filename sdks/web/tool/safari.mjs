// Apple WebDriver automation sessions are separate from the user's normal browser session.
export async function safariBrowser(endpoint = 'http://127.0.0.1:4447') {
  let version = 'unknown'
  const call = async (session, method, path, body) => {
    const response = await fetch(endpoint + '/session' + session + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(45000)
    })
    const result = await response.json()
    if (!response.ok || result.value?.error)
      throw new Error(result.value?.message ?? 'Safari WebDriver request failed.')
    return result.value
  }
  const sessions = new Set()
  return {
    version: () => version,
    async newContext() {
      const created = await call('', 'POST', '', { capabilities: { alwaysMatch: { browserName: 'safari' } } })
      const session = '/' + created.sessionId
      version = created.capabilities.browserVersion
      sessions.add(session)
      await call(session, 'POST', '/timeouts', { script: 45000, pageLoad: 45000 })
      let first = true
      const pages = []
      const context = {
        async newPage() {
          const handle = first
            ? await call(session, 'GET', '/window')
            : (await call(session, 'POST', '/window/new', { type: 'tab' })).handle
          first = false
          const activate = () => call(session, 'POST', '/window', { handle })
          let errorHandler = () => undefined
          const page = {
            on(event, handler) {
              if (event === 'pageerror') errorHandler = handler
            },
            async goto(url) {
              await activate()
              await call(session, 'POST', '/url', { url })
              await call(session, 'POST', '/execute/sync', {
                script: 'window.__sdkErrors=[]; addEventListener("error",e=>window.__sdkErrors.push(e.message))',
                args: []
              })
            },
            async reload() {
              await activate()
              await call(session, 'POST', '/refresh', {})
              await call(session, 'POST', '/execute/sync', {
                script: 'window.__sdkErrors=[]; addEventListener("error",e=>window.__sdkErrors.push(e.message))',
                args: []
              })
            },
            async evaluate(fn, argument) {
              await activate()
              const result = await call(session, 'POST', '/execute/async', {
                script: `const done=arguments[arguments.length-1]; Promise.resolve((${fn.toString()})(arguments[0])).then(value=>done({value,errors:window.__sdkErrors||[]})).catch(error=>done({failure:String(error)}));`,
                args: [argument ?? null]
              })
              if (result.failure) throw new Error(result.failure)
              for (const message of result.errors) errorHandler(new Error(message))
              return result.value
            },
            getByRole(role) {
              return {
                inputValue: () => page.evaluate(() => document.querySelector('input').value),
                filter: ({ hasText }) => ({
                  waitFor: async () => {
                    const deadline = Date.now() + 10000
                    while (Date.now() < deadline) {
                      if (
                        await page.evaluate(
                          text =>
                            Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).some(
                              element => element.textContent === text
                            ),
                          hasText
                        )
                      )
                        return
                      await new Promise(resolve => setTimeout(resolve, 50))
                    }
                    throw new Error('Safari heading did not update: ' + role)
                  }
                })
              }
            }
          }
          pages.push(page)
          return page
        },
        async addCookies(cookies) {
          for (const cookie of cookies) {
            await pages[0].goto(cookie.url)
            await call(session, 'POST', '/cookie', { cookie: { name: cookie.name, value: cookie.value, path: '/' } })
          }
        },
        async close() {
          await call(session, 'DELETE', '')
          sessions.delete(session)
        }
      }
      return context
    },
    async close() {
      for (const session of sessions) await call(session, 'DELETE', '')
    }
  }
}
