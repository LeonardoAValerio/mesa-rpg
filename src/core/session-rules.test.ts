import { describe, expect, it } from 'vitest'
import { validateJoin, validatePort } from './session-rules'

describe('validatePort', () => {
  it('[C4] NET-04 rejects non-numeric and out-of-range ports with "Porta inválida" and accepts 1024..65535', () => {
    for (const bad of ['abc', '80', '1023', '65536', '', '  ', '4780.5', '-47800', '47800abc']) {
      expect(validatePort(bad), bad).toEqual({ ok: false, error: 'Porta inválida' })
    }
    expect(validatePort('1024')).toEqual({ ok: true, port: 1024 })
    expect(validatePort('65535')).toEqual({ ok: true, port: 65535 })
    expect(validatePort('47800')).toEqual({ ok: true, port: 47800 })
  })
})

describe('validateJoin', () => {
  it('rejects an empty or 25-character name with "Nome inválido" and accepts 24 characters', () => {
    expect(validateJoin('', [], 0)).toBe('Nome inválido')
    expect(validateJoin('   ', [], 0)).toBe('Nome inválido')
    expect(validateJoin('a'.repeat(25), [], 0)).toBe('Nome inválido')
    expect(validateJoin('a'.repeat(24), [], 0)).toBeNull()
  })

  it('rejects a name already connected with "Nome já em uso"', () => {
    expect(validateJoin('Ana', ['Mestre', 'Ana'], 1)).toBe('Nome já em uso')
    expect(validateJoin('ana', ['Ana'], 1)).toBe('Nome já em uso')
    expect(validateJoin('Bia', ['Ana'], 1)).toBeNull()
  })

  it('rejects a ninth player with "Mesa cheia" and accepts the eighth', () => {
    const names = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']
    expect(validateJoin('Ana', names.slice(0, 7), 7)).toBeNull()
    expect(validateJoin('Ana', names, 8)).toBe('Mesa cheia')
  })
})
