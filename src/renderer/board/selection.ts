import { Graphics, type FederatedPointerEvent } from 'pixi.js'
import { canMove, clampWidth, normalizeRotation, ROTATION_STEP } from '../../core/items'
import type { Token } from '../../core/types'
import type { TableClient } from '../net/table-client'
import type { Board } from './board'

const HANDLE_PX = 12

export interface SelectionSnapshot {
  /** The one selected item, or null with none or several. */
  id: string | null
  /** BRD-08..14: every selected item. */
  ids: string[]
  /** How many outlines are drawn (one per selected item, BRD-14). */
  outlines: number
  /** The drawn outline's corners, in map pixels; empty with nothing selected. */
  outline: Array<[number, number]>
  /** The drawn resize handle's centre (master only), in map pixels. */
  handle: [number, number] | null
  /** The width shown while the handle is dragged, in cells. */
  resizing: number | null
}

/**
 * ITEM-04, ITEM-13, BRD-08..14: the selected items (this window's own) each get an outline; Q and E turn each one
 * 15° the viewer may move; the master's Delete removes them; with one item the master drags the corner handle to
 * resize it in steps of 0.25 cell, keeping the aspect.
 */
export class Selection {
  private list: string[] = []
  /** Called whenever the selected items change (the group bar follows it). */
  readonly changed = new Set<() => void>()
  private outlineCount = 0
  private readonly outline = new Graphics()
  private readonly handle = new Graphics()
  private resize: { width: number } | null = null
  /**
   * The last rotation sent, so quick key presses add up before the view has it. The server acks before it sends the
   * patch, so it is dropped on the first view after the ack of the last one, not on the ack itself.
   */
  private sent = new Map<string, { rotation: number; acked: boolean }>()
  private readonly offs: Array<() => void> = []

  constructor(private readonly board: Board, private readonly client: TableClient) {
    board.overlayLayer.addChild(this.outline, this.handle)
    const stage = board.app.stage
    stage.on('pointerdown', this.stageDown)
    stage.on('pointermove', this.moveResize)
    stage.on('pointerup', this.endResize)
    stage.on('pointerupoutside', this.endResize)
    window.addEventListener('keydown', this.key)
    this.offs.push(
      () => stage.off('pointerdown', this.stageDown),
      () => stage.off('pointermove', this.moveResize),
      () => stage.off('pointerup', this.endResize),
      () => stage.off('pointerupoutside', this.endResize),
      () => window.removeEventListener('keydown', this.key),
      client.on('view', () => {
        for (const [id, s] of this.sent) if (s.acked) this.sent.delete(id)
        this.draw()
      })
    )
  }

  /** The one selected item, or null with none or several. */
  get selected(): string | null {
    return this.list.length === 1 ? this.list[0] : null
  }

  get ids(): string[] {
    return [...this.list]
  }

  has(id: string): boolean {
    return this.list.includes(id)
  }

  select(id: string | null): void {
    this.set(id ? [id] : [])
  }

  set(ids: string[]): void {
    this.list = [...new Set(ids)]
    this.resize = null
    this.draw()
    for (const fn of this.changed) fn()
  }

  /** BRD-09: Shift+click adds an item, or takes it out. */
  toggle(id: string): void {
    this.set(this.has(id) ? this.list.filter((x) => x !== id) : [...this.list, id])
  }

  private item(): Token | null {
    const id = this.selected
    return id ? (this.client.view?.tokens[id] ?? null) : null
  }

  private items(): Token[] {
    const tokens = this.client.view?.tokens ?? {}
    return this.list.map((id) => tokens[id]).filter((t): t is Token => !!t)
  }

  /** The item's drawn corners and size, rotated, in map pixels. */
  private corners(t: Token, widthCells: number): Array<[number, number]> {
    const cell = this.client.view!.grid.cell
    const w = widthCells * cell
    const h = w * this.board.aspect(t.hash)
    const a = (t.rotation * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as Array<[number, number]>).map(([x, y]) => [t.x + x * cos - y * sin, t.y + x * sin + y * cos])
  }

  draw(): void {
    this.outline.clear()
    this.handle.clear()
    this.outlineCount = 0
    const items = this.items()
    if (items.length !== this.list.length) {
      this.list = items.map((t) => t.id) // gone from this view
      for (const fn of this.changed) fn()
    }
    if (!items.length) return
    const line = 2 / this.board.camera.scale
    for (const t of items) {
      const c = this.corners(t, items.length === 1 ? (this.resize?.width ?? t.width) : t.width)
      this.outline.poly(c.flat(), true).stroke({ width: line, color: 0xffffff, alpha: 0.9 })
      this.outlineCount++
    }
    const t = this.item()
    if (!t) return // the resize handle is for one item only
    const c = this.corners(t, this.resize?.width ?? t.width)
    if (this.client.you?.role === 'master' && this.board.tool === 'select') {
      const s = HANDLE_PX / this.board.camera.scale
      this.handle.rect(c[2][0] - s / 2, c[2][1] - s / 2, s, s).fill(0xffffff).stroke({ width: line, color: 0x111827 })
    }
  }

