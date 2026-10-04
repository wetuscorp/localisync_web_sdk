// Generated from verified Unicode CLDR 48.2.1; run tool/generate_cldr.py.
// See licenses/Unicode-LICENSE.txt.
import type { Operands } from './plural.js'
type Rule = (o: Operands) => string
const cardinal0: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  return 'other'
}
const cardinal1: Rule = (o: Operands) => {
  if (Number.isInteger(o.n) && o.n >= 0 && o.n <= 1) return 'one'
  return 'other'
}
const cardinal2: Rule = (o: Operands) => {
  if (o.i === 0 || o.n === 1) return 'one'
  return 'other'
}
const cardinal3: Rule = (o: Operands) => {
  if (o.n === 0) return 'zero'
  if (o.n === 1) return 'one'
  if (o.n === 2) return 'two'
  if (Number.isInteger(o.n % 100) && o.n % 100 >= 3 && o.n % 100 <= 10) return 'few'
  if (Number.isInteger(o.n % 100) && o.n % 100 >= 11 && o.n % 100 <= 99) return 'many'
  return 'other'
}
const cardinal4: Rule = (o: Operands) => {
  if (o.i === 1 && o.v === 0) return 'one'
  return 'other'
}
const cardinal5: Rule = (o: Operands) => {
  if (o.n % 10 === 1 && !(o.n % 100 === 11)) return 'one'
  if (
    Number.isInteger(o.n % 10) &&
    o.n % 10 >= 2 &&
    o.n % 10 <= 4 &&
    !(Number.isInteger(o.n % 100) && o.n % 100 >= 12 && o.n % 100 <= 14)
  )
    return 'few'
  if (
    o.n % 10 === 0 ||
    (Number.isInteger(o.n % 10) && o.n % 10 >= 5 && o.n % 10 <= 9) ||
    (Number.isInteger(o.n % 100) && o.n % 100 >= 11 && o.n % 100 <= 14)
  )
    return 'many'
  return 'other'
}
const cardinal6: Rule = (o: Operands) => {
  if (o.n === 0) return 'zero'
  if (o.n === 1) return 'one'
  return 'other'
}
const cardinal7: Rule = () => {
  return 'other'
}
const cardinal8: Rule = (o: Operands) => {
  if (o.n % 10 === 1 && !(o.n % 100 === 11 || o.n % 100 === 71 || o.n % 100 === 91)) return 'one'
  if (o.n % 10 === 2 && !(o.n % 100 === 12 || o.n % 100 === 72 || o.n % 100 === 92)) return 'two'
  if (
    Number.isInteger(o.n % 10) &&
    ((o.n % 10 >= 3 && o.n % 10 <= 4) || o.n % 10 === 9) &&
    !(
      Number.isInteger(o.n % 100) &&
      ((o.n % 100 >= 10 && o.n % 100 <= 19) ||
        (o.n % 100 >= 70 && o.n % 100 <= 79) ||
        (o.n % 100 >= 90 && o.n % 100 <= 99))
    )
  )
    return 'few'
  if (!(o.n === 0) && o.n % 1000000 === 0) return 'many'
  return 'other'
}
const cardinal9: Rule = (o: Operands) => {
  if ((o.v === 0 && o.i % 10 === 1 && !(o.i % 100 === 11)) || (o.f % 10 === 1 && !(o.f % 100 === 11))) return 'one'
  if (
    (o.v === 0 &&
      Number.isInteger(o.i % 10) &&
      o.i % 10 >= 2 &&
      o.i % 10 <= 4 &&
      !(Number.isInteger(o.i % 100) && o.i % 100 >= 12 && o.i % 100 <= 14)) ||
    (Number.isInteger(o.f % 10) &&
      o.f % 10 >= 2 &&
      o.f % 10 <= 4 &&
      !(Number.isInteger(o.f % 100) && o.f % 100 >= 12 && o.f % 100 <= 14))
  )
    return 'few'
  return 'other'
}
const cardinal10: Rule = (o: Operands) => {
  if (o.i === 1 && o.v === 0) return 'one'
  if (
    (o.e === 0 && !(o.i === 0) && o.i % 1000000 === 0 && o.v === 0) ||
    !(Number.isInteger(o.e) && o.e >= 0 && o.e <= 5)
  )
    return 'many'
  return 'other'
}
const cardinal11: Rule = (o: Operands) => {
  if (
    (o.v === 0 && (o.i === 1 || o.i === 2 || o.i === 3)) ||
    (o.v === 0 && !(o.i % 10 === 4 || o.i % 10 === 6 || o.i % 10 === 9)) ||
    (!(o.v === 0) && !(o.f % 10 === 4 || o.f % 10 === 6 || o.f % 10 === 9))
  )
    return 'one'
  return 'other'
}
const cardinal12: Rule = (o: Operands) => {
  if (o.i === 1 && o.v === 0) return 'one'
  if (Number.isInteger(o.i) && o.i >= 2 && o.i <= 4 && o.v === 0) return 'few'
  if (!(o.v === 0)) return 'many'
  return 'other'
}
const cardinal13: Rule = (o: Operands) => {
  if (o.n === 0) return 'zero'
  if (o.n === 1) return 'one'
  if (o.n === 2) return 'two'
  if (o.n === 3) return 'few'
  if (o.n === 6) return 'many'
  return 'other'
}
const cardinal14: Rule = (o: Operands) => {
  if (o.n === 1 || (!(o.t === 0) && (o.i === 0 || o.i === 1))) return 'one'
  return 'other'
}
const cardinal15: Rule = (o: Operands) => {
  if ((o.v === 0 && o.i % 100 === 1) || o.f % 100 === 1) return 'one'
  if ((o.v === 0 && o.i % 100 === 2) || o.f % 100 === 2) return 'two'
  if (
    (o.v === 0 && Number.isInteger(o.i % 100) && o.i % 100 >= 3 && o.i % 100 <= 4) ||
    (Number.isInteger(o.f % 100) && o.f % 100 >= 3 && o.f % 100 <= 4)
  )
    return 'few'
  return 'other'
}
const cardinal16: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  if (
    (o.e === 0 && !(o.i === 0) && o.i % 1000000 === 0 && o.v === 0) ||
    !(Number.isInteger(o.e) && o.e >= 0 && o.e <= 5)
  )
    return 'many'
  return 'other'
}
const cardinal17: Rule = (o: Operands) => {
  if (o.i === 0 || o.i === 1) return 'one'
  return 'other'
}
const cardinal18: Rule = (o: Operands) => {
  if (o.i === 0 || o.i === 1) return 'one'
  if (
    (o.e === 0 && !(o.i === 0) && o.i % 1000000 === 0 && o.v === 0) ||
    !(Number.isInteger(o.e) && o.e >= 0 && o.e <= 5)
  )
    return 'many'
  return 'other'
}
const cardinal19: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  if (o.n === 2) return 'two'
  if (Number.isInteger(o.n) && o.n >= 3 && o.n <= 6) return 'few'
  if (Number.isInteger(o.n) && o.n >= 7 && o.n <= 10) return 'many'
  return 'other'
}
const cardinal20: Rule = (o: Operands) => {
  if (o.n === 1 || o.n === 11) return 'one'
  if (o.n === 2 || o.n === 12) return 'two'
  if (Number.isInteger(o.n) && ((o.n >= 3 && o.n <= 10) || (o.n >= 13 && o.n <= 19))) return 'few'
  return 'other'
}
const cardinal21: Rule = (o: Operands) => {
  if (o.v === 0 && o.i % 10 === 1) return 'one'
  if (o.v === 0 && o.i % 10 === 2) return 'two'
  if (o.v === 0 && (o.i % 100 === 0 || o.i % 100 === 20 || o.i % 100 === 40 || o.i % 100 === 60 || o.i % 100 === 80))
    return 'few'
  if (!(o.v === 0)) return 'many'
  return 'other'
}
const cardinal22: Rule = (o: Operands) => {
  if ((o.i === 1 && o.v === 0) || (o.i === 0 && !(o.v === 0))) return 'one'
  if (o.i === 2 && o.v === 0) return 'two'
  return 'other'
}
const cardinal23: Rule = (o: Operands) => {
  if ((o.t === 0 && o.i % 10 === 1 && !(o.i % 100 === 11)) || (o.t % 10 === 1 && !(o.t % 100 === 11))) return 'one'
  return 'other'
}
const cardinal24: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  if (o.n === 2) return 'two'
  return 'other'
}
const cardinal25: Rule = (o: Operands) => {
  if (o.n === 0) return 'zero'
  if (o.n === 1) return 'one'
  if (
    o.n % 100 === 2 ||
    o.n % 100 === 22 ||
    o.n % 100 === 42 ||
    o.n % 100 === 62 ||
    o.n % 100 === 82 ||
    (o.n % 1000 === 0 &&
      Number.isInteger(o.n % 100000) &&
      ((o.n % 100000 >= 1000 && o.n % 100000 <= 20000) ||
        o.n % 100000 === 40000 ||
        o.n % 100000 === 60000 ||
        o.n % 100000 === 80000)) ||
    (!(o.n === 0) && o.n % 1000000 === 100000)
  )
    return 'two'
  if (o.n % 100 === 3 || o.n % 100 === 23 || o.n % 100 === 43 || o.n % 100 === 63 || o.n % 100 === 83) return 'few'
  if (!(o.n === 1) && (o.n % 100 === 1 || o.n % 100 === 21 || o.n % 100 === 41 || o.n % 100 === 61 || o.n % 100 === 81))
    return 'many'
  return 'other'
}
const cardinal26: Rule = (o: Operands) => {
  if (o.n === 0) return 'zero'
  if ((o.i === 0 || o.i === 1) && !(o.n === 0)) return 'one'
  return 'other'
}
const cardinal27: Rule = (o: Operands) => {
  if (o.n % 10 === 1 && !(Number.isInteger(o.n % 100) && o.n % 100 >= 11 && o.n % 100 <= 19)) return 'one'
  if (
    Number.isInteger(o.n % 10) &&
    o.n % 10 >= 2 &&
    o.n % 10 <= 9 &&
    !(Number.isInteger(o.n % 100) && o.n % 100 >= 11 && o.n % 100 <= 19)
  )
    return 'few'
  if (!(o.f === 0)) return 'many'
  return 'other'
}
const cardinal28: Rule = (o: Operands) => {
  if (
    o.n % 10 === 0 ||
    (Number.isInteger(o.n % 100) && o.n % 100 >= 11 && o.n % 100 <= 19) ||
    (o.v === 2 && Number.isInteger(o.f % 100) && o.f % 100 >= 11 && o.f % 100 <= 19)
  )
    return 'zero'
  if (
    (o.n % 10 === 1 && !(o.n % 100 === 11)) ||
    (o.v === 2 && o.f % 10 === 1 && !(o.f % 100 === 11)) ||
    (!(o.v === 2) && o.f % 10 === 1)
  )
    return 'one'
  return 'other'
}
const cardinal29: Rule = (o: Operands) => {
  if ((o.v === 0 && o.i % 10 === 1 && !(o.i % 100 === 11)) || (o.f % 10 === 1 && !(o.f % 100 === 11))) return 'one'
  return 'other'
}
const cardinal30: Rule = (o: Operands) => {
  if (o.i === 1 && o.v === 0) return 'one'
  if (!(o.v === 0) || o.n === 0 || (!(o.n === 1) && Number.isInteger(o.n % 100) && o.n % 100 >= 1 && o.n % 100 <= 19))
    return 'few'
  return 'other'
}
const cardinal31: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  if (o.n === 2) return 'two'
  if (o.n === 0 || (Number.isInteger(o.n % 100) && o.n % 100 >= 3 && o.n % 100 <= 10)) return 'few'
  if (Number.isInteger(o.n % 100) && o.n % 100 >= 11 && o.n % 100 <= 19) return 'many'
  return 'other'
}
const cardinal32: Rule = (o: Operands) => {
  if (o.i === 1 && o.v === 0) return 'one'
  if (
    o.v === 0 &&
    Number.isInteger(o.i % 10) &&
    o.i % 10 >= 2 &&
    o.i % 10 <= 4 &&
    !(Number.isInteger(o.i % 100) && o.i % 100 >= 12 && o.i % 100 <= 14)
  )
    return 'few'
  if (
    (o.v === 0 && !(o.i === 1) && Number.isInteger(o.i % 10) && o.i % 10 >= 0 && o.i % 10 <= 1) ||
    (o.v === 0 && Number.isInteger(o.i % 10) && o.i % 10 >= 5 && o.i % 10 <= 9) ||
    (o.v === 0 && Number.isInteger(o.i % 100) && o.i % 100 >= 12 && o.i % 100 <= 14)
  )
    return 'many'
  return 'other'
}
const cardinal33: Rule = (o: Operands) => {
  if (Number.isInteger(o.i) && o.i >= 0 && o.i <= 1) return 'one'
  if (
    (o.e === 0 && !(o.i === 0) && o.i % 1000000 === 0 && o.v === 0) ||
    !(Number.isInteger(o.e) && o.e >= 0 && o.e <= 5)
  )
    return 'many'
  return 'other'
}
const cardinal34: Rule = (o: Operands) => {
  if (o.v === 0 && o.i % 10 === 1 && !(o.i % 100 === 11)) return 'one'
  if (
    o.v === 0 &&
    Number.isInteger(o.i % 10) &&
    o.i % 10 >= 2 &&
    o.i % 10 <= 4 &&
    !(Number.isInteger(o.i % 100) && o.i % 100 >= 12 && o.i % 100 <= 14)
  )
    return 'few'
  if (
    (o.v === 0 && o.i % 10 === 0) ||
    (o.v === 0 && Number.isInteger(o.i % 10) && o.i % 10 >= 5 && o.i % 10 <= 9) ||
    (o.v === 0 && Number.isInteger(o.i % 100) && o.i % 100 >= 11 && o.i % 100 <= 14)
  )
    return 'many'
  return 'other'
}
const cardinal35: Rule = (o: Operands) => {
  if (o.n % 10 === 1 && !(o.n % 100 === 11)) return 'one'
  if (o.n === 2) return 'two'
  if (
    !(o.n === 2) &&
    Number.isInteger(o.n % 10) &&
    o.n % 10 >= 2 &&
    o.n % 10 <= 9 &&
    !(Number.isInteger(o.n % 100) && o.n % 100 >= 11 && o.n % 100 <= 19)
  )
    return 'few'
  if (!(o.f === 0)) return 'many'
  return 'other'
}
const cardinal36: Rule = (o: Operands) => {
  if (o.i === 0 || o.n === 1) return 'one'
  if (Number.isInteger(o.n) && o.n >= 2 && o.n <= 10) return 'few'
  return 'other'
}
const cardinal37: Rule = (o: Operands) => {
  if (o.n === 0 || o.n === 1 || (o.i === 0 && o.f === 1)) return 'one'
  return 'other'
}
const cardinal38: Rule = (o: Operands) => {
  if (o.v === 0 && o.i % 100 === 1) return 'one'
  if (o.v === 0 && o.i % 100 === 2) return 'two'
  if ((o.v === 0 && Number.isInteger(o.i % 100) && o.i % 100 >= 3 && o.i % 100 <= 4) || !(o.v === 0)) return 'few'
  return 'other'
}
const cardinal39: Rule = (o: Operands) => {
  if ((Number.isInteger(o.n) && o.n >= 0 && o.n <= 1) || (Number.isInteger(o.n) && o.n >= 11 && o.n <= 99)) return 'one'
  return 'other'
}
export const cardinalRules: Readonly<Record<string, Rule>> = {
  af: cardinal0,
  an: cardinal0,
  asa: cardinal0,
  az: cardinal0,
  bal: cardinal0,
  bem: cardinal0,
  bez: cardinal0,
  bg: cardinal0,
  brx: cardinal0,
  ce: cardinal0,
  cgg: cardinal0,
  chr: cardinal0,
  ckb: cardinal0,
  dv: cardinal0,
  ee: cardinal0,
  el: cardinal0,
  eo: cardinal0,
  eu: cardinal0,
  fo: cardinal0,
  fur: cardinal0,
  gsw: cardinal0,
  ha: cardinal0,
  haw: cardinal0,
  hu: cardinal0,
  jgo: cardinal0,
  jmc: cardinal0,
  ka: cardinal0,
  kaj: cardinal0,
  kcg: cardinal0,
  kk: cardinal0,
  kkj: cardinal0,
  kl: cardinal0,
  ks: cardinal0,
  ksb: cardinal0,
  ku: cardinal0,
  ky: cardinal0,
  lb: cardinal0,
  lg: cardinal0,
  mas: cardinal0,
  mgo: cardinal0,
  ml: cardinal0,
  mn: cardinal0,
  mr: cardinal0,
  nah: cardinal0,
  nb: cardinal0,
  nd: cardinal0,
  ne: cardinal0,
  nn: cardinal0,
  nnh: cardinal0,
  no: cardinal0,
  nr: cardinal0,
  ny: cardinal0,
  nyn: cardinal0,
  om: cardinal0,
  or: cardinal0,
  os: cardinal0,
  pap: cardinal0,
  ps: cardinal0,
  rm: cardinal0,
  rof: cardinal0,
  rwk: cardinal0,
  saq: cardinal0,
  sd: cardinal0,
  sdh: cardinal0,
  seh: cardinal0,
  sn: cardinal0,
  so: cardinal0,
  sq: cardinal0,
  ss: cardinal0,
  ssy: cardinal0,
  st: cardinal0,
  syr: cardinal0,
  ta: cardinal0,
  te: cardinal0,
  teo: cardinal0,
  tig: cardinal0,
  tk: cardinal0,
  tn: cardinal0,
  tr: cardinal0,
  ts: cardinal0,
  ug: cardinal0,
  uz: cardinal0,
  ve: cardinal0,
  vo: cardinal0,
  vun: cardinal0,
  wae: cardinal0,
  xh: cardinal0,
  xog: cardinal0,
  ak: cardinal1,
  bho: cardinal1,
  csw: cardinal1,
  guw: cardinal1,
  ln: cardinal1,
  mg: cardinal1,
  nso: cardinal1,
  pa: cardinal1,
  ti: cardinal1,
  wa: cardinal1,
  am: cardinal2,
  as: cardinal2,
  bn: cardinal2,
  doi: cardinal2,
  fa: cardinal2,
  gu: cardinal2,
  hi: cardinal2,
  kn: cardinal2,
  kok: cardinal2,
  'kok-Latn': cardinal2,
  pcm: cardinal2,
  zu: cardinal2,
  ar: cardinal3,
  ars: cardinal3,
  ast: cardinal4,
  de: cardinal4,
  en: cardinal4,
  et: cardinal4,
  fi: cardinal4,
  fy: cardinal4,
  gl: cardinal4,
  ia: cardinal4,
  ie: cardinal4,
  io: cardinal4,
  lij: cardinal4,
  nl: cardinal4,
  sc: cardinal4,
  sv: cardinal4,
  sw: cardinal4,
  ur: cardinal4,
  yi: cardinal4,
  be: cardinal5,
  blo: cardinal6,
  cv: cardinal6,
  ksh: cardinal6,
  bm: cardinal7,
  bo: cardinal7,
  dz: cardinal7,
  hnj: cardinal7,
  id: cardinal7,
  ig: cardinal7,
  ii: cardinal7,
  ja: cardinal7,
  jbo: cardinal7,
  jv: cardinal7,
  jw: cardinal7,
  kde: cardinal7,
  kea: cardinal7,
  km: cardinal7,
  ko: cardinal7,
  lkt: cardinal7,
  lo: cardinal7,
  ms: cardinal7,
  my: cardinal7,
  nqo: cardinal7,
  osa: cardinal7,
  sah: cardinal7,
  ses: cardinal7,
  sg: cardinal7,
  su: cardinal7,
  th: cardinal7,
  to: cardinal7,
  tpi: cardinal7,
  und: cardinal7,
  vi: cardinal7,
  wo: cardinal7,
  yo: cardinal7,
  yue: cardinal7,
  zh: cardinal7,
  br: cardinal8,
  bs: cardinal9,
  hr: cardinal9,
  sh: cardinal9,
  sr: cardinal9,
  ca: cardinal10,
  it: cardinal10,
  lld: cardinal10,
  'pt-PT': cardinal10,
  scn: cardinal10,
  vec: cardinal10,
  ceb: cardinal11,
  fil: cardinal11,
  tl: cardinal11,
  cs: cardinal12,
  sk: cardinal12,
  cy: cardinal13,
  da: cardinal14,
  dsb: cardinal15,
  hsb: cardinal15,
  es: cardinal16,
  ff: cardinal17,
  hy: cardinal17,
  kab: cardinal17,
  fr: cardinal18,
  ga: cardinal19,
  gd: cardinal20,
  gv: cardinal21,
  he: cardinal22,
  is: cardinal23,
  iu: cardinal24,
  naq: cardinal24,
  sat: cardinal24,
  se: cardinal24,
  sma: cardinal24,
  smi: cardinal24,
  smj: cardinal24,
  smn: cardinal24,
  sms: cardinal24,
  kw: cardinal25,
  lag: cardinal26,
  lt: cardinal27,
  lv: cardinal28,
  prg: cardinal28,
  mk: cardinal29,
  mo: cardinal30,
  ro: cardinal30,
  mt: cardinal31,
  pl: cardinal32,
  pt: cardinal33,
  ru: cardinal34,
  uk: cardinal34,
  sgs: cardinal35,
  shi: cardinal36,
  si: cardinal37,
  sl: cardinal38,
  tzm: cardinal39
}
const ordinal0: Rule = () => {
  return 'other'
}
const ordinal1: Rule = (o: Operands) => {
  if (o.n === 1 || o.n === 5 || o.n === 7 || o.n === 8 || o.n === 9 || o.n === 10) return 'one'
  if (o.n === 2 || o.n === 3) return 'two'
  if (o.n === 4) return 'few'
  if (o.n === 6) return 'many'
  return 'other'
}
const ordinal2: Rule = (o: Operands) => {
  if (
    o.i % 10 === 1 ||
    o.i % 10 === 2 ||
    o.i % 10 === 5 ||
    o.i % 10 === 7 ||
    o.i % 10 === 8 ||
    o.i % 100 === 20 ||
    o.i % 100 === 50 ||
    o.i % 100 === 70 ||
    o.i % 100 === 80
  )
    return 'one'
  if (
    o.i % 10 === 3 ||
    o.i % 10 === 4 ||
    o.i % 1000 === 100 ||
    o.i % 1000 === 200 ||
    o.i % 1000 === 300 ||
    o.i % 1000 === 400 ||
    o.i % 1000 === 500 ||
    o.i % 1000 === 600 ||
    o.i % 1000 === 700 ||
    o.i % 1000 === 800 ||
    o.i % 1000 === 900
  )
    return 'few'
  if (o.i === 0 || o.i % 10 === 6 || o.i % 100 === 40 || o.i % 100 === 60 || o.i % 100 === 90) return 'many'
  return 'other'
}
const ordinal3: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  return 'other'
}
const ordinal4: Rule = (o: Operands) => {
  if ((o.n % 10 === 2 || o.n % 10 === 3) && !(o.n % 100 === 12 || o.n % 100 === 13)) return 'few'
  return 'other'
}
const ordinal5: Rule = (o: Operands) => {
  if (o.i === 0) return 'zero'
  if (o.i === 1) return 'one'
  if (o.i === 2 || o.i === 3 || o.i === 4 || o.i === 5 || o.i === 6) return 'few'
  return 'other'
}
const ordinal6: Rule = (o: Operands) => {
  if (o.n === 1 || o.n === 3) return 'one'
  if (o.n === 2) return 'two'
  if (o.n === 4) return 'few'
  return 'other'
}
const ordinal7: Rule = (o: Operands) => {
  if (o.n === 0 || o.n === 7 || o.n === 8 || o.n === 9) return 'zero'
  if (o.n === 1) return 'one'
  if (o.n === 2) return 'two'
  if (o.n === 3 || o.n === 4) return 'few'
  if (o.n === 5 || o.n === 6) return 'many'
  return 'other'
}
const ordinal8: Rule = (o: Operands) => {
  if (o.n % 10 === 1 && !(o.n % 100 === 11)) return 'one'
  if (o.n % 10 === 2 && !(o.n % 100 === 12)) return 'two'
  if (o.n % 10 === 3 && !(o.n % 100 === 13)) return 'few'
  return 'other'
}
const ordinal9: Rule = (o: Operands) => {
  if (o.n === 1 || o.n === 11) return 'one'
  if (o.n === 2 || o.n === 12) return 'two'
  if (o.n === 3 || o.n === 13) return 'few'
  return 'other'
}
const ordinal10: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  if (o.n === 2 || o.n === 3) return 'two'
  if (o.n === 4) return 'few'
  if (o.n === 6) return 'many'
  return 'other'
}
const ordinal11: Rule = (o: Operands) => {
  if (o.n === 1 || o.n === 5) return 'one'
  return 'other'
}
const ordinal12: Rule = (o: Operands) => {
  if (o.n === 11 || o.n === 8 || o.n === 80 || o.n === 800) return 'many'
  return 'other'
}
const ordinal13: Rule = (o: Operands) => {
  if (o.i === 1) return 'one'
  if (
    o.i === 0 ||
    (Number.isInteger(o.i % 100) &&
      ((o.i % 100 >= 2 && o.i % 100 <= 20) || o.i % 100 === 40 || o.i % 100 === 60 || o.i % 100 === 80))
  )
    return 'many'
  return 'other'
}
const ordinal14: Rule = (o: Operands) => {
  if (o.n % 10 === 6 || o.n % 10 === 9 || (o.n % 10 === 0 && !(o.n === 0))) return 'many'
  return 'other'
}
const ordinal15: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  if (o.n === 2 || o.n === 3) return 'two'
  if (o.n === 4) return 'few'
  return 'other'
}
const ordinal16: Rule = (o: Operands) => {
  if (
    (Number.isInteger(o.n) && o.n >= 1 && o.n <= 4) ||
    (Number.isInteger(o.n % 100) &&
      ((o.n % 100 >= 1 && o.n % 100 <= 4) ||
        (o.n % 100 >= 21 && o.n % 100 <= 24) ||
        (o.n % 100 >= 41 && o.n % 100 <= 44) ||
        (o.n % 100 >= 61 && o.n % 100 <= 64) ||
        (o.n % 100 >= 81 && o.n % 100 <= 84)))
  )
    return 'one'
  if (o.n === 5 || o.n % 100 === 5) return 'many'
  return 'other'
}
const ordinal17: Rule = (o: Operands) => {
  if (Number.isInteger(o.n) && (o.n === 11 || o.n === 8 || (o.n >= 80 && o.n <= 89) || (o.n >= 800 && o.n <= 899)))
    return 'many'
  return 'other'
}
const ordinal18: Rule = (o: Operands) => {
  if (o.i % 10 === 1 && !(o.i % 100 === 11)) return 'one'
  if (o.i % 10 === 2 && !(o.i % 100 === 12)) return 'two'
  if ((o.i % 10 === 7 || o.i % 10 === 8) && !(o.i % 100 === 17 || o.i % 100 === 18)) return 'many'
  return 'other'
}
const ordinal19: Rule = (o: Operands) => {
  if (Number.isInteger(o.n) && o.n >= 1 && o.n <= 4) return 'one'
  return 'other'
}
const ordinal20: Rule = (o: Operands) => {
  if (Number.isInteger(o.n) && (o.n === 1 || o.n === 5 || (o.n >= 7 && o.n <= 9))) return 'one'
  if (o.n === 2 || o.n === 3) return 'two'
  if (o.n === 4) return 'few'
  if (o.n === 6) return 'many'
  return 'other'
}
const ordinal21: Rule = (o: Operands) => {
  if (o.n === 1) return 'one'
  if (o.n % 10 === 4 && !(o.n % 100 === 14)) return 'many'
  return 'other'
}
const ordinal22: Rule = (o: Operands) => {
  if ((o.n % 10 === 1 || o.n % 10 === 2) && !(o.n % 100 === 11 || o.n % 100 === 12)) return 'one'
  return 'other'
}
const ordinal23: Rule = (o: Operands) => {
  if (o.n % 10 === 6 || o.n % 10 === 9 || o.n === 10) return 'few'
  return 'other'
}
const ordinal24: Rule = (o: Operands) => {
  if (o.n % 10 === 3 && !(o.n % 100 === 13)) return 'few'
  return 'other'
}
export const ordinalRules: Readonly<Record<string, Rule>> = {
  af: ordinal0,
  am: ordinal0,
  an: ordinal0,
  ar: ordinal0,
  ast: ordinal0,
  bg: ordinal0,
  bs: ordinal0,
  ce: ordinal0,
  cs: ordinal0,
  cv: ordinal0,
  da: ordinal0,
  de: ordinal0,
  dsb: ordinal0,
  el: ordinal0,
  es: ordinal0,
  et: ordinal0,
  eu: ordinal0,
  fa: ordinal0,
  fi: ordinal0,
  fy: ordinal0,
  gl: ordinal0,
  gsw: ordinal0,
  he: ordinal0,
  hr: ordinal0,
  hsb: ordinal0,
  ia: ordinal0,
  id: ordinal0,
  ie: ordinal0,
  is: ordinal0,
  ja: ordinal0,
  km: ordinal0,
  kn: ordinal0,
  ko: ordinal0,
  ky: ordinal0,
  lt: ordinal0,
  lv: ordinal0,
  ml: ordinal0,
  mn: ordinal0,
  my: ordinal0,
  nb: ordinal0,
  nl: ordinal0,
  no: ordinal0,
  pa: ordinal0,
  pl: ordinal0,
  prg: ordinal0,
  ps: ordinal0,
  pt: ordinal0,
  ru: ordinal0,
  sd: ordinal0,
  sh: ordinal0,
  si: ordinal0,
  sk: ordinal0,
  sl: ordinal0,
  sr: ordinal0,
  sw: ordinal0,
  ta: ordinal0,
  te: ordinal0,
  th: ordinal0,
  tpi: ordinal0,
  tr: ordinal0,
  und: ordinal0,
  ur: ordinal0,
  uz: ordinal0,
  yue: ordinal0,
  zh: ordinal0,
  zu: ordinal0,
  as: ordinal1,
  bn: ordinal1,
  az: ordinal2,
  bal: ordinal3,
  fil: ordinal3,
  fr: ordinal3,
  ga: ordinal3,
  hy: ordinal3,
  lo: ordinal3,
  mo: ordinal3,
  ms: ordinal3,
  ro: ordinal3,
  tl: ordinal3,
  vi: ordinal3,
  be: ordinal4,
  blo: ordinal5,
  ca: ordinal6,
  cy: ordinal7,
  en: ordinal8,
  gd: ordinal9,
  gu: ordinal10,
  hi: ordinal10,
  hu: ordinal11,
  it: ordinal12,
  lld: ordinal12,
  sc: ordinal12,
  vec: ordinal12,
  ka: ordinal13,
  kk: ordinal14,
  kok: ordinal15,
  'kok-Latn': ordinal15,
  mr: ordinal15,
  kw: ordinal16,
  lij: ordinal17,
  scn: ordinal17,
  mk: ordinal18,
  ne: ordinal19,
  or: ordinal20,
  sq: ordinal21,
  sv: ordinal22,
  tk: ordinal23,
  uk: ordinal24
}
export const languageAliases: Readonly<Record<string, string>> = {
  'aa-saaho': 'ssy',
  aam: 'aas',
  aar: 'aa',
  abk: 'ab',
  adp: 'dz',
  afr: 'af',
  agp: 'apf',
  ais: 'ami',
  ajp: 'apc',
  ajt: 'aeb',
  aju: 'jrb',
  aka: 'ak',
  alb: 'sq',
  als: 'sq',
  amh: 'am',
  ara: 'ar',
  arb: 'ar',
  arg: 'an',
  arm: 'hy',
  'art-lojban': 'jbo',
  asd: 'snz',
  asm: 'as',
  aue: 'ktz',
  ava: 'av',
  ave: 'ae',
  aym: 'ay',
  ayr: 'ay',
  ayx: 'nun',
  aze: 'az',
  azj: 'az',
  bak: 'ba',
  bam: 'bm',
  baq: 'eu',
  baz: 'nvo',
  bcc: 'bal',
  bcl: 'bik',
  bel: 'be',
  ben: 'bn',
  bgm: 'bcg',
  bh: 'bho',
  bhk: 'fbl',
  bic: 'bir',
  bih: 'bho',
  bis: 'bi',
  bjd: 'drl',
  bjq: 'bzc',
  bkb: 'ebk',
  blg: 'iba',
  bod: 'bo',
  bos: 'bs',
  bre: 'br',
  btb: 'beb',
  bul: 'bg',
  bur: 'my',
  bxk: 'luy',
  bxr: 'bua',
  cat: 'ca',
  ccq: 'rki',
  'cel-gaulish': 'xtg',
  ces: 'cs',
  cha: 'ch',
  che: 'ce',
  chi: 'zh',
  chu: 'cu',
  chv: 'cv',
  cjr: 'mom',
  cka: 'cmr',
  cld: 'syr',
  cls: 'sa',
  cmk: 'xch',
  cmn: 'zh',
  cnr: 'sr-ME',
  cor: 'kw',
  cos: 'co',
  coy: 'pij',
  cqu: 'quh',
  cre: 'cr',
  cwd: 'cr',
  cym: 'cy',
  cze: 'cs',
  daf: 'dnj',
  dan: 'da',
  dap: 'njz',
  dek: 'sqm',
  deu: 'de',
  dgo: 'doi',
  dhd: 'mwr',
  dik: 'din',
  diq: 'zza',
  dit: 'dif',
  div: 'dv',
  djl: 'dze',
  dkl: 'aqd',
  drh: 'mn',
  drr: 'kzk',
  drw: 'fa-AF',
  dud: 'uth',
  duj: 'dwu',
  dut: 'nl',
  dwl: 'dbt',
  dzo: 'dz',
  ekk: 'et',
  ell: 'el',
  elp: 'amq',
  emk: 'man',
  'en-GB-oed': 'en-GB-oxendict',
  eng: 'en',
  epo: 'eo',
  esk: 'ik',
  est: 'et',
  eus: 'eu',
  ewe: 'ee',
  fao: 'fo',
  fas: 'fa',
  fat: 'ak',
  fij: 'fj',
  fin: 'fi',
  fra: 'fr',
  fre: 'fr',
  fry: 'fy',
  fuc: 'ff',
  ful: 'ff',
  gav: 'dev',
  gaz: 'om',
  gbc: 'wny',
  gbo: 'grb',
  geo: 'ka',
  ger: 'de',
  gfx: 'vaj',
  ggn: 'gvr',
  ggo: 'esg',
  ggr: 'gtu',
  gio: 'aou',
  gla: 'gd',
  gle: 'ga',
  glg: 'gl',
  gli: 'kzk',
  glv: 'gv',
  gno: 'gon',
  gom: 'kok',
  gre: 'el',
  grn: 'gn',
  gti: 'nyc',
  gug: 'gn',
  guj: 'gu',
  guv: 'duz',
  gya: 'gba',
  hat: 'ht',
  hau: 'ha',
  hbs: 'sr-Latn',
  hdn: 'hai',
  hea: 'hmn',
  heb: 'he',
  her: 'hz',
  him: 'srx',
  hin: 'hi',
  hmo: 'ho',
  hrr: 'jal',
  hrv: 'hr',
  hun: 'hu',
  'hy-arevmda': 'hyw',
  hye: 'hy',
  'i-ami': 'ami',
  'i-bnn': 'bnn',
  'i-default': 'en-x-i-default',
  'i-enochian': 'und-x-i-enochian',
  'i-hak': 'hak',
  'i-klingon': 'tlh',
  'i-lux': 'lb',
  'i-mingo': 'see-x-i-mingo',
  'i-navajo': 'nv',
  'i-pwn': 'pwn',
  'i-tao': 'tao',
  'i-tay': 'tay',
  'i-tsu': 'tsu',
  ibi: 'opa',
  ibo: 'ig',
  ice: 'is',
  ido: 'io',
  iii: 'ii',
  ike: 'iu',
  iku: 'iu',
  ile: 'ie',
  ill: 'ilm',
  ilw: 'gal',
  in: 'id',
  ina: 'ia',
  ind: 'id',
  ipk: 'ik',
  isl: 'is',
  ita: 'it',
  iw: 'he',
  izi: 'eza',
  jar: 'jgk',
  jav: 'jv',
  jeg: 'oyb',
  ji: 'yi',
  jpn: 'ja',
  jw: 'jv',
  kal: 'kl',
  kan: 'kn',
  kas: 'ks',
  kat: 'ka',
  kau: 'kr',
  kaz: 'kk',
  kdv: 'zkd',
  kgc: 'tdf',
  kgd: 'ncq',
  kgh: 'kml',
  kgm: 'plu',
  khk: 'mn',
  khm: 'km',
  kik: 'ki',
  kin: 'rw',
  kir: 'ky',
  kmr: 'ku',
  knc: 'kr',
  kng: 'kg',
  koj: 'kwv',
  kom: 'kv',
  kon: 'kg',
  kor: 'ko',
  kpp: 'jkm',
  kpv: 'kv',
  krm: 'bmf',
  ktr: 'dtp',
  kua: 'kj',
  kur: 'ku',
  kvs: 'gdj',
  kwq: 'yam',
  kxe: 'tvd',
  kxl: 'kru',
  kzh: 'dgl',
  kzj: 'dtp',
  kzt: 'dtp',
  lak: 'ksp',
  lao: 'lo',
  lat: 'la',
  lav: 'lv',
  lbk: 'bnc',
  leg: 'enl',
  lii: 'raq',
  lim: 'li',
  lin: 'ln',
  lit: 'lt',
  llo: 'ngt',
  lmm: 'rmx',
  ltz: 'lb',
  lub: 'lu',
  lug: 'lg',
  lvs: 'lv',
  mac: 'mk',
  mah: 'mh',
  mal: 'ml',
  mao: 'mi',
  mar: 'mr',
  may: 'ms',
  meg: 'cir',
  mgx: 'jbk',
  mhr: 'chm',
  mkd: 'mk',
  mlg: 'mg',
  mlt: 'mt',
  mnt: 'wnn',
  mo: 'ro',
  mof: 'xnt',
  mol: 'ro',
  mon: 'mn',
  mri: 'mi',
  msa: 'ms',
  mst: 'mry',
  mup: 'raj',
  mwd: 'dmw',
  mwj: 'vaj',
  mya: 'my',
  myd: 'aog',
  myt: 'mry',
  nad: 'xny',
  nau: 'na',
  nav: 'nv',
  nbf: 'nru',
  nbl: 'nr',
  nbx: 'gll',
  ncp: 'kdz',
  nde: 'nd',
  ndo: 'ng',
  nep: 'ne',
  nld: 'nl',
  nln: 'azd',
  nlr: 'nrk',
  nno: 'nn',
  nns: 'nbr',
  nnx: 'ngv',
  'no-bok': 'nb',
  'no-bokmal': 'nb',
  'no-nyn': 'nn',
  'no-nynorsk': 'nn',
  nob: 'nb',
  nom: 'cbr',
  noo: 'dtd',
  nor: 'no',
  npi: 'ne',
  nte: 'eko',
  nts: 'pij',
  nxu: 'bpp',
  nya: 'ny',
  oci: 'oc',
  ojg: 'oj',
  oji: 'oj',
  ori: 'or',
  orm: 'om',
  ory: 'or',
  oss: 'os',
  oun: 'vaj',
  pan: 'pa',
  pat: 'kxr',
  pbu: 'ps',
  pcr: 'adx',
  per: 'fa',
  pes: 'fa',
  pli: 'pi',
  plt: 'mg',
  pmc: 'huw',
  pmk: 'crr',
  pmu: 'phr',
  pnb: 'lah',
  pol: 'pl',
  por: 'pt',
  ppa: 'bfy',
  ppr: 'lcq',
  prp: 'gu',
  prs: 'fa-AF',
  pry: 'prt',
  pus: 'ps',
  puz: 'pub',
  que: 'qu',
  quz: 'qu',
  rmr: 'emx',
  rmy: 'rom',
  roh: 'rm',
  ron: 'ro',
  rum: 'ro',
  run: 'rn',
  rus: 'ru',
  sag: 'sg',
  san: 'sa',
  sap: 'aqt',
  sca: 'hle',
  scc: 'sr',
  scr: 'hr',
  sgl: 'isk',
  'sgn-BE-FR': 'sfb',
  'sgn-BE-NL': 'vgt',
  'sgn-BR': 'bzs',
  'sgn-CH-DE': 'sgg',
  'sgn-CO': 'csn',
  'sgn-DE': 'gsg',
  'sgn-DK': 'dsl',
  'sgn-ES': 'ssp',
  'sgn-FR': 'fsl',
  'sgn-GB': 'bfi',
  'sgn-GR': 'gss',
  'sgn-IE': 'isg',
  'sgn-IT': 'ise',
  'sgn-JP': 'jsl',
  'sgn-MX': 'mfs',
  'sgn-NI': 'ncs',
  'sgn-NL': 'dse',
  'sgn-NO': 'nsi',
  'sgn-PT': 'psr',
  'sgn-SE': 'swl',
  'sgn-US': 'ase',
  'sgn-ZA': 'sfs',
  sh: 'sr-Latn',
  sin: 'si',
  skk: 'oyb',
  slk: 'sk',
  slo: 'sk',
  slv: 'sl',
  smd: 'kmb',
  sme: 'se',
  smo: 'sm',
  sna: 'sn',
  snb: 'iba',
  snd: 'sd',
  som: 'so',
  sot: 'st',
  spa: 'es',
  spy: 'kln',
  sqi: 'sq',
  src: 'sc',
  srd: 'sc',
  srp: 'sr',
  ssw: 'ss',
  sul: 'sgd',
  sum: 'ulw',
  sun: 'su',
  swa: 'sw',
  swc: 'sw-CD',
  swe: 'sv',
  swh: 'sw',
  szd: 'umi',
  tah: 'ty',
  tam: 'ta',
  tat: 'tt',
  tdu: 'dtp',
  tel: 'te',
  tgg: 'bjp',
  tgk: 'tg',
  tgl: 'fil',
  tha: 'th',
  thc: 'tpo',
  thw: 'ola',
  thx: 'oyb',
  tib: 'bo',
  tid: 'itd',
  tie: 'ras',
  tir: 'ti',
  tkk: 'twm',
  tl: 'fil',
  tlw: 'weo',
  tmk: 'tdg',
  tmp: 'tyj',
  tne: 'kak',
  tnf: 'fa-AF',
  ton: 'to',
  tpw: 'tpn',
  tsf: 'taj',
  tsn: 'tn',
  tso: 'ts',
  ttq: 'tmh',
  tuk: 'tk',
  tur: 'tr',
  tw: 'ak',
  twi: 'ak',
  uig: 'ug',
  ukr: 'uk',
  umu: 'del',
  'und-aaland': 'und-AX',
  'und-arevela': 'und',
  'und-arevmda': 'und',
  'und-bokmal': 'und',
  'und-hakka': 'und',
  'und-hepburn-heploc': 'und-alalc97',
  'und-lojban': 'und',
  'und-nynorsk': 'und',
  'und-saaho': 'und',
  'und-xiang': 'und',
  unp: 'wro',
  uok: 'ema',
  urd: 'ur',
  uzb: 'uz',
  uzn: 'uz',
  ven: 've',
  vie: 'vi',
  vol: 'vo',
  wel: 'cy',
  wgw: 'wgb',
  wit: 'nol',
  wiw: 'nwo',
  wln: 'wa',
  wol: 'wo',
  xba: 'cax',
  xho: 'xh',
  xia: 'acn',
  xkh: 'waw',
  xpe: 'kpe',
  xrq: 'dmw',
  xsj: 'suj',
  xsl: 'den',
  xss: 'zko',
  ybd: 'rki',
  ydd: 'yi',
  yen: 'ynq',
  yid: 'yi',
  yiy: 'yrm',
  yma: 'lrr',
  ymt: 'mtm',
  yor: 'yo',
  yos: 'zom',
  yuu: 'yug',
  zai: 'zap',
  'zh-cmn': 'zh',
  'zh-cmn-Hans': 'zh-Hans',
  'zh-cmn-Hant': 'zh-Hant',
  'zh-gan': 'gan',
  'zh-guoyu': 'zh',
  'zh-hakka': 'hak',
  'zh-min': 'nan-x-zh-min',
  'zh-min-nan': 'nan',
  'zh-wuu': 'wuu',
  'zh-xiang': 'hsn',
  'zh-yue': 'yue',
  zha: 'za',
  zho: 'zh',
  zir: 'scv',
  zkb: 'kjh',
  zsm: 'ms',
  zul: 'zu',
  zyb: 'za'
}
