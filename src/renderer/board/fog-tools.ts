import { Graphics, type FederatedPointerEvent } from 'pixi.js'
import { clampBrushCells, MAX_POINTS, type FogMode } from '../../core/fog'
import type { FogShape } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from '../ui/dom'
import type { Board, Tool } from './board'
import { drawShape } from './fog-layer'

type Pt = { x: number; y: number }
const FOG_TOOLS: Tool[] = ['fog-brush', 'fog-rect', 'fog-poly']
const PREVIEW = { cover: 0x0f172a, reveal: 0xfacc15 }
/** A click this close (in screen px) to the first point closes the polygon. */
const CLOSE_PX = 12

export interface FogToolSnapshot {
  mode: FogMode
  radiusCells: number
  /** The circle drawn under the cursor, measured from what is drawn, in map pixels (FOGT-03). */
  cursor: { x: number; y: number; r: number } | null
  /** The shape being drawn and the box of what is drawn for it, shown only in this window (FOGT-04). */
  preview: { kind: FogShape['kind']; mode: FogMode; points: number; x: number; y: number; w: number; h: number } | null
}

/**
 * FOGS-01..03, FOGT-01..07: the master's fog brush, rectangle and polygon. The mode and the brush radius sit in the
 * toolbar next to the tools and show only while one of them is picked; Alt held at the start inverts the mode; the
 * shape is previewed here and sent once, on release (brush, rectangle) or when the polygon closes.
 */
export class FogTools {
  readonly modes: HTMLElement
  readonly panel: HTMLElement
  private mode: FogMode = 'cover'
  private radiusCells = 1
  private cursor: Pt | null = null
  private drawing: { kind: 'stroke' | 'rect' | 'poly'; mode: FogMode; points: Pt[] } | null = null
  private readonly preview = new Graphics()
  private readonly ring = new Graphics()
  private readonly coverBtn: HTMLButtonElement
  private readonly revealBtn: HTMLButtonElement
  private readonly radiusInput: HTMLInputElement
  private readonly error: HTMLElement
  private readonly offs: Array<() => void> = []

  constructor(private readonly board: Board, private readonly client: TableClient, toolbar: HTMLElement) {
    board.overlayLayer.addChild(this.preview, this.ring)
    const modeBtn = (m: FogMode, label: string): HTMLButtonElement =>
      h('button', { testid: `fog-mode-${m}`, class: 'secondary', 'aria-pressed': String(m === this.mode), onclick: () => this.setMode(m) }, label)
    this.coverBtn = modeBtn('cover', 'Cobrir')
    this.revealBtn = modeBtn('reveal', 'Revelar')
    this.radiusInput = h('input', { type: 'number', testid: 'fog-radius', min: 0.5, max: 10, step: 0.5, value: '1', title: 'Raio do pincel (células)' })
    this.radiusInput.addEventListener('change', () => this.setRadius(Number(this.radiusInput.value)))
    const radius = h('label', { class: 'fog-radius', testid: 'fog-radius-label' }, 'Raio', this.radiusInput)
    this.modes = h('div', { class: 'fog-modes', testid: 'fog-modes', hidden: true }, this.coverBtn, this.revealBtn, radius)
    toolbar.append(this.modes)
    this.error = h('p', { class: 'error', testid: 'fog-error', role: 'alert' })
    this.panel = h('section', { class: 'panel', testid: 'fog-panel' },
      h('h3', {}, 'Névoa'),
      h('div', { class: 'row' },
        h('button', { testid: 'fog-cover-all', class: 'secondary', onclick: () => void this.send({ type: 'fog/coverAll' }) }, 'Cobrir tudo'),
        h('button', { testid: 'fog-reveal-all', class: 'secondary', onclick: () => void this.send({ type: 'fog/revealAll' }) }, 'Revelar tudo')
      ),
      this.error
    )
    const stage = board.app.stage
    stage.on('pointerdown', this.down)
    stage.on('pointermove', this.move)
    stage.on('pointerup', this.up)
    stage.on('pointerupoutside', this.up)
    this.offs.push(
      () => stage.off('pointerdown', this.down),
      () => stage.off('pointermove', this.move),
      () => stage.off('pointerup', this.up),
      () => stage.off('pointerupoutside', this.up),
      board.onToolChange((tool) => this.toolChanged(tool))
    )
    const canvas = board.app.canvas
    canvas.addEventListener('dblclick', this.dblclick)
    window.addEventListener('keydown', this.key)
    this.offs.push(() => canvas.removeEventListener('dblclick', this.dblclick), () => window.removeEventListener('keydown', this.key))
    this.toolChanged(board.tool)
  }

