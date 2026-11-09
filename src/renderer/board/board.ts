import 'pixi.js/unsafe-eval' // keeps the CSP free of 'unsafe-eval'
import { Application, Container, Graphics, Sprite, type FederatedPointerEvent, type Texture } from 'pixi.js'
import { cellAt, cellOrigin } from '../../core/grid'
import { DEFAULT_FACTION_COLORS, type FactionColors, type Token, type View } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from '../ui/dom'
import { fit, pan, toWorld, zoomAt, type Camera } from './camera'
import { FogRenderer } from './fog-layer'
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
  onSelect?: (id: string) => void
}

export interface TokenSnapshot {
  id: string
  name: string
  label: string
  x: number
  y: number
  w: number
  h: number
  ring: string
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
  readonly fogLayer = new Container()
  readonly overlayLayer = new Container()
  camera: Camera = { scale: 1, x: 0, y: 0 }
  tool: Tool = 'select'

  private sprites = new Map<string, TokenSprite>()
  private spriteKeys = new Map<string, string>()
  private drag: { id: string; dx: number; dy: number; container: Container } | null = null
  private panning: { x: number; y: number } | null = null
  private space = false
  private fittedFor: string | null = null
  private gridLines = 0
  private fog!: FogRenderer
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
    b.world.addChild(b.mapLayer, b.gridLayer, b.fogLayer, b.tokenLayer, b.overlayLayer) // tokens a player may see are drawn above the fog
    b.fog = new FogRenderer(b.world, b.fogLayer)
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

  private canDrag(t: Token): boolean {
    const you = this.client.you
    return !!you && (you.role === 'master' || t.owner === you.name)
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
      if (!this.drag) return
      const w = this.toWorld(e.global.x, e.global.y)
      this.drag.container.position.set(w.x - this.drag.dx, w.y - this.drag.dy)
    })
    stage.on('pointerup', () => void this.endDrag())
    stage.on('pointerupoutside', () => void this.endDrag())
  }

  private startDrag(t: Token, sprite: TokenSprite, e: FederatedPointerEvent): void {
    if (e.button !== 0 || this.space || this.tool !== 'select') return
    if (this.client.you?.role === 'master') this.opts.onSelect?.(t.id)
    if (!this.canDrag(t)) return // PERM-07: players drag only their own tokens
    const w = this.toWorld(e.global.x, e.global.y)
    this.drag = { id: t.id, dx: w.x - sprite.root.x, dy: w.y - sprite.root.y, container: sprite.root }
    this.tokenLayer.addChild(sprite.root) // on top while dragging
  }

  /** TOK-05: the token's top-left corner snaps to the cell under it; a refused move goes back (PERM-03, TOK-10). */
  private async endDrag(): Promise<void> {
    const d = this.drag
    if (!d) return
    this.drag = null
    const view = this.client.view
    if (!view || !view.tokens[d.id]) return this.render(true)
    const t = view.tokens[d.id]
    const half = (t.width * view.grid.cell) / 2
    const cell = cellAt(view.grid, d.container.x, d.container.y)
    const o = cellOrigin(view.grid, cell.col, cell.row)
    d.container.position.set(o.x, o.y)
    const x = o.x + half
    const y = o.y + half
    if (t.x === x && t.y === y) return
    const r = await this.client.send({ type: 'token/move', id: d.id, x, y })
    if (!r.ok) this.render(true)
  }

  /** Space is held: a left drag pans the view, so no tool may act on it (MAP-08). */
  get spaceHeld(): boolean {
    return this.space
  }

  private toolListeners = new Set<(tool: Tool) => void>()

  setTool(tool: Tool): void {
    this.tool = tool
    this.app.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair'
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
    if (!view.map) return
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
    const colors = this.colors()
    const g = view.grid
    const keyOf = (t: Token): string =>
      JSON.stringify([t, g.cell, g.offsetX, g.offsetY, t.ring ? colors[t.ring] : '', !!this.textures.get(t.hash), view.role, this.canDrag(t)])
    for (const [id, s] of this.sprites) {
      const t = view.tokens[id]
      if (this.drag?.id === id) continue
      if (!force && t && this.spriteKeys.get(id) === keyOf(t)) continue
      s.root.destroy({ children: true })
      this.sprites.delete(id)
      this.spriteKeys.delete(id)
    }
    for (const t of Object.values(view.tokens)) {
      if (this.sprites.has(t.id)) continue
      const s = drawToken(t, g, t.ring ? colors[t.ring] : '#00000000', this.textures.get(t.hash), view.role === 'master' ? t.owner : null)
      s.root.eventMode = 'static'
      s.root.cursor = this.canDrag(t) ? 'grab' : 'default'
      s.root.on('pointerdown', (e: FederatedPointerEvent) => this.startDrag(t, s, e))
      this.tokenLayer.addChild(s.root)
      this.sprites.set(t.id, s)
      this.spriteKeys.set(t.id, keyOf(t))
    }
  }

  snapshot(): BoardSnapshot {
    const view = this.client.view
    const r = this.app.canvas.getBoundingClientRect()
    const tokens: TokenSnapshot[] = []
    if (view) {
      for (const [id, s] of this.sprites) {
        const t = view.tokens[id]
        if (!t) continue
        const side = t.width * view.grid.cell
        tokens.push({ id, name: t.name, label: s.label, x: s.root.x, y: s.root.y, w: side, h: side, ring: s.ring, alpha: s.root.alpha, owner: t.owner, hidden: t.hidden, textured: !!this.textures.get(t.hash) })
      }
    }
    return {
      camera: { ...this.camera },
      canvas: { left: r.left, top: r.top, width: r.width, height: r.height },
      map: view?.map ? { ...view.map, textured: !!this.textures.get(view.map.hash) } : null,
      grid: view?.map ? { ...view.grid, lines: this.gridLines } : null,
      fog: this.fog.snapshot(),
      tokens,
      dragging: this.drag?.id ?? null,
      empty: this.emptyEl.hidden ? null : (this.emptyEl.querySelector('p')?.textContent ?? null)
    }
  }

  /** Test hook: whether the drawn fog hides each map point (FOGS-01..05). */
  fogSample(points: Array<[number, number]>): boolean[] {
    return this.fog.sample(points)
  }

  destroy(): void {
    for (const off of this.offs) off()
    this.fog.destroy()
    this.app.destroy(true, { children: true })
    this.emptyEl.remove()
  }
}
