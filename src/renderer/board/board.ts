import { NO_PERMISSION } from '../../core/reducer'
import 'pixi.js/unsafe-eval' // keeps the CSP free of 'unsafe-eval'
import { Application, Container, Graphics, Sprite, type FederatedPointerEvent, type Texture } from 'pixi.js'
import { canMove, dropPosition, rotatedExtent } from '../../core/items'
import { DEFAULT_FACTION_COLORS, type FactionColors, type Token, type View } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from '../ui/dom'
import { fit, pan, toWorld, zoomAt, type Camera } from './camera'
import { FogRenderer } from './fog-layer'
import { Selection, type SelectionSnapshot } from './selection'
import { drawToken, type TokenSprite } from './token-sprite'

export interface TextureProvider {
  get(hash: string): Texture | null
  onLoad(fn: () => void): () => void
}

export const noTextures: TextureProvider = { get: () => null, onLoad: () => () => {} }

export interface BoardOptions {
  textures?: TextureProvider
  colors?: () => FactionColors
  onImportMap?: () => void
  onSelect?: (id: string | null) => void
}

export interface TokenSnapshot {
  id: string
  name: string
  kind: 'character' | 'object'
  /** The name drawn under it; empty for an object. */
  label: string
  /** The centre where the sprite is drawn, in map pixels. */
  x: number
  y: number
  /** The drawn image size, in map pixels. */
  w: number
  h: number
  /** The drawn rotation, in degrees. */
  rotation: number
  ring: string | null
  /** Drawing order over all items: higher is drawn on top. */
  z: number
  alpha: number
  owner: string | null
  hidden: boolean
  textured: boolean
}

export interface BoardSnapshot {
  camera: Camera
  canvas: { left: number; top: number; width: number; height: number }
  map: { hash: string; width: number; height: number; textured: boolean } | null
  grid: { cell: number; offsetX: number; offsetY: number; color: string; opacity: number; lines: number } | null
  fog: { shapes: number; base: 'revealed' | 'covered'; alpha: number }
  selection: SelectionSnapshot
  tokens: TokenSnapshot[]
  dragging: string | null
  empty: string | null
}

const WHEEL_STEP = 1.1

export type Tool = 'select' | 'ruler' | 'ping' | 'draw' | 'fog-brush' | 'fog-rect' | 'fog-poly'

/** The PixiJS table: map, grid and tokens, a camera per window, and token drag with grid snap. */
export class Board {
  readonly app = new Application()
  readonly world = new Container()
  readonly mapLayer = new Container()
  readonly gridLayer = new Graphics()
  readonly tokenLayer = new Container()
  /** ITEM-07: objects are drawn below characters. */
  readonly objectLayer = new Container()
  readonly characterLayer = new Container()
  readonly fogLayer = new Container()
  readonly overlayLayer = new Container()
  camera: Camera = { scale: 1, x: 0, y: 0 }
  tool: Tool = 'select'

  private sprites = new Map<string, TokenSprite>()
  private spriteKeys = new Map<string, string>()
  private drag: {
    id: string
    dx: number
    dy: number
    container: Container
    from: { x: number; y: number }
    moved: boolean
    /** BRD-10: the other selected items, moved by the same offset; their starting centres. */
    followers: Array<{ id: string; container: Container; x: number; y: number }>
    start: { x: number; y: number }
  } | null = null
  /** BRD-08: the selection box being dragged, in map pixels. */
  private box: { x0: number; y0: number; x1: number; y1: number; from: { x: number; y: number }; moved: boolean } | null = null
  private readonly boxGraphic = new Graphics()
  /** BRD-18: a refused move of several items tells why. */
  readonly moveRefused = new Set<(reason: string) => void>()
  /** A press on a group's item the person may not move: dragging it only tells why. */
  private blocked: { x: number; y: number } | null = null
  private panning: { x: number; y: number } | null = null
  private space = false
  private fittedFor: string | null = null
  private gridLines = 0
  private fog!: FogRenderer
  selection!: Selection
  private emptyEl: HTMLElement
  private offs: Array<() => void> = []
  private textures: TextureProvider
  private colors: () => FactionColors

  private constructor(private readonly host: HTMLElement, private readonly client: TableClient, private readonly opts: BoardOptions) {
    this.textures = opts.textures ?? noTextures
    this.colors = opts.colors ?? (() => this.client.view?.palette ?? DEFAULT_FACTION_COLORS)
    this.emptyEl = h('div', { class: 'empty', testid: 'board-empty' })
  }