  /** FOGS-08: a refusal (the limit message) shows in the fog panel; the next accepted action clears it. */
  private async send(action: Parameters<TableClient['send']>[0]): Promise<void> {
    const r = await this.client.send(action)
    this.error.textContent = r.ok ? '' : r.reason
  }

  private get active(): boolean {
    return FOG_TOOLS.includes(this.board.tool)
  }

  private get radiusPx(): number {
    return this.radiusCells * (this.client.view?.grid.cell ?? 100)
  }

  /** FOGT-01, FOGT-07: the modes show with a fog tool only; the radius only with the brush. */
  private toolChanged(tool: Tool): void {
    this.modes.hidden = !FOG_TOOLS.includes(tool)
    const label = this.modes.querySelector<HTMLElement>('[data-testid=fog-radius-label]')
    if (label) label.hidden = tool !== 'fog-brush'
    this.drawing = null
    this.draw()
  }

  setMode(m: FogMode): void {
    this.mode = m
    this.coverBtn.setAttribute('aria-pressed', String(m === 'cover'))
    this.revealBtn.setAttribute('aria-pressed', String(m === 'reveal'))
  }

  /** FOGT-06 */
  setRadius(value: number): void {
    this.radiusCells = clampBrushCells(value)
    this.radiusInput.value = String(this.radiusCells)
    this.draw()
  }

  private world(e: FederatedPointerEvent): Pt {
    return this.board.toWorld(e.global.x, e.global.y)
  }

  /** FOGT-02: Alt at the start of a shape draws it in the other mode. */
  private modeFor(e: FederatedPointerEvent): FogMode {
    return e.altKey ? (this.mode === 'cover' ? 'reveal' : 'cover') : this.mode
  }

  private down = (e: FederatedPointerEvent): void => {
    if (!this.active || e.button !== 0 || this.board.spaceHeld || !this.client.view?.map) return
    const p = this.world(e)
    if (this.board.tool === 'fog-brush') this.drawing = { kind: 'stroke', mode: this.modeFor(e), points: [p] }
    else if (this.board.tool === 'fog-rect') this.drawing = { kind: 'rect', mode: this.modeFor(e), points: [p, p] }
    else if (this.board.tool === 'fog-poly') return this.polyClick(p, e)
    this.draw()
  }

  private move = (e: FederatedPointerEvent): void => {
    if (!this.active) return
    const p = this.world(e)
    this.cursor = p
    const d = this.drawing
    if (d?.kind === 'stroke') {
      const last = d.points[d.points.length - 1]
      // keeps a stroke small; past the limit one extra point is enough for the server's refusal (FOGS-08)
      if (d.points.length <= MAX_POINTS && Math.hypot(p.x - last.x, p.y - last.y) >= this.radiusPx / 4) d.points.push(p)
    } else if (d?.kind === 'rect') d.points[1] = p
    this.draw()
  }

  /** FOGS-03: each click adds a point; a click on the first point closes it. */
  private polyClick(p: Pt, e: FederatedPointerEvent): void {
    const d = this.drawing
    if (d?.kind !== 'poly') {
      this.drawing = { kind: 'poly', mode: this.modeFor(e), points: [p] }
      return this.draw()
    }
    const first = d.points[0]
    const near = Math.hypot(p.x - first.x, p.y - first.y) * this.board.camera.scale <= CLOSE_PX
    if (near && d.points.length >= 3) return this.closePoly()
    const last = d.points[d.points.length - 1]
    if ((last.x !== p.x || last.y !== p.y) && d.points.length <= MAX_POINTS) d.points.push(p)
    this.draw()
  }

  /** Double click, Enter or the first point: the polygon is sent if it has 3 distinct points. */
  private closePoly(): void {
    const d = this.drawing
    if (d?.kind !== 'poly') return
    this.drawing = null
    this.draw()
    const distinct = new Set(d.points.map((q) => `${q.x},${q.y}`)).size
    if (distinct < 3) return
    void this.send({ type: 'fog/shape', shape: { kind: 'poly', mode: d.mode, points: d.points.flatMap((q) => [q.x, q.y]) } })
  }

