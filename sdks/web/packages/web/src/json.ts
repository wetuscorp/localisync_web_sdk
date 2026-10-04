import { visit } from 'jsonc-parser'
import { LocalisyncError } from './core/index.js'

/** JSON.parse alone silently accepts duplicate object properties. */
export function strictJson(source: string, maxBytes: number): unknown {
  if (new TextEncoder().encode(source).byteLength > maxBytes)
    throw new LocalisyncError('verification', 'JSON exceeds the allowed size.')
  const stack: (Set<string> | null)[] = []
  const enter = (keys: Set<string> | null) => {
    if (stack.length >= 64) throw new LocalisyncError('verification', 'JSON nesting exceeds the allowed depth.')
    stack.push(keys)
  }
  visit(
    source,
    {
      onObjectBegin: () => enter(new Set()),
      onArrayBegin: () => enter(null),
      onObjectEnd: () => {
        stack.pop()
      },
      onArrayEnd: () => {
        stack.pop()
      },
      onObjectProperty: property => {
        const keys = stack.at(-1)
        if (!keys || keys.has(property) || ['__proto__', 'constructor', 'prototype'].includes(property))
          throw new LocalisyncError('verification', 'JSON contains duplicate or unsafe properties.')
        keys.add(property)
      },
      onError: () => {
        throw new LocalisyncError('verification', 'The document is not strict JSON.')
      }
    },
    { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false }
  )
  try {
    return JSON.parse(source)
  } catch {
    throw new LocalisyncError('verification', 'The document is not strict JSON.')
  }
}
