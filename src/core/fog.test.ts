import { describe, expect, it } from 'vitest'
import { toBase64 } from './base64'
import {
  addShape,
  clampBrushCells,
  coverAll,
  fogAt,
  fromCellFog,
  MAX_POINTS,
  MAX_SHAPES,
  revealAll,
  shapeContains,
  tokenCovered,
  TOO_MANY_SHAPES
} from './fog'
import { DEFAULT_GRID, type Fog, type FogShape, type Token } from './types'

const grid = { ...DEFAULT_GRID, cell: 100, offsetX: 0, offsetY: 0 }
const rect = (mode: 'cover' | 'reveal', x: number, y: number, w: number, h: number): FogShape => ({ kind: 'rect', mode, x, y, w, h })
const add = (fog: Fog, ...shapes: FogShape[]): Fog => {
  for (const s of shapes) {
    const r = addShape(fog, s)
    if (!r.ok) throw new Error(r.reason)
    fog = r.fog
  }
  return fog
}
const token = (col: number, row: number, size: 1 | 2 | 3 = 1): Token => ({
  id: 't',
  name: 'T',
  hash: 'h',
  faction: 'inimigo',
  size,
  col,
  row,
  owner: null,
  hidden: false
})

describe('fog shapes', () => {
  it('[C4] FOGS-04 at a point the last shape containing it decides, and with none the base decides', () => {
    // nothing drawn: the base
    expect(fogAt(revealAll(), 10, 10)).toBe(false)
    expect(fogAt(coverAll(), 10, 10)).toBe(true)
    // cover a block, reveal a hole in it, cover a smaller block inside the hole
    const fog = add(revealAll(), rect('cover', 0, 0, 400, 400), rect('reveal', 100, 100, 200, 200), rect('cover', 150, 150, 50, 50))
    expect(fogAt(fog, 50, 50)).toBe(true) // only the first shape
    expect(fogAt(fog, 120, 120)).toBe(false) // the hole, last
    expect(fogAt(fog, 175, 175)).toBe(true) // the small block, last
    expect(fogAt(fog, 500, 500)).toBe(false) // no shape: base revealed
    // the same shapes over a covered base: outside every shape stays covered
    expect(fogAt({ ...fog, base: 'covered' }, 500, 500)).toBe(true)
    // order matters: reveal then cover the same area is covered
    expect(fogAt(add(coverAll(), rect('reveal', 0, 0, 10, 10), rect('cover', 0, 0, 10, 10)), 5, 5)).toBe(true)
    expect(fogAt(add(coverAll(), rect('cover', 0, 0, 10, 10), rect('reveal', 0, 0, 10, 10)), 5, 5)).toBe(false)
  })

  it('a stroke holds the points within its radius of the path, and a single point is a circle', () => {
    const stroke: FogShape = { kind: 'stroke', mode: 'cover', radius: 50, points: [100, 100, 300, 100, 300, 300] }
    expect(shapeContains(stroke, 200, 149)).toBe(true) // 49 px below the first segment
    expect(shapeContains(stroke, 200, 151)).toBe(false) // 51 px
    expect(shapeContains(stroke, 349, 200)).toBe(true) // beside the second segment
    expect(shapeContains(stroke, 200, 200)).toBe(false) // inside the corner, 100 px from both segments
    expect(shapeContains(stroke, 55, 100)).toBe(true) // the rounded start cap
    expect(shapeContains(stroke, 49, 100)).toBe(false)
    const dot: FogShape = { kind: 'stroke', mode: 'cover', radius: 30, points: [500, 500] }
    expect(shapeContains(dot, 521, 521)).toBe(true) // ~29.7 px away
    expect(shapeContains(dot, 522, 522)).toBe(false) // ~31.1 px away
  })

  it('a rectangle holds its edges and nothing past them; a polygon holds its inside only', () => {
    const r = rect('cover', 100, 200, 300, 100)
    expect([shapeContains(r, 100, 200), shapeContains(r, 400, 300), shapeContains(r, 99, 250), shapeContains(r, 250, 301)]).toEqual([true, true, false, false])
    // an L-shaped polygon: the notch is outside
    const l: FogShape = { kind: 'poly', mode: 'cover', points: [0, 0, 200, 0, 200, 100, 100, 100, 100, 200, 0, 200] }
    expect(shapeContains(l, 50, 150)).toBe(true)
    expect(shapeContains(l, 150, 50)).toBe(true)
    expect(shapeContains(l, 150, 150)).toBe(false)
    expect(shapeContains(l, 250, 50)).toBe(false)
  })

  it('degenerate shapes change nothing: a flat rectangle, a polygon of under 3 distinct points', () => {
    const base = revealAll()
    for (const s of [
      rect('cover', 0, 0, 0, 100),
      rect('cover', 0, 0, 100, -5),
      { kind: 'poly', mode: 'cover', points: [0, 0, 10, 10, 0, 0] } as FogShape,
      { kind: 'poly', mode: 'cover', points: [0, 0, 10, 10] } as FogShape
    ]) {
      expect(addShape(base, s)).toEqual({ ok: true, fog: base })
    }
  })

  it('refuses the shape past 2000 shapes or past 2000 points in one stroke, and keeps the fog', () => {
    let fog = revealAll()
    for (let i = 0; i < MAX_SHAPES; i++) fog = add(fog, rect('cover', i, 0, 1, 1))
    expect(fog.shapes).toHaveLength(2000)
    expect(addShape(fog, rect('cover', 0, 0, 1, 1))).toEqual({ ok: false, reason: TOO_MANY_SHAPES })
    expect(TOO_MANY_SHAPES).toBe('Névoa com formas demais: use Cobrir tudo ou Revelar tudo')
    const points = (n: number): number[] => Array.from({ length: n * 2 }, (_, i) => i)
    expect(addShape(revealAll(), { kind: 'stroke', mode: 'cover', radius: 5, points: points(MAX_POINTS) }).ok).toBe(true)
    expect(addShape(revealAll(), { kind: 'stroke', mode: 'cover', radius: 5, points: points(MAX_POINTS + 1) })).toEqual({ ok: false, reason: TOO_MANY_SHAPES })
    expect(addShape(revealAll(), { kind: 'poly', mode: 'cover', points: points(MAX_POINTS + 1) })).toEqual({ ok: false, reason: TOO_MANY_SHAPES })
  })

  it('[C15] FOGT-06 the brush radius is 0.5 to 10 cells in steps of 0.5', () => {
    expect([0.5, 1, 2.5, 10].map(clampBrushCells)).toEqual([0.5, 1, 2.5, 10])
    expect([0, 0.2, -3].map(clampBrushCells)).toEqual([0.5, 0.5, 0.5])
    expect([11, 99].map(clampBrushCells)).toEqual([10, 10])
    expect([1.2, 1.3, 2.74, 2.76].map(clampBrushCells)).toEqual([1, 1.5, 2.5, 3])
    expect(clampBrushCells(Number.NaN)).toBe(1)
  })

  it('a token is under the fog when its centre is, whatever covers its corners', () => {
    // a 2x2 token at (1,1) has its centre at (200, 200)
    const t = token(1, 1, 2)
    expect(tokenCovered(add(revealAll(), rect('cover', 190, 190, 20, 20)), grid, t)).toBe(true)
    expect(tokenCovered(add(revealAll(), rect('cover', 100, 100, 90, 90)), grid, t)).toBe(false) // a corner only
    expect(tokenCovered(add(coverAll(), rect('reveal', 195, 195, 10, 10)), grid, t)).toBe(false)
    // the grid offset moves the centre
    expect(tokenCovered(add(revealAll(), rect('cover', 90, 90, 20, 20)), { ...grid, offsetX: -50, offsetY: -50 }, token(1, 1))).toBe(true) // centre (100, 100)
    expect(tokenCovered(add(revealAll(), rect('cover', 140, 140, 20, 20)), { ...grid, offsetX: -50, offsetY: -50 }, token(1, 1))).toBe(false)
  })

  it('a version 1 cell fog becomes one covered rectangle per run of covered cells in a row', () => {
    // 4x2 cells; row 0: covered, covered, revealed, covered; row 1: all revealed
    const bits = new Uint8Array([0b00001011])
    const fog = fromCellFog({ colStart: 0, rowStart: 0, cols: 4, rows: 2, covered: toBase64(bits) }, grid)
    expect(fog).toEqual({
      base: 'revealed',
      shapes: [rect('cover', 0, 0, 200, 100), rect('cover', 300, 0, 100, 100)]
    })
    expect(fogAt(fog, 150, 50)).toBe(true)
    expect(fogAt(fog, 250, 50)).toBe(false)
    expect(fogAt(fog, 50, 150)).toBe(false)
    // a negative colStart from an offset grid lands on the right pixels
    const off = fromCellFog({ colStart: -1, rowStart: 0, cols: 1, rows: 1, covered: toBase64(new Uint8Array([1])) }, { ...grid, offsetX: 30 })
    expect(off.shapes).toEqual([rect('cover', -70, 0, 100, 100)])
  })
})
