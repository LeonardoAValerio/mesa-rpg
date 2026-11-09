import { describe, expect, it } from 'vitest'
import { canMove, clampWidth, dropPosition, fromOldToken, LOCKED_ITEM, MASTER_ONLY_ITEM, normalizeRotation, rotatedExtent, snapCentre } from './items'
import { DEFAULT_GRID, type Actor } from './types'

const grid = { ...DEFAULT_GRID, cell: 100, offsetX: 0, offsetY: 0 }
const master: Actor = { role: 'master', name: 'Mestre' }
const ana: Actor = { role: 'player', name: 'Ana' }

describe('item rules', () => {
  it('a width is 0.25 to 20 cells in steps of 0.25', () => {
    expect([0.25, 1, 2.75, 20].map(clampWidth)).toEqual([0.25, 1, 2.75, 20])
    expect([0, 0.1, -2].map(clampWidth)).toEqual([0.25, 0.25, 0.25])
    expect([20.2, 99].map(clampWidth)).toEqual([20, 20])
    expect([1.1, 1.13, 1.2].map(clampWidth)).toEqual([1, 1.25, 1.25])
    expect(clampWidth(Number.NaN)).toBe(1)
  })

  it('ITEM-12 a rotation is a multiple of 15 from 0 to 345; other values round to the nearest one modulo 360', () => {
    expect([0, 15, 90, 345].map(normalizeRotation)).toEqual([0, 15, 90, 345])
    expect([7, 8, 22, 23].map(normalizeRotation)).toEqual([0, 15, 15, 30])
    expect([360, 375, -15, -360, 720 + 45].map(normalizeRotation)).toEqual([0, 15, 345, 0, 45])
    expect(normalizeRotation(353)).toBe(0) // rounds to 360, which is 0
    expect(normalizeRotation(Number.NaN)).toBe(0)
  })

  it('snapping puts the left and top edges on the nearest grid lines, for odd, even and fractional sizes and an offset grid', () => {
    expect(snapCentre(grid, 140, 260, 1, 1)).toEqual({ x: 150, y: 250 }) // 1 cell: centre of a cell
    expect(snapCentre(grid, 140, 260, 2, 2)).toEqual({ x: 100, y: 300 }) // 2 cells: on a grid crossing
    expect(snapCentre(grid, 140, 260, 1.5, 0.75)).toEqual({ x: 175, y: 237.5 }) // left edge 100, top edge 200
    expect(snapCentre({ ...grid, offsetX: 30, offsetY: 10 }, 140, 260, 1, 1)).toEqual({ x: 180, y: 260 })
  })

  it('a turned item snaps by its drawn box: 90° swaps the sides, 45° grows both', () => {
    expect(rotatedExtent(1, 1.5, 0)).toEqual({ w: 1, h: 1.5 })
    expect(rotatedExtent(1, 1.5, 90)).toEqual({ w: 1.5, h: 1 })
    expect(rotatedExtent(1, 1.5, 180)).toEqual({ w: 1, h: 1.5 })
    const d = rotatedExtent(1, 1, 45)
    expect(d.w).toBeCloseTo(Math.SQRT2, 9)
    // a 100 x 150 character turned 90° and dropped at (520, 330): its drawn box (150 x 100) snaps to 400 / 300
    const e = rotatedExtent(1, 1.5, 90)
    expect(snapCentre(grid, 520, 330, e.w, e.h)).toEqual({ x: 475, y: 350 })
  })

  it('a character snaps and an object stays where dropped; Shift at the drop does the opposite', () => {
    expect(dropPosition('character', false, grid, 140, 260, 1, 1)).toEqual({ x: 150, y: 250 })
    expect(dropPosition('object', false, grid, 140, 260, 1, 1)).toEqual({ x: 140, y: 260 })
    expect(dropPosition('character', true, grid, 140, 260, 1, 1)).toEqual({ x: 140, y: 260 })
    expect(dropPosition('object', true, grid, 140, 260, 1, 1)).toEqual({ x: 150, y: 250 })
  })

  it('Livre lets anyone move; Só mestre only the master; Travado nobody, the master included', () => {
    expect(canMove({ movement: 'free' }, ana)).toEqual({ ok: true })
    expect(canMove({ movement: 'free' }, master)).toEqual({ ok: true })
    expect(canMove({ movement: 'master' }, master)).toEqual({ ok: true })
    expect(canMove({ movement: 'master' }, ana)).toEqual({ ok: false, reason: MASTER_ONLY_ITEM })
    expect(canMove({ movement: 'locked' }, master)).toEqual({ ok: false, reason: LOCKED_ITEM })
    expect(canMove({ movement: 'locked' }, ana)).toEqual({ ok: false, reason: LOCKED_ITEM })
    expect([MASTER_ONLY_ITEM, LOCKED_ITEM]).toEqual(['Só o mestre move este item', 'Item travado'])
  })

  it('an old token becomes a character centred on the cells it covered, as wide as its size, its faction as ring, Livre', () => {
    const old = { id: 'a', name: 'Ogro', hash: 'h', faction: 'inimigo' as const, size: 3 as const, col: 2, row: 1, owner: 'Ana', hidden: true }
    expect(fromOldToken(old, grid)).toEqual({
      id: 'a',
      name: 'Ogro',
      hash: 'h',
      kind: 'character',
      x: 350,
      y: 250,
      width: 3,
      rotation: 0,
      ring: 'inimigo',
      owner: 'Ana',
      hidden: true,
      movement: 'free'
    })
    expect(fromOldToken({ ...old, size: 1, col: 0, row: 0 }, { ...grid, offsetX: 20, offsetY: 10 })).toMatchObject({ x: 70, y: 60, width: 1 })
  })
})
