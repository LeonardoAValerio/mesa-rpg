import { Container, Graphics, RenderTexture, Sprite, type Application, type FederatedPointerEvent } from 'pixi.js'
import { clampBrushCells, type FogMode } from '../../core/fog'
import type { Fog, FogShape, MapRef, View } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from '../ui/dom'
import type { Board } from './board'

export const MASTER_FOG_ALPHA = 0.5
export const PLAYER_FOG_ALPHA = 1
/** The fog texture's longest side; a bigger map is drawn scaled down. */
const MAX_TEXTURE = 2048

/** Draws one shape in texture pixels (`k` = texture px per map px). */
export function drawShape(g: Graphics, s: FogShape, k: number): Graphics {
  if (s.kind === 'rect') return g.rect(s.x * k, s.y * k, s.w * k, s.h * k).fill(0x000000)
  if (s.kind === 'poly') return g.poly(s.points.map((v) => v * k), true).fill(0x000000)
  const p = s.points
  if (p.length === 2) return g.circle(p[0] * k, p[1] * k, s.radius * k).fill(0x000000)
  g.moveTo(p[0] * k, p[1] * k)
  for (let i = 2; i + 1 < p.length; i += 2) g.lineTo(p[i] * k, p[i + 1] * k)
  return g.stroke({ width: 2 * s.radius * k, color: 0x000000, cap: 'round', join: 'round' })
}

/**
 * FOG-02, FOGS-01..05: the fog as a texture the size of the map. A covered base fills it black, each
 * Cobrir shape paints black and each Revelar shape erases, in order; players see it opaque, the master at 50%.
 */
export class FogRenderer {
  readonly sprite = new Sprite()
  private texture: RenderTexture | null = null
  private key = ''
  private k = 1
  private info = { shapes: 0, base: 'revealed' as Fog['base'], alpha: 1 }

  constructor(private readonly app: Application, layer: Container) {
    layer.addChild(this.sprite)
  }

  update(view: View): void {
    const alpha = view.role === 'master' ? MASTER_FOG_ALPHA : PLAYER_FOG_ALPHA
    this.sprite.alpha = alpha
    const map = view.map
    const fog = view.fog
    this.info = { shapes: fog?.shapes.length ?? 0, base: fog?.base ?? 'revealed', alpha }
    this.sprite.visible = !!map && !!fog
    if (!map || !fog) return
    const key = JSON.stringify([map.width, map.height, fog])
    if (key === this.key) return
    this.key = key
    this.draw(map, fog)
  }

  private draw(map: MapRef, fog: Fog): void {
    this.k = Math.min(1, MAX_TEXTURE / Math.max(map.width, map.height))
    const w = Math.max(1, Math.round(map.width * this.k))
    const hgt = Math.max(1, Math.round(map.height * this.k))
    if (!this.texture || this.texture.width !== w || this.texture.height !== hgt) {
      this.texture?.destroy(true)
      this.texture = RenderTexture.create({ width: w, height: hgt })
    }
    const scene = new Container()
    if (fog.base === 'covered') scene.addChild(new Graphics().rect(0, 0, w, hgt).fill(0x000000))
    for (const s of fog.shapes) {
      const g = drawShape(new Graphics(), s, this.k)
      if (s.mode === 'reveal') g.blendMode = 'erase'
      scene.addChild(g)
    }
    this.app.renderer.render({ container: scene, target: this.texture, clear: true })
    scene.destroy({ children: true })
    this.sprite.texture = this.texture
    this.sprite.width = map.width
    this.sprite.height = map.height
  }

  snapshot(): { shapes: number; base: Fog['base']; alpha: number } {
    return { ...this.info }
  }

  /** Test hook: whether the drawn fog is opaque at each map point (alpha of the texture over 0.5). */
  sample(points: Array<[number, number]>): boolean[] {
    if (!this.texture || !this.sprite.visible) return points.map(() => false)
    const { pixels, width, height } = this.app.renderer.extract.pixels(this.texture)
    return points.map(([x, y]) => {
      const px = Math.min(width - 1, Math.max(0, Math.floor(x * this.k)))
      const py = Math.min(height - 1, Math.max(0, Math.floor(y * this.k)))
      return pixels[(py * width + px) * 4 + 3] > 127
    })
  }

