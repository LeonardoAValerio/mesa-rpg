import { fromBase64 } from './base64'
import { cellOrigin } from './grid'
import type { Fog, FogMode, FogShape, Grid, Token } from './types'

export type { FogMode } from './types'

export const BRUSH_MIN = 0.5
export const BRUSH_MAX = 10
export const MAX_SHAPES = 2000
export const MAX_POINTS = 2000
export const TOO_MANY_SHAPES = 'Névoa com formas demais: use Cobrir tudo ou Revelar tudo'

/** FOGS-05: the whole map covered, or revealed; both start the shape list over. */
export const coverAll = (): Fog => ({ base: 'covered', shapes: [] })
export const revealAll = (): Fog => ({ base: 'revealed', shapes: [] })

/** FOGT-06: the brush radius in cells, 0.5 to 10 in steps of 0.5. */
export function clampBrushCells(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, Math.round(value * 2) / 2))
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function inPolygon(points: number[], x: number, y: number): boolean {
  let inside = false
  const n = points.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[2 * i]
    const yi = points[2 * i + 1]
    const xj = points[2 * j]
    const yj = points[2 * j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Whether one shape holds the point (x, y). */
export function shapeContains(shape: FogShape, x: number, y: number): boolean {
  switch (shape.kind) {
    case 'rect':
      return x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h
    case 'poly':
      return inPolygon(shape.points, x, y)
    case 'stroke': {
      const p = shape.points
      if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= shape.radius
      for (let i = 0; i + 3 < p.length; i += 2) if (distToSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= shape.radius) return true
      return false
    }
  }
}

/** FOGS-04: covered when the last shape holding the point is a Cobrir; with none, the base decides. */
export function fogAt(fog: Fog, x: number, y: number): boolean {
  for (let i = fog.shapes.length - 1; i >= 0; i--) {
    const s = fog.shapes[i]
    if (shapeContains(s, x, y)) return s.mode === 'cover'
  }
  return fog.base === 'covered'
}

const distinctPoints = (points: number[]): number => new Set(Array.from({ length: points.length / 2 }, (_, i) => `${points[2 * i]},${points[2 * i + 1]}`)).size

/** A shape with no area: a flat rectangle, a polygon under 3 distinct points, an empty stroke. */
export function degenerate(shape: FogShape): boolean {
  if (shape.kind === 'rect') return !(shape.w > 0 && shape.h > 0)
  if (shape.kind === 'poly') return shape.points.length % 2 !== 0 || distinctPoints(shape.points) < 3
  return shape.points.length < 2 || shape.points.length % 2 !== 0 || !(shape.radius > 0)
}

/** FOGS-08: the fog with one more shape; a degenerate shape changes nothing; past the limits, the refusal. */
export function addShape(fog: Fog, shape: FogShape): { ok: true; fog: Fog } | { ok: false; reason: string } {
  if ('points' in shape && shape.points.length / 2 > MAX_POINTS) return { ok: false, reason: TOO_MANY_SHAPES }
  if (degenerate(shape)) return { ok: true, fog }
  if (fog.shapes.length >= MAX_SHAPES) return { ok: false, reason: TOO_MANY_SHAPES }
  return { ok: true, fog: { ...fog, shapes: [...fog.shapes, shape] } }
}

/** FOGS-06: a token is under the fog when its centre is. */
export function tokenCovered(fog: Fog, grid: Grid, t: Token): boolean {
  const o = cellOrigin(grid, t.col, t.row)
  return fogAt(fog, o.x + (t.size * grid.cell) / 2, o.y + (t.size * grid.cell) / 2)
}

/** The fog of `.mesa` version 1: a bitset over grid cells, bit 1 = covered. */
export interface CellFog {
  colStart: number
  rowStart: number
  cols: number
  rows: number
  covered: string
}

/** FOGS-10: each run of covered cells in a row becomes one covered rectangle over a revealed base. */
export function fromCellFog(old: CellFog, grid: Grid): Fog {
  const bits = fromBase64(old.covered) ?? new Uint8Array(0)
  const at = (i: number): boolean => ((bits[i >> 3] ?? 0) & (1 << (i & 7))) !== 0
  const shapes: FogShape[] = []
  for (let r = 0; r < old.rows; r++) {
    let c = 0
    while (c < old.cols) {
      if (!at(r * old.cols + c)) {
        c++
        continue
      }
      const start = c
      while (c < old.cols && at(r * old.cols + c)) c++
      const o = cellOrigin(grid, old.colStart + start, old.rowStart + r)
      shapes.push({ kind: 'rect', mode: 'cover', x: o.x, y: o.y, w: (c - start) * grid.cell, h: grid.cell })
    }
  }
  return { base: 'revealed', shapes }
}

export type { FogShape }
