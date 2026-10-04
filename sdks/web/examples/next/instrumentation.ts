export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.LOCALISYNC_STATIC !== 'true') {
    const { startRuntime } = await import('./runtime')
    await startRuntime().catch(() => {
      console.error('Localisync example configuration is missing or invalid.')
    })
  }
}
