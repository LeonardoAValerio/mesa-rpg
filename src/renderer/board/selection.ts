import { Graphics, type FederatedPointerEvent } from 'pixi.js'
import { canMove, clampWidth, normalizeRotation, ROTATION_STEP } from '../../core/items'
import type { Token } from '../../core/types'
import type { TableClient } from '../net/table-client'
import type { Board } from './board'

const HANDLE_PX = 12

export interface SelectionSnapshot {
  id: string | null
  /** The drawn outline's corners, in map pixels; empty with nothing selected. */
  outline: Array<[number, number]>
  /** The drawn resize handle's centre (master only), in map pixels. */
  handle: [number, number] | null
  /** The width shown while the handle is dragged, in cells. */
  resizing: number | null
}

/**
 * ITEM-04, ITEM-13: the selected item (a click selects it, in any window) gets an outline; Q and E rotate it 15° when
 * the viewer may move it; the master drags the corner handle to resize it in steps of 0.25 cell, keeping the aspect.
 */
export class Selection {
  private id: string | null = null
  private readonly outline = new Graphics()
  private readonly handle = new Graphics()
  private resize: { width: number } | null = null
  /** The last rotation sent, so quick key presses add up before the server answers. */
  private sent: { id: string; rotation: number } | null = null
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
      client.on('view', () => this.draw())
    )
  }

  get selected(): string | null {
    return this.id
  }

  select(id: string | null): void {
    this.id = id
    this.resize = null
    this.draw()
  }

  private item(): Token | null {
    return this.id ? (this.client.view?.tokens[this.id] ?? null) : null
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
    const t = this.item()
    if (!t) {
      if (this.id) this.id = null // gone from this view
      return
    }
    const line = 2 / this.board.camera.scale
    const c = this.corners(t, this.resize?.width ?? t.width)
    this.outline.poly(c.flat(), true).stroke({ width: line, color: 0xffffff, alpha: 0.9 })
    if (this.client.you?.role === 'master' && this.board.tool === 'select') {
      const s = HANDLE_PX / this.board.camera.scale
      this.handle.rect(c[2][0] - s / 2, c[2][1] - s / 2, s, s).fill(0xffffff).stroke({ width: line, color: 0x111827 })
    }
  }

  /** ITEM-13: E turns clockwise, Q anticlockwise; nothing when the viewer may not move it (the server says why). */
  private key = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
    if (e.key === 'Escape') return this.board.deselect()
    const key = e.key.toLowerCase()
    if (key !== 'q' && key !== 'e') return
    const t = this.item()
    const you = this.client.you
    if (!t || !you || !canMove(t, you).ok) return
    const from = this.sent?.id === t.id ? this.sent.rotation : t.rotation
    const rotation = normalizeRotation(from + (key === 'e' ? ROTATION_STEP : -ROTATION_STEP))
    this.sent = { id: t.id, rotation }
    void this.client.send({ type: 'token/rotate', id: t.id, rotation }).then((r) => {
      if (!r.ok || this.sent?.rotation === rotation) this.sent = null // refused, or the last one is in
    })
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
