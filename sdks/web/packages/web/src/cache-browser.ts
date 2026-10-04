import { nextCache, storageError, cacheFiles, cacheReferences, hydrateCache, cacheStateSchema } from './cache.js'
import type { CacheState, CacheUpdate, DeliveryCache } from './cache.js'

/** Transactions compare the floor and publish the whole generation atomically across tabs. */
export class IndexedDbCache implements DeliveryCache {
  private database: Promise<IDBDatabase> | null = null
  private open() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      let abandoned = false
      const request = indexedDB.open('localisync-web-v1', 2)
      const timeout = setTimeout(() => {
        abandoned = true
        this.database = null
        reject(storageError())
      }, 3000)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('scopes')) request.result.createObjectStore('scopes')
        request.result.createObjectStore('objects')
      }
      request.onerror = request.onblocked = () => {
        clearTimeout(timeout)
        abandoned = true
        this.database = null
        reject(storageError())
      }
      request.onsuccess = () => {
        clearTimeout(timeout)
        const db = request.result
        if (abandoned) {
          db.close()
          return
        }
        db.onversionchange = () => {
          db.close()
          this.database = null
        }
        resolve(db)
      }
    }))
  }
  private hydrate(
    transaction: IDBTransaction,
    scope: string,
    input: unknown,
    complete: (state: CacheState | null) => void,
    fail: (error: unknown) => void
  ) {
    if (input === undefined) {
      complete(null)
      return
    }
    let state: CacheState
    try {
      state = cacheStateSchema.parse(input)
    } catch {
      fail(storageError())
      return
    }
    const files = cacheFiles(state),
      missing = [...files].filter(([, body]) => !body)
    if (!missing.length) {
      complete(state)
      return
    }
    let remaining = missing.length
    for (const [digest] of missing) {
      const request = transaction.objectStore('objects').get([scope, digest])
      request.onsuccess = () => {
        files.set(digest, typeof request.result === 'string' ? request.result : '')
        if (!--remaining) complete(hydrateCache(state, files))
      }
    }
  }
  async readFloor(scope: string) {
    const db = await this.open()
    return new Promise<CacheState['floor']>((resolve, reject) => {
      const transaction = db.transaction('scopes', 'readonly'),
        request = transaction.objectStore('scopes').get(scope)
      let result: CacheState['floor'] = null
      request.onsuccess = () => {
        try {
          result = request.result === undefined ? null : cacheStateSchema.parse(request.result).floor
        } catch {
          transaction.abort()
        }
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = transaction.onabort = () => reject(storageError())
    })
  }
  async read(scope: string): Promise<CacheState | null> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scopes', 'objects'], 'readonly'),
        request = transaction.objectStore('scopes').get(scope)
      let result: CacheState | null = null,
        cause: unknown
      request.onsuccess = () =>
        this.hydrate(
          transaction,
          scope,
          request.result,
          state => {
            result = state
          },
          error => {
            cause = error
            transaction.abort()
          }
        )
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = transaction.onabort = () => reject(cause ?? storageError())
    })
  }
  async write(scope: string, update: CacheUpdate): Promise<void> {
    const db = await this.open()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['scopes', 'objects'], 'readwrite'),
        store = transaction.objectStore('scopes'),
        objects = transaction.objectStore('objects'),
        request = store.get(scope)
      let cause: unknown
      const fail = (error: unknown) => {
        cause = error
        transaction.abort()
      }
      request.onsuccess = () => {
        if (!update.generation) {
          try {
            store.put(
              nextCache(request.result === undefined ? null : cacheStateSchema.parse(request.result), update),
              scope
            )
          } catch (error) {
            fail(error)
          }
          return
        }
        this.hydrate(
          transaction,
          scope,
          request.result,
          current => {
            try {
              const next = nextCache(current, update),
                files = cacheFiles(next),
                previousFiles = current ? cacheFiles(current) : new Map<string, string>()
              const inline =
                request.result === undefined
                  ? new Map<string, string>()
                  : cacheFiles(cacheStateSchema.parse(request.result))
              for (const [digest, body] of files)
                if (previousFiles.get(digest) !== body || inline.get(digest)) objects.put(body, [scope, digest])
              store.put(cacheReferences(next), scope)
              for (const digest of previousFiles.keys()) if (!files.has(digest)) objects.delete([scope, digest])
            } catch (error) {
              fail(error)
            }
          },
          fail
        )
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = transaction.onabort = () => reject(cause ?? storageError())
    })
  }
  async close() {
    const db = await this.database?.catch(() => null)
    db?.close()
    this.database = null
  }
}
