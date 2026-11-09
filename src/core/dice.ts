import type { RollResult, RollTerm } from './types'

export const DICE_LIMITS = { maxCount: 100, minSides: 2, maxSides: 1000, maxTerms: 10, maxConst: 1000 } as const

export interface DiceTerm {
  kind: 'dice' | 'const'
  sign: 1 | -1
  count?: number
  sides?: number
  keep?: { mode: 'kh' | 'kl'; n: number }
  value?: number
}

export interface DiceExpr {
  text: string
  terms: DiceTerm[]
}

export const invalidNotation = (expr: string): string => `Notação inválida: ${expr}`

const TERM = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$|^(\d+)$/

/** DICE-01, DICE-04: `NdM`, `NdMkhK`, `NdMklK` and constants joined by + and -, within the limits. */
export function parseDice(input: string): DiceExpr | { error: string } {
  const shown = input.trim()
  const fail = { error: invalidNotation(shown) }
  const text = shown.toLowerCase().replace(/\s+/g, '')
  if (!text) return fail
  const parts = text.match(/[+-]?[^+-]+/g)
  if (!parts || parts.join('') !== text || parts.length > DICE_LIMITS.maxTerms) return fail
  const terms: DiceTerm[] = []
  for (const part of parts) {
    const sign: 1 | -1 = part.startsWith('-') ? -1 : 1
    const m = TERM.exec(part.replace(/^[+-]/, ''))
    if (!m) return fail
    if (m[5] !== undefined) {
      const value = Number(m[5])
      if (value > DICE_LIMITS.maxConst) return fail
      terms.push({ kind: 'const', sign, value })
      continue
    }
    const count = m[1] === '' ? 1 : Number(m[1])
    const sides = Number(m[2])
    if (count < 1 || count > DICE_LIMITS.maxCount || sides < DICE_LIMITS.minSides || sides > DICE_LIMITS.maxSides) return fail
    const term: DiceTerm = { kind: 'dice', sign, count, sides }
    if (m[3]) {
      const n = Number(m[4])
      if (n < 1 || n > count) return fail
      term.keep = { mode: m[3] as 'kh' | 'kl', n }
    }
    terms.push(term)
  }
  return { text: shown, terms }
}

/** DICE-01, DICE-03: rolls every die; with kh/kl only the K highest/lowest count and the rest are marked dropped. */
export function rollDice(expr: DiceExpr, rng: (max: number) => number): RollResult {
  const terms: RollTerm[] = expr.terms.map((t) => {
    if (t.kind === 'const') return { kind: 'const', sign: t.sign, value: t.value! }
    const rolls = Array.from({ length: t.count! }, () => rng(t.sides!))
    const kept = rolls.map(() => true)
    if (t.keep) {
      const order = rolls.map((v, i) => ({ v, i })).sort((a, b) => (t.keep!.mode === 'kh' ? b.v - a.v : a.v - b.v) || a.i - b.i)
      kept.fill(false)
      for (const { i } of order.slice(0, t.keep.n)) kept[i] = true
    }
    const value = rolls.reduce((sum, v, i) => sum + (kept[i] ? v : 0), 0)
    return { kind: 'dice', sign: t.sign, count: t.count, sides: t.sides, keep: t.keep, rolls, kept, value }
  })
  return { expr: expr.text, terms, total: terms.reduce((s, t) => s + t.sign * t.value, 0) }
}
