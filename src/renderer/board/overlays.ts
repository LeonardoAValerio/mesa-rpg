import { Container, Graphics, Text, type FederatedPointerEvent } from 'pixi.js'
import { cellAt, rulerDistance } from '../../core/grid'
import type { Ephemeral } from '../../core/protocol'
import type { TableClient } from '../net/table-client'
import type { Board } from './board'

export const PING_MS = 2000
export const STROKE_FADE_MS = 5000
const STALE_STROKE_MS = 15000
const SEND_EVERY_MS = 40

const USER_COLORS = [0xf97316, 0x22c55e, 0x06b6d4, 0xa855f7, 0xec4899, 0xfacc15, 0x60a5fa, 0xf87171]
export function userColor(name: string): number {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return USER_COLORS[h % USER_COLORS.length]
}

type Pt = { x: number; y: number }
interface Ruler {
  from: Pt
  to: Pt
  distance: number
  g: Container
}
interface Stroke {
  id: string
  from: string
  points: Pt[]
  done: boolean
  g: Graphics
  timer?: ReturnType<typeof setTimeout>
}

export interface OverlaySnapshot {
  rulers: Array<{ from: string; distance: number }>
  pings: Array<{ from: string; x: number; y: number }>
  strokes: Array<{ id: string; from: string; points: number; done: boolean }>
}

/** TOOL-01..04: ruler in cells, ping for 2 s and quick strokes that fade 5 s after release, in every window. */
export class Overlays {
  private rulers = new Map<string, Ruler>()
  private pings = new Set<{ from: string; x: number; y: number; g: Graphics }>()
  private strokes = new Map<string, Stroke>()
  private local: { kind: 'ruler'; from: Pt } | { kind: 'stroke'; stroke: Stroke } | null = null
  private lastSent = 0
  private seq = 0
  private off: () => void

  constructor(private readonly board: Board, private readonly client: TableClient) {
    const stage = board.app.stage
    stage.on('pointerdown', this.down)
    stage.on('pointermove', this.move)
    stage.on('pointerup', this.up)
    stage.on('pointerupoutside', this.up)
    this.off = client.on('ephemeral', ({ from, e }) => this.remote(from, e))
  }

  private get me(): string {
    return this.client.you?.name ?? ''
  }

  private world(e: FederatedPointerEvent): Pt {
    return this.board.toWorld(e.global.x, e.global.y)
  }

  private down = (e: FederatedPointerEvent): void => {
    if (e.button !== 0 || !this.client.view?.map) return
    const p = this.world(e)
    const tool = this.board.tool
    if (tool === 'ruler') {
      this.local = { kind: 'ruler', from: p }
      this.setRuler(this.me, p, p)
      this.client.sendEphemeral({ type: 'ruler', from: p, to: p })
    } else if (tool === 'ping') {
      this.ping(this.me, p.x, p.y)
      this.client.sendEphemeral({ type: 'ping', x: p.x, y: p.y })
    } else if (tool === 'draw') {
      const stroke = this.makeStroke(`${this.me}:${++this.seq}`, this.me)
      stroke.points.push(p)
      this.local = { kind: 'stroke', stroke }
      this.drawStroke(stroke)
    }
  }

  private move = (e: FederatedPointerEvent): void => {
    if (!this.local) return
    const p = this.world(e)
    const now = performance.now()
    const due = now - this.lastSent >= SEND_EVERY_MS
    if (this.local.kind === 'ruler') {
      this.setRuler(this.me, this.local.from, p)
      if (due) this.client.sendEphemeral({ type: 'ruler', from: this.local.from, to: p })
    } else {
      const s = this.local.stroke
      if (s.points.length >= 2000) return
      s.points.push(p)
      this.drawStroke(s)
      if (due) this.client.sendEphemeral({ type: 'stroke', strokeId: s.id, points: s.points, done: false })
    }
    if (due) this.lastSent = now
  }

