import { describe, expect, it, vi } from 'vitest'

const calls: Array<[number, number]> = []
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return {
    ...actual,
    randomInt: (min: number, max: number) => {
      calls.push([min, max])
      return actual.randomInt(min, max)
    }
  }
})

describe('cryptoRng', () => {
  it('[C52] DICE-02 draws with `crypto.randomInt` and 60000 d6 land within 5% of 10000 per face', async () => {
    const { cryptoRng } = await import('./table-server')
    const counts = new Map<number, number>()
    for (let i = 0; i < 60000; i++) {
      const v = cryptoRng(6)
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6])
    for (const n of counts.values()) expect(Math.abs(n - 10000)).toBeLessThan(500)
    expect(calls).toHaveLength(60000)
    expect(calls.every(([min, max]) => min === 1 && max === 7)).toBe(true)
  })
})
