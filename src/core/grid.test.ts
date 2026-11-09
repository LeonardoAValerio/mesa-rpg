import { describe, expect, it } from 'vitest'
import { cellAt, cellOrigin, clampGrid, insideMap, rulerDistance } from './grid'
import { DEFAULT_GRID } from './types'

describe('clampGrid', () => {
  it('[C22] MAP-06 clamps cell 5→10 and 900→500, offset above the cell to the cell, opacity 150%→100%', () => {
    expect(clampGrid({ cell: 5 }).cell).toBe(10)
    expect(clampGrid({ cell: 900 }).cell).toBe(500)
    expect(clampGrid({ cell: 80, offsetX: 120, offsetY: 81 })).toMatchObject({ offsetX: 80, offsetY: 80 })
    expect(clampGrid({ offsetX: -5 }).offsetX).toBe(0)
    expect(clampGrid({ opacity: 1.5 }).opacity).toBe(1)
    expect(clampGrid({ opacity: -0.2 }).opacity).toBe(0)
    expect(clampGrid({ cell: 83, offsetX: 10, offsetY: 20, color: '#FF0000', opacity: 0.4 })).toEqual({
      cell: 83,
      offsetX: 10,
      offsetY: 20,
      color: '#ff0000',
      opacity: 0.4
    })
  })

  it('keeps the current value for a missing, non-finite or malformed field', () => {
    const base = { ...DEFAULT_GRID, cell: 90 }
    expect(clampGrid({ cell: Number.NaN, color: 'red' }, base)).toEqual(base)
  })
})

describe('cell math', () => {
  const g = { ...DEFAULT_GRID, cell: 80, offsetX: 10, offsetY: 20 }
  it('finds the cell under a pixel and the origin of a cell', () => {
    expect(cellAt(g, 10, 20)).toEqual({ col: 0, row: 0 })
    expect(cellAt(g, 89.9, 99.9)).toEqual({ col: 0, row: 0 })
    expect(cellAt(g, 90, 100)).toEqual({ col: 1, row: 1 })
    expect(cellAt(g, 5, 5)).toEqual({ col: -1, row: -1 })
    expect(cellOrigin(g, 2, 3)).toEqual({ x: 170, y: 260 })
  })

  it('counts a diagonal as one cell: (0,0)→(3,5) is 5 (TOOL-01)', () => {
    expect(rulerDistance({ col: 0, row: 0 }, { col: 3, row: 5 })).toBe(5)
    expect(rulerDistance({ col: 4, row: 4 }, { col: 0, row: 0 })).toBe(4)
    expect(rulerDistance({ col: 2, row: 2 }, { col: 2, row: 2 })).toBe(0)
  })

  it('says a token is on the map when its centre is inside the image (TOK-10)', () => {
    const map = { hash: 'x', width: 800, height: 600 }
    const grid = { ...DEFAULT_GRID, cell: 100 }
    expect(insideMap(grid, map, 0, 0, 1)).toBe(true)
    expect(insideMap(grid, map, 7, 5, 1)).toBe(true)
    expect(insideMap(grid, map, 8, 0, 1)).toBe(false)
    expect(insideMap(grid, map, -1, 0, 1)).toBe(false)
    expect(insideMap(grid, map, 6, 4, 3)).toBe(true)
    expect(insideMap(grid, map, 7, 4, 3)).toBe(false)
  })
})
