import { describe, expect, it } from 'vitest'
import { brush, coverAll, coveredCells, fogDims, isCovered, rect, tokenCovered } from './fog'
import { DEFAULT_GRID, type Fog, type Token } from './types'

const grid = { ...DEFAULT_GRID, cell: 100, offsetX: 0, offsetY: 0 }
const map = { hash: 'x', width: 800, height: 600 }
const full = (): Fog => coverAll(fogDims(map, grid))
const revealed = (fog: Fog): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (let r = 0; r < fog.rows; r++) for (let c = 0; c < fog.cols; c++) if (!isCovered(fog, c + fog.colStart, r + fog.rowStart)) out.push([c, r])
  return out
}

describe('fog', () => {
  it('covers every cell that touches the image, including partial cells from the offset', () => {
    expect(fogDims(map, grid)).toEqual({ colStart: 0, rowStart: 0, cols: 8, rows: 6 })
    expect(fogDims({ ...map, width: 830 }, { ...grid, offsetX: 30, offsetY: 0 })).toEqual({ colStart: -1, rowStart: 0, cols: 9, rows: 6 })
    expect(coveredCells(full())).toHaveLength(48)
  })

  it('[C66] FOG-03 a brush of radius 2 reveals only the cells whose centre is within the radius, and Cover covers them again', () => {
    // centre of cell (3,2) is (350,250); radius 2 cells = 200 px
    const f = brush(full(), grid, 350, 250, 2, 'reveal')
    const shown = revealed(f)
    const expected: Array<[number, number]> = []
    for (let r = 0; r < 6; r++) for (let c = 0; c < 8; c++) if ((c - 3) ** 2 + (r - 2) ** 2 <= 4) expected.push([c, r])
    expect(shown).toEqual(expected)
    expect(shown).toContainEqual([3, 0])
    expect(shown).not.toContainEqual([1, 0]) // centre at distance sqrt(8) cells
    expect(revealed(brush(f, grid, 350, 250, 2, 'cover'))).toEqual([])
    // the radius is limited to 1..10 cells
    const tiny = full()
    expect(revealed(brush(tiny, grid, 50, 50, 0, 'reveal'))).toEqual(revealed(brush(tiny, grid, 50, 50, 1, 'reveal')))
    expect(revealed(brush(full(), { ...grid, cell: 10 }, 0, 0, 99, 'reveal'))).toEqual(revealed(brush(full(), { ...grid, cell: 10 }, 0, 0, 10, 'reveal')))
  })

  it('[C67] FOG-04 a rectangle reveals only the cells whose centre is inside it, and Cover covers them again', () => {
    const f = rect(full(), grid, 120, 40, 360, 260, 'reveal') // centres 150..350 x 50..250
    expect(revealed(f)).toEqual([
      [1, 0], [2, 0], [3, 0],
      [1, 1], [2, 1], [3, 1],
      [1, 2], [2, 2], [3, 2]
    ])
    expect(revealed(rect(full(), grid, 360, 260, 120, 40, 'reveal'))).toEqual(revealed(f)) // corners in any order
    expect(revealed(rect(f, grid, 120, 40, 260, 260, 'cover'))).toEqual([[3, 0], [3, 1], [3, 2]])
  })

  it('[C68] FOG-05 "Cobrir tudo" leaves every cell covered', () => {
    const open = rect(full(), grid, 0, 0, 800, 600, 'reveal')
    expect(revealed(open)).toHaveLength(48)
    const again = coverAll(open)
    expect(revealed(again)).toEqual([])
    expect(coveredCells(again)).toHaveLength(48)
  })

  it('a token is under the fog when any of its cells is covered', () => {
    const t: Token = { id: 't', name: 't', hash: 'h', faction: 'npc', size: 2, col: 1, row: 1, owner: null, hidden: false }
    const f = rect(full(), grid, 100, 100, 200, 200, 'reveal') // reveals (1,1) only
    expect(tokenCovered(f, t)).toBe(true)
    expect(tokenCovered(rect(full(), grid, 100, 100, 300, 300, 'reveal'), t)).toBe(false)
  })
})
