import { DEFAULT_GRID, type Grid, type MapRef } from './types'

export const CELL_MIN = 10
export const CELL_MAX = 500

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** MAP-06: every grid value outside its bounds goes to the nearest bound. */
export function clampGrid(patch: Partial<Grid>, base: Grid = DEFAULT_GRID): Grid {
  const cell = clamp(finite(patch.cell) ? patch.cell : base.cell, CELL_MIN, CELL_MAX)
  const offsetX = clamp(finite(patch.offsetX) ? patch.offsetX : base.offsetX, 0, cell)
  const offsetY = clamp(finite(patch.offsetY) ? patch.offsetY : base.offsetY, 0, cell)
  const opacity = clamp(finite(patch.opacity) ? patch.opacity : base.opacity, 0, 1)
  const color = typeof patch.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(patch.color) ? patch.color.toLowerCase() : base.color
  const visible = typeof patch.visible === 'boolean' ? patch.visible : base.visible !== false // BRD-06: old files have none
  return { cell, offsetX, offsetY, color, opacity, visible }
}

export interface Cell {
  col: number
  row: number
}

/** The cell under a map pixel. */
export function cellAt(grid: Grid, x: number, y: number): Cell {
  return { col: Math.floor((x - grid.offsetX) / grid.cell), row: Math.floor((y - grid.offsetY) / grid.cell) }
}

/** Top-left pixel of a cell. */
export function cellOrigin(grid: Grid, col: number, row: number): { x: number; y: number } {
  return { x: grid.offsetX + col * grid.cell, y: grid.offsetY + row * grid.cell }
}

/** TOOL-01: distance in cells; a diagonal step counts as 1. */
export function rulerDistance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

/** TOK-10: a token is on the map when its centre falls inside the image. */
export function insideMap(grid: Grid, map: MapRef, col: number, row: number, size: number): boolean {
  const o = cellOrigin(grid, col, row)
  const cx = o.x + (size * grid.cell) / 2
  const cy = o.y + (size * grid.cell) / 2
  return cx >= 0 && cy >= 0 && cx < map.width && cy < map.height
}
