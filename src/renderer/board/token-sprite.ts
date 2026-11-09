import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js'
import type { Grid, Token } from '../../core/types'

export interface TokenSprite {
  /** At the item's centre; holds the rotated body and the unrotated name. */
  root: Container
  /** The image, ring and selection outline, rotated with the item. */
  body: Container
  /** The drawn image (or placeholder) size in map pixels. */
  w: number
  h: number
  ring: string | null
  label: string
}

/**
 * ITEM-01, ITEM-02, ITEM-05: the whole PNG, `width` cells wide and as tall as its aspect ratio makes it, centred on the
 * item and rotated about its centre; a ring only on a character that has one; the name under characters only. While
 * the image loads, a square placeholder of the same width.
 */
export function drawToken(t: Token, grid: Grid, ringColor: string | null, texture: Texture | null, owner: string | null): TokenSprite {
  const w = t.width * grid.cell
  const h = texture && texture.width > 0 ? (w * texture.height) / texture.width : w
  const root = new Container()
  root.position.set(t.x, t.y)
  root.alpha = t.hidden ? 0.5 : 1
  const body = new Container()
  body.rotation = (t.rotation * Math.PI) / 180
  if (texture) {
    const img = new Sprite(texture)
    img.anchor.set(0.5)
    img.width = w
    img.height = h
    body.addChild(img)
  } else {
    body.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 8).fill({ color: 0x3a3f48 }))
  }
  const ring = t.kind === 'character' && t.ring && ringColor ? ringColor : null
  if (ring) body.addChild(new Graphics().ellipse(0, 0, w / 2, h / 2).stroke({ width: Math.max(3, grid.cell / 16), color: ring }))
  root.addChild(body)
  let label = ''
  if (t.kind === 'character') {
    label = owner ? `${t.name} (${owner})` : t.name
    const text = new Text({ text: label, style: { fontSize: Math.max(12, grid.cell / 5), fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } })
    text.anchor.set(0.5, 0)
    text.position.set(0, Math.max(w, h) / 2 + 2)
    root.addChild(text)
  }
  return { root, body, w, h, ring, label }
}