  private dblclick = (): void => {
    if (this.board.tool === 'fog-poly') this.closePoly()
  }

  /** Enter closes the polygon; Esc drops it and sends nothing (FOGT-05). */
  private key = (e: KeyboardEvent): void => {
    if (this.drawing?.kind !== 'poly' || e.target instanceof HTMLInputElement) return
    if (e.key === 'Enter') this.closePoly()
    else if (e.key === 'Escape') {
      this.drawing = null
      this.draw()
    }
  }

  private up = (e: FederatedPointerEvent): void => {
    const d = this.drawing
    if (!d || d.kind === 'poly') return
    this.drawing = null
    const p = this.world(e)
    let shape: FogShape
    if (d.kind === 'stroke') {
      const last = d.points[d.points.length - 1]
      if ((last.x !== p.x || last.y !== p.y) && d.points.length <= MAX_POINTS) d.points.push(p)
      shape = { kind: 'stroke', mode: d.mode, radius: this.radiusPx, points: d.points.flatMap((q) => [q.x, q.y]) }
    } else {
      const [a] = d.points
      shape = { kind: 'rect', mode: d.mode, x: Math.min(a.x, p.x), y: Math.min(a.y, p.y), w: Math.abs(p.x - a.x), h: Math.abs(p.y - a.y) }
      if (shape.w === 0 || shape.h === 0) return this.draw() // a click is not a rectangle
    }
    this.draw()
    void this.send({ type: 'fog/shape', shape })
  }

  private current(): FogShape | null {
    const d = this.drawing
    if (!d) return null
    if (d.kind === 'stroke') return { kind: 'stroke', mode: d.mode, radius: this.radiusPx, points: d.points.flatMap((q) => [q.x, q.y]) }
    if (d.kind === 'poly') {
      const pts = this.cursor ? [...d.points, this.cursor] : d.points // the edge follows the cursor
      return { kind: 'poly', mode: d.mode, points: pts.flatMap((q) => [q.x, q.y]) }
    }
    const [a, b] = d.points
    return { kind: 'rect', mode: d.mode, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
  }

  /** FOGT-03, FOGT-04: the circle under the cursor and the shape being drawn, in this window only. */
  private draw(): void {
    this.preview.clear()
    this.ring.clear()
    const shape = this.current()
    if (shape?.kind === 'poly') {
      const p = shape.points
      this.preview.alpha = 0.8
      this.preview.tint = 0xffffff
      this.preview.moveTo(p[0], p[1])
      for (let i = 2; i + 1 < p.length; i += 2) this.preview.lineTo(p[i], p[i + 1])
      this.preview.stroke({ width: 2 / this.board.camera.scale, color: PREVIEW[shape.mode] === PREVIEW.cover ? 0xffffff : PREVIEW.reveal })
      this.preview.circle(p[0], p[1], CLOSE_PX / this.board.camera.scale).stroke({ width: 2 / this.board.camera.scale, color: 0xffffff })
    } else if (shape) {
      this.preview.alpha = 0.45
      drawShape(this.preview, shape, 1)
      this.preview.tint = PREVIEW[shape.mode]
    }
    if (this.board.tool === 'fog-brush' && this.cursor) {
      this.ring.circle(this.cursor.x, this.cursor.y, this.radiusPx).stroke({ width: 2 / this.board.camera.scale, color: PREVIEW[this.mode] === PREVIEW.cover ? 0xffffff : PREVIEW.reveal })
    }
  }

  snapshot(): FogToolSnapshot {
    const shape = this.current()
    const ring = this.ring.getLocalBounds()
    const box = this.preview.getLocalBounds()
    const stroke = 2 / this.board.camera.scale // the ring's line straddles its radius
    return {
      mode: this.mode,
      radiusCells: this.radiusCells,
      cursor: ring.width > 0 ? { x: ring.x + ring.width / 2, y: ring.y + ring.height / 2, r: (ring.width - stroke) / 2 } : null,
      preview:
        shape && box.width > 0
          ? { kind: shape.kind, mode: shape.mode, points: this.drawing?.kind === 'poly' ? this.drawing.points.length : 'points' in shape ? shape.points.length / 2 : 4, x: box.x, y: box.y, w: box.width, h: box.height }
          : null
    }
  }

  destroy(): void {
    for (const off of this.offs) off()
    this.modes.remove()
    this.preview.destroy()
    this.ring.destroy()
  }
}
