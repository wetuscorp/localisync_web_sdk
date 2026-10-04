'use client'

import { createContext, createElement, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { LocalisyncClient, TranslationSnapshot } from '../core/index.js'
import { hydrate } from './server.js'
import type { HydrationSnapshot } from './server.js'

interface Context {
  client: LocalisyncClient
  initial: TranslationSnapshot
  seed: TranslationSnapshot
}
const LocalisyncContext = createContext<Context | null>(null)
export interface LocalisyncProviderProps {
  client: LocalisyncClient
  children: ReactNode
  initialSnapshot?: HydrationSnapshot
  start?: boolean
}
/** The application owns the client and disposes it when its runtime is destroyed. */
export function LocalisyncProvider({ client, children, initialSnapshot, start = true }: LocalisyncProviderProps) {
  const value = useMemo(() => {
    const initial = client.getSnapshot()
    return { client, initial, seed: initialSnapshot ? hydrate(initialSnapshot) : initial }
  }, [client, initialSnapshot])
  useEffect(() => {
    if (start) void client.start()
  }, [client, start])
  return createElement(LocalisyncContext.Provider, { value }, children)
}
function useRuntime() {
  const context = useContext(LocalisyncContext)
  if (!context) throw new Error('Add LocalisyncProvider above translation hooks.')
  return context
}
function useSnapshot() {
  const { client, initial, seed } = useRuntime()
  return useSyncExternalStore(
    client.subscribe,
    () => (client.getSnapshot() === initial ? seed : client.getSnapshot()),
    () => seed
  )
}
export function useTranslation() {
  const snapshot = useSnapshot()
  return useMemo(
    () => ({ translate: snapshot.translate.bind(snapshot), resolve: snapshot.resolve.bind(snapshot) }),
    [snapshot]
  )
}
export function useLocale() {
  const { client } = useRuntime(),
    snapshot = useSnapshot()
  return useMemo(
    () => ({ locale: snapshot.locale, setLocale: client.setLocale.bind(client) }),
    [client, snapshot.locale]
  )
}
export function useLocalisyncStatus() {
  const { client } = useRuntime()
  return useSyncExternalStore(client.subscribeStatus, client.getStatus, client.getStatus)
}
