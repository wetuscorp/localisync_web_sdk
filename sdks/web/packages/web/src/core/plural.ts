import { cardinalRules, ordinalRules, languageAliases } from './cldr.js'
import { LocalisyncError } from './types.js'

export interface Operands {
  n: number
  i: number
  v: number
  w: number
  f: number
  t: number
  c: number
  e: number
}
function operands(value: number): Operands {
  if (!Number.isFinite(value)) throw new LocalisyncError('arguments', 'Message numbers must be finite.')
  const n = Math.abs(value)
  let decimal = String(n)
  if (decimal.includes('e')) {
    const [coefficient = '', exponent = '0'] = decimal.split('e')
    const [integer = '', fraction = ''] = coefficient.split('.')
    const digits = integer + fraction,
      point = integer.length + Number(exponent)
    decimal =
      point <= 0
        ? '0.' + '0'.repeat(-point) + digits
        : point >= digits.length
          ? digits + '0'.repeat(point - digits.length)
          : digits.slice(0, point) + '.' + digits.slice(point)
  }
  const fraction = (decimal.split('.')[1] ?? '').replace(/0+$/, '')
  return {
    n,
    i: Math.floor(n),
    v: fraction.length,
    w: fraction.length,
    f: Number(fraction),
    t: Number(fraction),
    c: 0,
    e: 0
  }
}
export function pluralCategory(locale: string, value: number, ordinal: boolean): string {
  const rules = ordinal ? ordinalRules : cardinalRules
  const parts = locale.replaceAll('_', '-').split('-')
  if (parts.length > 2 && /^[A-Za-z]{4}$/.test(parts[1] ?? '')) parts.splice(1, 1)
  const base = parts[0] ?? ''
  let cursor = languageAliases[parts.join('-')] ?? [languageAliases[base] ?? base, ...parts.slice(1)].join('-')
  const o = operands(value)
  while (cursor) {
    const rule = rules[cursor]
    if (rule) return rule(o)
    const hyphen = cursor.lastIndexOf('-')
    if (hyphen < 0) break
    cursor = cursor.slice(0, hyphen)
  }
  return 'other'
}
