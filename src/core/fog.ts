import { fromBase64, toBase64 } from './base64'
import type { Fog, Grid, MapRef, Token } from './types'

export type FogMode = 'reveal' | 'cover'
export const BRUSH_MIN = 1
export const BRUSH_MAX = 10

export interface FogDims {
  colStart: number
  rowStart: number
  cols: number
  rows: number
}

const byteLength = (d: FogDims): number => Math.ceil((d.cols * d.rows) / 8)

/** Every cell that touches the image, given the grid offset. */
export function fogDims(map: MapRef, grid: Grid): FogDims {
  const colStart = -Math.ceil(grid.offsetX / grid.cell) || 0 // never -0
  const rowStart = -Math.ceil(grid.offsetY / grid.cell) || 0
  const colEnd = Math.ceil((map.width - grid.offsetX) / grid.cell)
  const rowEnd = Math.ceil((map.height - grid.offsetY) / grid.cell)
  return { colStart, rowStart, cols: colEnd - colStart, rows: rowEnd - rowStart }
}

/** FOG-01, FOG-05: every cell covered. */
export function coverAll(d: FogDims): Fog {
  const bits = new Uint8Array(byteLength(d))
  for (let i = 0; i < d.cols * d.rows; i++) bits[i >> 3] |= 1 << (i & 7)
  return { ...d, covered: toBase64(bits) }
}

function bitsOf(fog: Fog): Uint8Array {
  const out = new Uint8Array(byteLength(fog))
  out.set((fromBase64(fog.covered) ?? new Uint8Array(0)).subarray(0, out.length))
  return out
}

const indexOf = (fog: FogDims, col: number, row: number): number | null => {
  const c = col - fog.colStart
  const r = row - fog.rowStart
  if (c < 0 || r < 0 || c >= fog.cols || r >= fog.rows) return null
  return r * fog.cols + c
}

/** Cells outside the fog grid count as covered. */
export function isCovered(fog: Fog, col: number, row: number): boolean {
  const i = indexOf(fog, col, row)
  if (i === null) return true
  return (bitsOf(fog)[i >> 3] & (1 << (i & 7))) !== 0
}

function paint(fog: Fog, grid: Grid, mode: FogMode, inside: (cx: number, cy: number) => boolean): Fog {
  const bits = bitsOf(fog)
  for (let r = 0; r < fog.rows; r++) {
    for (let c = 0; c < fog.cols; c++) {
      const cx = grid.offsetX + (fog.colStart + c + 0.5) * grid.cell
      const cy = grid.offsetY + (fog.rowStart + r + 0.5) * grid.cell
      if (!inside(cx, cy)) continue
      const i = r * fog.cols + c
      if (mode === 'cover') bits[i >> 3] |= 1 << (i & 7)
      else bits[i >> 3] &= ~(1 << (i & 7))
    }
  }
  return { ...fog, covered: toBase64(bits) }
}

/** FOG-03: reveals or covers the cells whose centre is within `radius` cells of (x, y). */
export function brush(fog: Fog, grid: Grid, x: number, y: number, radius: number, mode: FogMode): Fog {
  const rad = Math.min(BRUSH_MAX, Math.max(BRUSH_MIN, Math.round(radius))) * grid.cell
  return paint(fog, grid, mode, (cx, cy) => (cx - x) ** 2 + (cy - y) ** 2 <= rad * rad)
}

/** FOG-04: reveals or covers the cells whose centre is inside the rectangle. */
export function rect(fog: Fog, grid: Grid, x0: number, y0: number, x1: number, y1: number, mode: FogMode): Fog {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)]
  const [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)]
  return paint(fog, grid, mode, (cx, cy) => cx >= ax && cx <= bx && cy >= ay && cy <= by)
}

/** FOG-06: a token is under the fog when any of its cells is covered. */
export function tokenCovered(fog: Fog, t: Token): boolean {
  for (let r = 0; r < t.size; r++) for (let c = 0; c < t.size; c++) if (isCovered(fog, t.col + c, t.row + r)) return true
  return false
}

/** Covered cells as [col, row] pairs, for drawing. */
export function coveredCells(fog: Fog): Array<[number, number]> {
  const bits = bitsOf(fog)
  const out: Array<[number, number]> = []
  for (let i = 0; i < fog.cols * fog.rows; i++) {
    if (bits[i >> 3] & (1 << (i & 7))) out.push([fog.colStart + (i % fog.cols), fog.rowStart + Math.floor(i / fog.cols)])
  }
  return out
}
