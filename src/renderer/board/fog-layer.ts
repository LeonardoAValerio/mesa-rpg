import { Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { Fog, FogShape, MapRef, View } from '../../core/types'

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

/** Traces one shape on a 2D canvas in texture pixels; polygons fill even-odd, as `fogAt` decides (FOGS-03, FOGS-04). */
export function paintShape(ctx: CanvasRenderingContext2D, s: FogShape, k: number): void {
  ctx.globalCompositeOperation = s.mode === 'reveal' ? 'destination-out' : 'source-over'
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  if (s.kind === 'rect') {
    ctx.fillRect(s.x * k, s.y * k, s.w * k, s.h * k)
    return
  }
  const p = s.points
  ctx.beginPath()
  if (s.kind === 'poly') {
    ctx.moveTo(p[0] * k, p[1] * k)
    for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i] * k, p[i + 1] * k)
    ctx.closePath()
    ctx.fill('evenodd')
    return
  }
  if (p.length === 2) {
    ctx.arc(p[0] * k, p[1] * k, s.radius * k, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 2 * s.radius * k
  ctx.moveTo(p[0] * k, p[1] * k)
  for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i] * k, p[i + 1] * k)
  ctx.stroke()
}

/**
 * FOG-02, FOGS-01..05: the fog painted on a canvas the size of the map (at most 2048 px on its long side) and shown
 * as a sprite stretched over the map. A covered base fills it black, Cobrir shapes paint black and Revelar shapes
 * erase, in order. When the new fog only adds shapes to the last one, only those are painted; players see it opaque,
 * the master at 50%.
 */
export class FogRenderer {
  readonly sprite = new Sprite()
  private readonly canvas = document.createElement('canvas')
  private readonly ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
  private texture: Texture | null = null
  private drawn: { map: string; base: Fog['base']; shapes: FogShape[] } | null = null
  private k = 1
  private info = { shapes: 0, base: 'revealed' as Fog['base'], alpha: 1 }

  constructor(private readonly world: Container, layer: Container) {
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
    this.paint(map, fog)
  }

  private paint(map: MapRef, fog: Fog): void {
    const mapKey = `${map.hash}:${map.width}x${map.height}`
    const d = this.drawn
    const same = (a: FogShape, b: FogShape): boolean => a === b || JSON.stringify(a) === JSON.stringify(b)
    const appended = !!d && d.map === mapKey && d.base === fog.base && d.shapes.length <= fog.shapes.length && d.shapes.every((s, i) => same(s, fog.shapes[i]))
    if (appended && d!.shapes.length === fog.shapes.length) return
    if (!appended) {
      this.k = Math.min(1, MAX_TEXTURE / Math.max(map.width, map.height))
      const w = Math.max(1, Math.round(map.width * this.k))
      const hgt = Math.max(1, Math.round(map.height * this.k))
      if (this.canvas.width !== w || this.canvas.height !== hgt) {
        this.canvas.width = w
        this.canvas.height = hgt
        this.texture?.destroy(true)
        this.texture = null
      }
      this.ctx.globalCompositeOperation = 'source-over'
      this.ctx.clearRect(0, 0, w, hgt)
      if (fog.base === 'covered') {
        this.ctx.fillStyle = '#000'
        this.ctx.fillRect(0, 0, w, hgt)
      }
    }
    for (const s of fog.shapes.slice(appended ? d!.shapes.length : 0)) paintShape(this.ctx, s, this.k)
    this.drawn = { map: mapKey, base: fog.base, shapes: fog.shapes }
    if (!this.texture) this.texture = Texture.from(this.canvas)
    else this.texture.source.update()
    this.sprite.texture = this.texture
    this.sprite.width = map.width
    this.sprite.height = map.height
  }

  snapshot(): { shapes: number; base: Fog['base']; alpha: number } {
    return { ...this.info }
  }

  /**
   * Test hook: whether the fog on screen hides each map point. The point goes through the sprite's own transform
   * (its place and scale over the map), then the painted pixel's alpha is read.
   */
  sample(points: Array<[number, number]>): boolean[] {
    if (!this.texture || !this.sprite.visible) return points.map(() => false)
    const { width, height } = this.canvas
    const data = this.ctx.getImageData(0, 0, width, height).data
    return points.map(([x, y]) => {
      const local = this.sprite.toLocal({ x, y }, this.world)
      const px = Math.floor(local.x)
      const py = Math.floor(local.y)
      if (px < 0 || py < 0 || px >= width || py >= height) return false
      return data[(py * width + px) * 4 + 3] > 127
    })
  }

  destroy(): void {
    this.texture?.destroy(true)
  }
}
