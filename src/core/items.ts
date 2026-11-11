import { cellOrigin } from './grid'
import type { Actor, Faction, Grid } from './types'

export type ItemKind = 'character' | 'object'
export type Movement = 'free' | 'master' | 'locked'

/** A token or an object on the table (AD-007). `x, y` is its centre in map pixels; `width` is in cells. */
export interface Item {
  id: string
  name: string
  hash: string
  kind: ItemKind
  x: number
  y: number
  width: number
  rotation: number
  ring: Faction | null
  owner: string | null
  hidden: boolean
  movement: Movement
  /** BRD-15..21: items with the same group move together; absent or null when alone. */
  group?: string | null
}

export const WIDTH_MIN = 0.25
export const WIDTH_MAX = 20
export const ROTATION_STEP = 15
export const MASTER_ONLY_ITEM = 'Só o mestre move este item'
export const LOCKED_ITEM = 'Item travado'

/** ITEM-03: a width in cells, 0.25 to 20 in steps of 0.25. */
export function clampWidth(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(value * 4) / 4))
}

/** ITEM-12: a multiple of 15 degrees in 0..345. */
export function normalizeRotation(value: number): number {
  if (!Number.isFinite(value)) return 0
  const r = Math.round(value / ROTATION_STEP) * ROTATION_STEP
  return ((r % 360) + 360) % 360
}

/**
 * BRD-01: the snapped centre, axis by axis: a side that is an even whole number of cells (2, 4...) puts the centre on
 * the nearest grid line, so the item fills whole cells; any other side (1, 3, 1.5, 2.5...) on the nearest cell centre.
 */
export function snapCentre(grid: Grid, x: number, y: number, wCells: number, hCells: number): { x: number; y: number } {
  const axis = (v: number, offset: number, cells: number): number => {
    const even = Number.isInteger(cells) && cells % 2 === 0
    if (even) return offset + Math.round((v - offset) / grid.cell) * grid.cell
    return offset + (Math.floor((v - offset) / grid.cell) + 0.5) * grid.cell
  }
  return { x: axis(x, grid.offsetX, wCells), y: axis(y, grid.offsetY, hCells) }
}

/** The drawn box of a `w` x `h` item turned by `rotation` degrees, in the same units (what the snap aligns). */
export function rotatedExtent(w: number, h: number, rotation: number): { w: number; h: number } {
  const a = (rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  const round = (v: number): number => Math.round(v * 1e9) / 1e9 // 90° gives exact sides, not 1e-17 leftovers
  return { w: round(w * cos + h * sin), h: round(w * sin + h * cos) }
}

/** ITEM-08, ITEM-09: a character snaps and an object stays where dropped; Shift held at the drop does the opposite. */
export function dropPosition(kind: ItemKind, shift: boolean, grid: Grid, x: number, y: number, wCells: number, hCells: number): { x: number; y: number } {
  // BRD-04: with the grid hidden nothing snaps unless Shift is held
  const snap = grid.visible === false ? shift : (kind === 'character') !== shift
  return snap ? snapCentre(grid, x, y, wCells, hCells) : { x, y }
}

/** ITEM-14..16: who may move or rotate an item. Visibility is checked by the caller. */
export function canMove(item: Pick<Item, 'movement'>, actor: Actor): { ok: true } | { ok: false; reason: string } {
  if (item.movement === 'locked') return { ok: false, reason: LOCKED_ITEM }
  if (item.movement === 'master' && actor.role !== 'master') return { ok: false, reason: MASTER_ONLY_ITEM }
  return { ok: true }
}

/** A token as `.mesa` versions 1 and 2 stored it: size×size cells from (col, row). */
export interface OldToken {
  id: string
  name: string
  hash: string
  faction: Faction
  size: 1 | 2 | 3
  col: number
  row: number
  owner: string | null
  hidden: boolean
}

/** ITEM-20: an old token becomes a character centred on the cells it covered, as wide as its size, with its faction as ring. */
export function fromOldToken(t: OldToken, grid: Grid): Item {
  const o = cellOrigin(grid, t.col, t.row)
  const half = (t.size * grid.cell) / 2
  return {
    id: t.id,
    name: t.name,
    hash: t.hash,
    kind: 'character',
    x: o.x + half,
    y: o.y + half,
    width: t.size,
    rotation: 0,
    ring: t.faction,
    owner: t.owner,
    hidden: t.hidden,
    movement: 'free'
  }
}
