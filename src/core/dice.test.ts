import { describe, expect, it } from 'vitest'
import { parseDice, rollDice, type DiceExpr } from './dice'

const parse = (s: string): DiceExpr => {
  const r = parseDice(s)
  if ('error' in r) throw new Error(r.error)
  return r
}
/** Returns the given values in order, as dice. */
const seq = (...values: number[]): ((max: number) => number) => {
  let i = 0
  return () => values[i++]
}

describe('rollDice', () => {
  it('[C53] DICE-03 `2d20kh1` sums only the highest and marks the other dropped; `2d20kl1` sums the lowest', () => {
    const adv = rollDice(parse('2d20kh1'), seq(7, 15))
    expect(adv.terms[0]).toMatchObject({ rolls: [7, 15], kept: [false, true], value: 15 })
    expect(adv.total).toBe(15)
    const dis = rollDice(parse('2d20kl1'), seq(7, 15))
    expect(dis.terms[0]).toMatchObject({ rolls: [7, 15], kept: [true, false], value: 7 })
    expect(dis.total).toBe(7)
    const four = rollDice(parse('4d6kh3'), seq(3, 1, 6, 3))
    expect(four.terms[0]).toMatchObject({ kept: [true, false, true, true], value: 12 })
  })

  it('adds and subtracts terms: `1d8+1d6-2` with 5 and 4 is 7 (DICE-01)', () => {
    const r = rollDice(parse('1d8+1d6-2'), seq(5, 4))
    expect(r.total).toBe(7)
    expect(r.terms.map((t) => [t.kind, t.sign, t.value])).toEqual([
      ['dice', 1, 5],
      ['dice', 1, 4],
      ['const', -1, 2]
    ])
    expect(rollDice(parse('2d6+3'), seq(6, 6)).total).toBe(15)
    expect(rollDice(parse(' d20 + 5 '), seq(11)).total).toBe(16)
  })

  it('asks the generator for numbers between 1 and the number of sides', () => {
    const maxes: number[] = []
    rollDice(parse('2d6+1d1000'), (m) => (maxes.push(m), 1))
    expect(maxes).toEqual([6, 6, 1000])
  })
})

describe('parseDice', () => {
  it('rejects notation outside the grammar and the limits with "Notação inválida: <expressão>" (DICE-04)', () => {
    for (const bad of ['2d', '101d6', '1d1', '1d6+2000', '2d6kh3', '2d6kh0', '', 'abc', '1d6++2', '1d1001', '1d6*2', '1+1+1+1+1+1+1+1+1+1+1']) {
      expect(parseDice(bad), bad).toEqual({ error: `Notação inválida: ${bad.trim()}` })
    }
    // the modifier is the sum of all constants
    for (const bad of ['1d6+1000+1000', '1d6-600-600', '1000+1000+1000+1000+1000+1000+1000+1000+1000+1000']) {
      expect(parseDice(bad), bad).toEqual({ error: `Notação inválida: ${bad}` })
    }
    expect('error' in parseDice('1d6+1000+1000-1000')).toBe(false)
    expect('error' in parseDice('1d6-1000')).toBe(false)
    expect('error' in parseDice('100d1000+1000')).toBe(false)
    expect('error' in parseDice('1+1+1+1+1+1+1+1+1+1')).toBe(false)
  })
})
