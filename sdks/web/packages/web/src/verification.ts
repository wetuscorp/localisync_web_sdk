import { compactVerify, decodeProtectedHeader, importSPKI, base64url } from 'jose'
import { LocalisyncError } from './core/index.js'
import type { z } from 'zod'
import { strictJson } from './json.js'

const decoder = new TextDecoder('utf-8', { fatal: true })
export function decode(bytes: Uint8Array): string {
  try {
    return decoder.decode(bytes)
  } catch {
    throw new LocalisyncError('verification', 'Invalid UTF-8 content.')
  }
}
export async function digest(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes)
  const hash = await crypto.subtle.digest('SHA-256', copy)
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('')
}
export class Verifier {
  private readonly keys = new Map<string, Promise<CryptoKey>>()
  constructor(private readonly trusted: Readonly<Record<string, string>>) {}
  async verify<T>(jws: string, schema: z.ZodType<T>, limit: number): Promise<T> {
    try {
      if (jws.length > Math.ceil((limit * 4) / 3) + 4096) throw new Error('Size')
      strictJson(decode(base64url.decode(jws.split('.')[0] ?? '')), 4096)
      const header = decodeProtectedHeader(jws)
      if (
        header.alg !== 'EdDSA' ||
        header.typ !== 'localisync+json' ||
        typeof header.kid !== 'string' ||
        header.crit ||
        header.b64 === false ||
        !Object.hasOwn(this.trusted, header.kid)
      )
        throw new Error('Header')
      const pem = this.trusted[header.kid]
      if (!pem) throw new Error('Key')
      let key = this.keys.get(header.kid)
      if (!key) {
        key = importSPKI(pem, 'EdDSA')
        this.keys.set(header.kid, key)
      }
      const { payload } = await compactVerify(jws, await key, { algorithms: ['EdDSA'] })
      return schema.parse(strictJson(decode(payload), limit))
    } catch {
      throw new LocalisyncError('verification', 'Signed content failed verification.')
    }
  }
}