  /**
   * ITEM-13, BRD-11..13: E turns each selected item clockwise, Q anticlockwise (those the viewer may move); the
   * master's Delete removes them; Esc clears.
   */
  private key = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'Escape') return this.board.deselect()
    const you = this.client.you
    if (!you) return
    if (e.key === 'Delete') {
      if (you.role !== 'master') return // BRD-12: a player's Delete removes nothing
      const items = this.items()
      if (!items.length) return
      for (const t of items) void this.client.send({ type: 'token/remove', id: t.id })
      this.board.deselect()
      return
    }
    const key = e.key.toLowerCase()
    if (key !== 'q' && key !== 'e' || e.ctrlKey || e.metaKey || e.altKey) return
    for (const t of this.items()) {
      if (!canMove(t, you).ok) continue
      const from = this.sent.get(t.id)?.rotation ?? t.rotation
      const rotation = normalizeRotation(from + (key === 'e' ? ROTATION_STEP : -ROTATION_STEP))
      const sent = { rotation, acked: false }
      this.sent.set(t.id, sent)
      void this.client.send({ type: 'token/rotate', id: t.id, rotation }).then((r) => {
        if (this.sent.get(t.id) !== sent) return // a later press is on its way
        if (r.ok) sent.acked = true // the patch with it is next
        else this.sent.delete(t.id)
      })
    }
  }

  /** Whether a map point is on the master's resize handle. */
  onHandle(p: { x: number; y: number }): boolean {
    const t = this.item()
    if (!t || this.client.you?.role !== 'master' || !this.handleActive) return false
    const [, , corner] = this.corners(t, t.width)
    const r = HANDLE_PX / this.board.camera.scale
    return Math.abs(p.x - corner[0]) <= r && Math.abs(p.y - corner[1]) <= r
  }

  /** ITEM-04: a press on the handle starts a resize; the item under it is not dragged. */
  beginResize(): void {
    const t = this.item()
    if (t && this.client.you?.role === 'master') this.resize = { width: t.width }
  }

  private stageDown = (e: FederatedPointerEvent): void => {
    if (e.button === 0 && !this.resize && this.onHandle(this.board.toWorld(e.global.x, e.global.y))) this.beginResize()
  }

  /** The handle works with the select tool only, and never while Space pans (MAP-08). */
  private get handleActive(): boolean {
    return this.board.tool === 'select' && !this.board.spaceHeld
  }

  /** ITEM-04: the width follows the handle's distance from the centre, along the item's own axis. */
  private moveResize = (e: FederatedPointerEvent): void => {
    const t = this.item()
    if (!this.resize || !t) return
    const p = this.board.toWorld(e.global.x, e.global.y)
    const a = (-t.rotation * Math.PI) / 180
    const dx = (p.x - t.x) * Math.cos(a) - (p.y - t.y) * Math.sin(a)
    const dy = (p.x - t.x) * Math.sin(a) + (p.y - t.y) * Math.cos(a)
    const cell = this.client.view!.grid.cell
    const aspect = this.board.aspect(t.hash)
    const half = Math.max(Math.abs(dx), Math.abs(dy) / aspect) // the corner sits at (w/2, h/2)
    this.resize.width = clampWidth((2 * half) / cell)
    this.draw()
  }

  private endResize = (): void => {
    const t = this.item()
    const r = this.resize
    this.resize = null
    if (!t || !r) return
    if (r.width !== t.width) void this.client.send({ type: 'token/update', id: t.id, width: r.width })
    this.draw()
  }

  snapshot(): SelectionSnapshot {
    const t = this.item()
    const ob = this.outline.getLocalBounds()
    const hb = this.handle.getLocalBounds()
    return {
      id: t ? t.id : null,
      ids: this.items().map((x) => x.id),
      outlines: this.outlineCount,
      outline: t && ob.width > 0 ? this.corners(t, this.resize?.width ?? t.width) : [],
      handle: hb.width > 0 ? [hb.x + hb.width / 2, hb.y + hb.height / 2] : null,
      resizing: this.resize?.width ?? null
    }
  }

  destroy(): void {
    for (const off of this.offs) off()
    this.outline.destroy()
    this.handle.destroy()
  }
}