  destroy(): void {
    this.texture?.destroy(true)
  }
}

/** Master-only fog tools: brush and rectangle in Reveal/Cover mode, "Cobrir tudo" and "Revelar tudo" (FOGS-05). */
export function fogTools(board: Board, client: TableClient): { root: HTMLElement; destroy(): void } {
  let mode: FogMode = 'cover'
  let radius = 1
  let start: { x: number; y: number } | null = null
  const preview = new Graphics()
  board.overlayLayer.addChild(preview)

  const world = (e: FederatedPointerEvent): { x: number; y: number } => board.toWorld(e.global.x, e.global.y)
  const brushAt = (x: number, y: number): void => {
    const g = client.view?.grid
    if (!g) return
    void client.send({ type: 'fog/shape', shape: { kind: 'stroke', mode, radius: radius * g.cell, points: [x, y] } })
  }
  const down = (e: FederatedPointerEvent): void => {
    if (e.button !== 0 || board.spaceHeld) return
    const p = world(e)
    if (board.tool === 'fog-brush') {
      start = p
      brushAt(p.x, p.y)
    } else if (board.tool === 'fog-rect') start = p
  }
  const move = (e: FederatedPointerEvent): void => {
    if (!start) return
    const p = world(e)
    if (board.tool === 'fog-brush') brushAt(p.x, p.y)
    else if (board.tool === 'fog-rect') {
      preview.clear().rect(Math.min(start.x, p.x), Math.min(start.y, p.y), Math.abs(p.x - start.x), Math.abs(p.y - start.y))
      preview.stroke({ width: 2 / board.camera.scale, color: mode === 'reveal' ? 0xfacc15 : 0x64748b })
    }
  }
  const up = (e: FederatedPointerEvent): void => {
    if (!start) return
    const p = world(e)
    if (board.tool === 'fog-rect') {
      const shape: FogShape = { kind: 'rect', mode, x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
      void client.send({ type: 'fog/shape', shape })
    }
    start = null
    preview.clear()
  }
  const stage = board.app.stage
  stage.on('pointerdown', down)
  stage.on('pointermove', move)
  stage.on('pointerup', up)
  stage.on('pointerupoutside', up)

  const modeBtn = (m: FogMode, label: string): HTMLButtonElement =>
    h('button', { testid: `fog-mode-${m}`, class: 'secondary', 'aria-pressed': m === mode ? 'true' : 'false', onclick: () => setMode(m) }, label)
  const reveal = modeBtn('reveal', 'Revelar')
  const cover = modeBtn('cover', 'Cobrir')
  const setMode = (m: FogMode): void => {
    mode = m
    reveal.setAttribute('aria-pressed', String(m === 'reveal'))
    cover.setAttribute('aria-pressed', String(m === 'cover'))
  }
  const radiusInput = h('input', { type: 'number', testid: 'fog-radius', min: 0.5, max: 10, step: 0.5, value: String(radius) })
  radiusInput.addEventListener('change', () => {
    radius = clampBrushCells(Number(radiusInput.value))
    radiusInput.value = String(radius)
  })
  const root = h('section', { class: 'panel', testid: 'fog-panel' },
    h('h3', {}, 'Névoa'),
    h('div', { class: 'row' }, cover, reveal),
    h('label', {}, 'Raio do pincel (células)', radiusInput),
    h('div', { class: 'row' },
      h('button', { testid: 'fog-cover-all', class: 'secondary', onclick: () => void client.send({ type: 'fog/coverAll' }) }, 'Cobrir tudo'),
      h('button', { testid: 'fog-reveal-all', class: 'secondary', onclick: () => void client.send({ type: 'fog/revealAll' }) }, 'Revelar tudo')
    )
  )
  return {
    root,
    destroy: () => {
      stage.off('pointerdown', down)
      stage.off('pointermove', move)
      stage.off('pointerup', up)
      stage.off('pointerupoutside', up)
    }
  }
}