  private up = (e: FederatedPointerEvent): void => {
    const l = this.local
    if (!l) return
    this.local = null
    if (l.kind === 'ruler') {
      this.clearRuler(this.me)
      this.client.sendEphemeral({ type: 'ruler', from: l.from, to: this.world(e) })
      this.client.sendEphemeral({ type: 'ruler/end' })
    } else {
      l.stroke.done = true
      this.client.sendEphemeral({ type: 'stroke', strokeId: l.stroke.id, points: l.stroke.points, done: true })
      this.expire(l.stroke, STROKE_FADE_MS)
    }
  }

  private remote(from: string, e: Ephemeral): void {
    if (e.type === 'ruler') this.setRuler(from, e.from, e.to)
    else if (e.type === 'ruler/end') this.clearRuler(from)
    else if (e.type === 'ping') this.ping(from, e.x, e.y)
    else if (e.type === 'stroke') {
      const s = this.strokes.get(e.strokeId) ?? this.makeStroke(e.strokeId, from)
      s.points = e.points
      s.done = e.done
      this.drawStroke(s)
      this.expire(s, e.done ? STROKE_FADE_MS : STALE_STROKE_MS)
    }
  }

  private setRuler(who: string, from: Pt, to: Pt): void {
    const grid = this.client.view?.grid
    if (!grid) return
    const distance = rulerDistance(cellAt(grid, from.x, from.y), cellAt(grid, to.x, to.y))
    let r = this.rulers.get(who)
    if (!r) {
      r = { from, to, distance, g: new Container() }
      this.board.overlayLayer.addChild(r.g)
      this.rulers.set(who, r)
    }
    r.from = from
    r.to = to
    r.distance = distance
    r.g.removeChildren().forEach((c) => c.destroy())
    const color = userColor(who)
    const width = 3 / this.board.camera.scale
    r.g.addChild(new Graphics().moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width, color }))
    const label = new Text({ text: String(distance), style: { fontSize: 16 / this.board.camera.scale, fill: 0xffffff, stroke: { color, width: 4 / this.board.camera.scale } } })
    label.position.set(to.x + 8 / this.board.camera.scale, to.y - 8 / this.board.camera.scale)
    r.g.addChild(label)
  }

  private clearRuler(who: string): void {
    const r = this.rulers.get(who)
    if (!r) return
    r.g.destroy({ children: true })
    this.rulers.delete(who)
  }

  private ping(from: string, x: number, y: number): void {
    const scale = this.board.camera.scale
    const g = new Graphics()
      .circle(x, y, 18 / scale)
      .stroke({ width: 4 / scale, color: userColor(from) })
      .circle(x, y, 6 / scale)
      .fill(userColor(from))
    this.board.overlayLayer.addChild(g)
    const p = { from, x, y, g }
    this.pings.add(p)
    setTimeout(() => {
      this.pings.delete(p)
      g.destroy()
    }, PING_MS)
  }

  private makeStroke(id: string, from: string): Stroke {
    const s: Stroke = { id, from, points: [], done: false, g: new Graphics() }
    this.board.overlayLayer.addChild(s.g)
    this.strokes.set(id, s)
    return s
  }

  private drawStroke(s: Stroke): void {
    s.g.clear()
    if (!s.points.length) return
    s.g.moveTo(s.points[0].x, s.points[0].y)
    for (const p of s.points.slice(1)) s.g.lineTo(p.x, p.y)
    s.g.stroke({ width: 4 / this.board.camera.scale, color: userColor(s.from), cap: 'round', join: 'round' })
  }

  private expire(s: Stroke, ms: number): void {
    if (s.timer) clearTimeout(s.timer)
    s.timer = setTimeout(() => {
      s.g.destroy()
      this.strokes.delete(s.id)
    }, ms)
  }

  snapshot(): OverlaySnapshot {
    return {
      rulers: [...this.rulers].map(([from, r]) => ({ from, distance: r.distance })),
      pings: [...this.pings].map(({ from, x, y }) => ({ from, x, y })),
      strokes: [...this.strokes.values()].map((s) => ({ id: s.id, from: s.from, points: s.points.length, done: s.done }))
    }
  }

  destroy(): void {
    this.off()
    for (const s of this.strokes.values()) if (s.timer) clearTimeout(s.timer)
  }
}