  static async create(host: HTMLElement, client: TableClient, opts: BoardOptions = {}): Promise<Board> {
    const b = new Board(host, client, opts)
    await b.app.init({ resizeTo: host, background: '#0d0e11', antialias: true, preference: 'webgl' })
    b.app.canvas.dataset.testid = 'board-canvas'
    host.append(b.app.canvas, b.emptyEl)
    b.tokenLayer.addChild(b.objectLayer, b.characterLayer)
    b.world.addChild(b.mapLayer, b.gridLayer, b.fogLayer, b.tokenLayer, b.overlayLayer) // tokens a player may see are drawn above the fog
    b.fog = new FogRenderer(b.world, b.fogLayer)
    b.selection = new Selection(b, client)
    b.overlayLayer.addChild(b.boxGraphic)
    b.app.stage.addChild(b.world)
    b.bindInput()
    // the board area changes size with the layout, not only with the window
    const ro = new ResizeObserver(() => b.app.resize())
    ro.observe(host)
    b.offs.push(() => ro.disconnect())
    b.offs.push(client.on('view', () => b.render()))
    b.offs.push(b.textures.onLoad(() => b.render())) // a texture arriving never cancels a drag
    b.render()
    return b
  }

  /** World (map pixel) → canvas pixel. */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: x * this.camera.scale + this.camera.x, y: y * this.camera.scale + this.camera.y }
  }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    return toWorld(this.camera, sx, sy)
  }

  private applyCamera(): void {
    this.world.scale.set(this.camera.scale)
    this.world.position.set(this.camera.x, this.camera.y)
  }

  /** ITEM-14..16: anyone moves a Livre item, only the master a "Só mestre" one, nobody a Travado one. */
  canDrag(t: Token): boolean {
    const you = this.client.you
    return !!you && canMove(t, you).ok
  }

  /** The image's height / width, or 1 while it loads. */
  aspect(hash: string): number {
    const tex = this.textures.get(hash)
    return tex && tex.width > 0 ? tex.height / tex.width : 1
  }

  /** ITEM-08, ITEM-09, ITEM-10: where an item dropped at (x, y) lands; Shift inverts the snap; a turned item snaps by its drawn box. */
  dropAt(kind: Token['kind'], hash: string, width: number, x: number, y: number, shift: boolean, rotation = 0): { x: number; y: number } {
    const grid = this.client.view?.grid
    if (!grid) return { x, y }
    const box = rotatedExtent(width, width * this.aspect(hash), rotation)
    return dropPosition(kind, shift, grid, x, y, box.w, box.h)
  }

  /** Clears the selection: an empty click, Esc or another tool (ITEM-13, BRD-13). */
  deselect(): void {
    if (!this.selection.ids.length) return
    this.selection.select(null)
    this.opts.onSelect?.(null)
  }

  /** BRD-17: what a click on an item selects: the item, or its whole group. */
  clickSelection(id: string): string[] {
    const tokens = this.client.view?.tokens ?? {}
    const g = tokens[id]?.group
    return g ? Object.values(tokens).filter((t) => t.group === g).map((t) => t.id) : [id]
  }

  /** Makes these items the selection; the master's editor follows only one item (BRD-14). */
  selectIds(ids: string[]): void {
    this.selection.set(ids)
    if (this.client.you?.role === 'master') this.opts.onSelect?.(this.selection.selected)
  }

  private bindInput(): void {
    const canvas = this.app.canvas
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      this.camera = zoomAt(this.camera, e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP)
      this.applyCamera()
    }, { passive: false })
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 1 || (e.button === 0 && this.space)) {
        e.preventDefault()
        this.panning = { x: e.clientX, y: e.clientY }
        canvas.setPointerCapture(e.pointerId)
      }
    })
    canvas.addEventListener('pointermove', (e) => {
      if (!this.panning) return
      this.camera = pan(this.camera, e.clientX - this.panning.x, e.clientY - this.panning.y)
      this.panning = { x: e.clientX, y: e.clientY }
      this.applyCamera()
    })
    const endPan = (): void => {
      this.panning = null
    }
    canvas.addEventListener('pointerup', endPan)
    canvas.addEventListener('pointercancel', endPan)
    canvas.addEventListener('auxclick', (e) => e.preventDefault())
    const key = (down: boolean) => (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) this.space = down
    }
    const kd = key(true)
    const ku = key(false)
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    this.offs.push(() => window.removeEventListener('keydown', kd), () => window.removeEventListener('keyup', ku))

    const stage = this.app.stage
    stage.eventMode = 'static'
    stage.hitArea = this.app.screen
    stage.on('pointermove', (e: FederatedPointerEvent) => {
      if (this.box) return this.moveBox(e)
      if (this.blocked) {
        if (Math.hypot(e.global.x - this.blocked.x, e.global.y - this.blocked.y) < 4) return
        this.blocked = null
        for (const fn of this.moveRefused) fn(NO_PERMISSION)
        return
      }
      if (!this.drag) return
      if (!this.drag.moved && Math.hypot(e.global.x - this.drag.from.x, e.global.y - this.drag.from.y) < 4) return // a click selects, it does not move
      this.drag.moved = true
      const w = this.toWorld(e.global.x, e.global.y)
      const d = this.drag
      d.container.position.set(w.x - d.dx, w.y - d.dy)
      for (const f of d.followers) f.container.position.set(f.x + d.container.x - d.start.x, f.y + d.container.y - d.start.y)
    })
    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      // a press on the empty map starts a selection box; a click there (no drag) clears the selection (BRD-08, BRD-13)
      if (e.target === stage && e.button === 0 && !this.space && this.tool === 'select' && !this.selection.onHandle(this.toWorld(e.global.x, e.global.y))) {
        const w = this.toWorld(e.global.x, e.global.y)
        this.box = { x0: w.x, y0: w.y, x1: w.x, y1: w.y, from: { x: e.global.x, y: e.global.y }, moved: false }
      }
    })
    stage.on('pointerup', (e: FederatedPointerEvent) => {
      this.blocked = null
      if (this.box) return this.endBox()
      void this.endDrag(e.shiftKey)
    })
    stage.on('pointerupoutside', (e: FederatedPointerEvent) => {
      this.blocked = null
      if (this.box) return this.endBox()
      void this.endDrag(e.shiftKey)
    })
  }

  private moveBox(e: FederatedPointerEvent): void {
    const b = this.box!
    if (!b.moved && Math.hypot(e.global.x - b.from.x, e.global.y - b.from.y) < 4) return
    b.moved = true
    const w = this.toWorld(e.global.x, e.global.y)
    b.x1 = w.x
    b.y1 = w.y
    const line = 1.5 / this.camera.scale
    this.boxGraphic.clear()
    this.boxGraphic
      .rect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0))
      .fill({ color: 0x3b82f6, alpha: 0.12 })
      .stroke({ width: line, color: 0x93c5fd, alpha: 0.9 })
  }

  /** BRD-08: the items whose centre is inside the box, that this window sees and the person may move. */
  private endBox(): void {
    const b = this.box!
    this.box = null
    this.boxGraphic.clear()
    if (!b.moved) return this.deselect() // a click on the empty map
    const [x0, x1] = [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1)]
    const [y0, y1] = [Math.min(b.y0, b.y1), Math.max(b.y0, b.y1)]
    const tokens = Object.values(this.client.view?.tokens ?? {})
    this.selectIds(tokens.filter((t) => t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1 && this.canDrag(t)).map((t) => t.id))
  }

  private startDrag(t: Token, sprite: TokenSprite, e: FederatedPointerEvent): void {
    if (e.button !== 0 || this.space || this.tool !== 'select') return
    if (this.selection.onHandle(this.toWorld(e.global.x, e.global.y))) return this.selection.beginResize() // ITEM-04
    if (e.shiftKey) {
      // BRD-09: Shift+click adds an item the person may move, or takes it out
      if (this.canDrag(t)) this.selectIds(this.selection.has(t.id) ? this.selection.ids.filter((x) => x !== t.id) : [...this.selection.ids, t.id])
      return
    }
    // a press on one of several selected items keeps them all; otherwise it becomes the selection
    if (!(this.selection.has(t.id) && this.selection.ids.length > 1)) this.selectIds(this.clickSelection(t.id))
    if (!this.canDrag(t)) {
      // BRD-18: a group with an item this person may not move does not move, and says why when dragged
      if (t.group && this.selection.ids.length > 1) this.blocked = { x: e.global.x, y: e.global.y }
      return // ITEM-14..16
    }
    const w = this.toWorld(e.global.x, e.global.y)
    const view = this.client.view
    // every other selected item follows; one the person may not move makes the server refuse the whole move (BRD-18)
    const followers = this.selection.ids
      .filter((id) => id !== t.id && view?.tokens[id] && this.sprites.has(id))
      .map((id) => ({ id, container: this.sprites.get(id)!.root, x: this.sprites.get(id)!.root.x, y: this.sprites.get(id)!.root.y }))
    this.drag = { id: t.id, dx: w.x - sprite.root.x, dy: w.y - sprite.root.y, container: sprite.root, from: { x: e.global.x, y: e.global.y }, moved: false, followers, start: { x: sprite.root.x, y: sprite.root.y } }
    sprite.root.parent?.addChild(sprite.root) // on top of its layer while dragging
  }

  /** ITEM-08, ITEM-09, ITEM-17: the drop rule decides where it lands; a refusal puts it back. */
  private async endDrag(shift: boolean): Promise<void> {
    const d = this.drag
    if (!d) return
    this.drag = null
    const view = this.client.view
    if (!view || !view.tokens[d.id]) return this.render(true)
    const t = view.tokens[d.id]
    if (!d.moved) {
      if (d.followers.length) this.selectIds(this.clickSelection(d.id)) // a click on one of several: just it (its group)
      return // a click: nothing moves, not even a snap
    }
    const p = this.dropAt(t.kind, t.hash, t.width, d.container.x, d.container.y, shift, t.rotation)
    d.container.position.set(p.x, p.y)
    if (t.x === p.x && t.y === p.y) {
      if (d.followers.length) this.render(true) // the others go back too
      return
    }
    if (!d.followers.length) {
      const r = await this.client.send({ type: 'token/move', id: d.id, x: p.x, y: p.y })
      if (!r.ok) this.render(true)
      return
    }
    // BRD-10: the others move by the dragged item's offset, all in one action (all or nothing)
    const dx = p.x - t.x
    const dy = p.y - t.y
    const moves = [{ id: d.id, x: p.x, y: p.y }]
    for (const f of d.followers) {
      const ft = view.tokens[f.id]
      if (ft) moves.push({ id: f.id, x: ft.x + dx, y: ft.y + dy })
      f.container.position.set(f.x + dx, f.y + dy)
    }
    const r = await this.client.send({ type: 'token/moveMany', moves })
    if (!r.ok) {
      this.render(true)
      for (const fn of this.moveRefused) fn(r.reason)
    }
  }

  /** Space is held: a left drag pans the view, so no tool may act on it (MAP-08). */
  get spaceHeld(): boolean {
    return this.space
  }

  private toolListeners = new Set<(tool: Tool) => void>()

  setTool(tool: Tool): void {
    this.tool = tool
    this.app.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair'
    if (tool !== 'select') this.deselect()
    for (const fn of this.toolListeners) fn(tool)
  }

  onToolChange(fn: (tool: Tool) => void): () => void {
    this.toolListeners.add(fn)
    return () => this.toolListeners.delete(fn)
  }

  render(force = false): void {
    const view = this.client.view
    if (!view) return
    this.renderEmpty(view)
    this.renderMap(view)
    this.renderGrid(view)
    this.fog.update(view)
    this.renderTokens(view, force)
    this.applyCamera()
    this.selection.draw()
    this.app.render() // lay out new sprites now: hit tests use the transforms of the last render
  }

  private renderEmpty(view: View): void {
    if (view.map) {
      this.emptyEl.hidden = true
      return
    }
    this.emptyEl.hidden = false
    const master = view.role === 'master'
    const msg = h('p', { testid: 'empty-message' }, master ? 'Nenhum mapa carregado' : 'Aguardando o mestre carregar um mapa')
    if (master) this.emptyEl.replaceChildren(msg, h('button', { testid: 'import-map', onclick: () => this.opts.onImportMap?.() }, 'Importar mapa'))
    else this.emptyEl.replaceChildren(msg)
  }

  private renderMap(view: View): void {
    this.mapLayer.removeChildren()
    if (!view.map) return
    const tex = this.textures.get(view.map.hash)
    if (tex) {
      const s = new Sprite(tex)
      s.width = view.map.width
      s.height = view.map.height
      this.mapLayer.addChild(s)
    } else {
      this.mapLayer.addChild(new Graphics().rect(0, 0, view.map.width, view.map.height).fill(0x2a2e35))
    }
    if (this.fittedFor !== view.map.hash) {
      this.fittedFor = view.map.hash
      this.camera = fit(this.app.screen.width, this.app.screen.height, view.map.width, view.map.height)
    }
  }

  private renderGrid(view: View): void {
    const g = this.gridLayer
    g.clear()
    this.gridLines = 0
    if (!view.map || view.grid.visible === false) return // BRD-03: a hidden grid draws no line
    const { cell, offsetX, offsetY, color, opacity } = view.grid
    const { width, height } = view.map
    for (let x = offsetX - Math.floor(offsetX / cell) * cell; x <= width; x += cell, this.gridLines++) g.moveTo(x, 0).lineTo(x, height)
    for (let y = offsetY - Math.floor(offsetY / cell) * cell; y <= height; y += cell, this.gridLines++) g.moveTo(0, y).lineTo(width, y)
    g.stroke({ width: 1, color, alpha: opacity, pixelLine: true })
  }

  /** Rebuilds only the tokens whose look changed, so a click never lands on a sprite that has not been laid out yet. */
  private renderTokens(view: View, force: boolean): void {
    if (this.drag && !view.tokens[this.drag.id]) this.drag = null // TOK-11: the token is gone, so is the drag
    if (force) this.drag = null
    const dragged = new Set(this.drag ? [this.drag.id, ...this.drag.followers.map((f) => f.id)] : [])
    const colors = this.colors()
    const g = view.grid
    const keyOf = (t: Token): string =>
      JSON.stringify([t, g.cell, g.offsetX, g.offsetY, t.ring ? colors[t.ring] : '', this.textureSize(t.hash), view.role, this.canDrag(t)])
    for (const [id, s] of this.sprites) {
      const t = view.tokens[id]
      if (dragged.has(id) && t) continue
      if (!force && t && this.spriteKeys.get(id) === keyOf(t)) continue
      s.root.destroy({ children: true })
      this.sprites.delete(id)
      this.spriteKeys.delete(id)
    }
    for (const t of Object.values(view.tokens)) {
      if (this.sprites.has(t.id)) continue
      const s = drawToken(t, g, t.ring ? colors[t.ring] : null, this.textures.get(t.hash), view.role === 'master' ? t.owner : null)
      s.root.eventMode = 'static'
      s.root.cursor = this.canDrag(t) ? 'grab' : 'default'
      s.root.on('pointerdown', (e: FederatedPointerEvent) => this.startDrag(t, s, e))
      ;(t.kind === 'object' ? this.objectLayer : this.characterLayer).addChild(s.root)
      this.sprites.set(t.id, s)
      this.spriteKeys.set(t.id, keyOf(t))
    }
  }

  snapshot(): BoardSnapshot {
    const view = this.client.view
    const r = this.app.canvas.getBoundingClientRect()
    const tokens: TokenSnapshot[] = []
    if (view) {
      // the real drawing order: every item container under the token layer, in the order the renderer walks them
      const order: unknown[] = []
      const walk = (c: Container): void => {
        for (const child of c.children) {
          if ([...this.sprites.values()].some((s) => s.root === child)) order.push(child)
          else walk(child as Container)
        }
      }
      walk(this.tokenLayer)
      for (const [id, s] of this.sprites) {
        const t = view.tokens[id]
        if (!t) continue
        tokens.push({
          id,
          name: t.name,
          kind: t.kind,
          label: s.label,
          ...this.drawnCentre(s),
          w: s.body.children[0].width, // measured from the drawn image or placeholder
          h: s.body.children[0].height,
          rotation: Math.round((s.body.rotation * 180) / Math.PI),
          ring: s.ring,
          z: order.indexOf(s.root),
          alpha: s.root.alpha,
          owner: t.owner,
          hidden: t.hidden,
          textured: !!this.textures.get(t.hash)
        })
      }
    }
    return {
      camera: { ...this.camera },
      canvas: { left: r.left, top: r.top, width: r.width, height: r.height },
      map: view?.map ? { ...view.map, textured: !!this.textures.get(view.map.hash) } : null,
      grid: view?.map ? { ...view.grid, lines: this.gridLines } : null,
      fog: this.fog.snapshot(),
      selection: this.selection.snapshot(),
      tokens,
      dragging: this.drag?.id ?? null,
      empty: this.emptyEl.hidden ? null : (this.emptyEl.querySelector('p')?.textContent ?? null)
    }
  }

  /** The centre of the drawn image, from its bounds on screen, back in map pixels (ITEM-01). */
  private drawnCentre(s: TokenSprite): { x: number; y: number } {
    const b = s.body.children[0].getBounds()
    const p = this.world.toLocal({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
    const r = (v: number): number => Math.round(v * 1000) / 1000
    return { x: r(p.x), y: r(p.y) }
  }

  private textureSize(hash: string): string {
    const tex = this.textures.get(hash)
    return tex ? `${tex.width}x${tex.height}` : ''
  }

  /** Test hook: whether the drawn fog hides each map point (FOGS-01..05). */
  fogSample(points: Array<[number, number]>): boolean[] {
    return this.fog.sample(points)
  }

  destroy(): void {
    for (const off of this.offs) off()
    this.fog.destroy()
    this.selection.destroy()
    this.app.destroy(true, { children: true })
    this.emptyEl.remove()
  }
}
