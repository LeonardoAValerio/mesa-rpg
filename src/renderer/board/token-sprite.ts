import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js'
import type { Grid, Token } from '../../core/types'

export interface TokenSprite {
  root: Container
  ring: string
  label: string
}

/** TOK-06: a token covers size×size cells, with a ring in its faction colour and its name below. */
export function drawToken(t: Token, grid: Grid, ringColor: string, texture: Texture | null, owner: string | null): TokenSprite {
  const side = t.width * grid.cell
  const root = new Container()
  root.position.set(t.x - side / 2, t.y - side / 2)
  root.alpha = t.hidden ? 0.5 : 1
  const r = side / 2
  if (texture) {
    const img = new Sprite(texture)
    img.width = side
    img.height = side
    const mask = new Graphics().circle(r, r, r - 2).fill(0xffffff)
    img.mask = mask
    root.addChild(img, mask)
  } else {
    root.addChild(new Graphics().circle(r, r, r - 2).fill({ color: 0x3a3f48 }))
  }
  root.addChild(new Graphics().circle(r, r, r - 2).stroke({ width: Math.max(3, grid.cell / 16), color: ringColor }))
  const label = owner ? `${t.name} (${owner})` : t.name
  const text = new Text({
    text: label,
    style: { fontSize: Math.max(12, grid.cell / 5), fill: 0xffffff, stroke: { color: 0x000000, width: 3 } }
  })
  text.anchor.set(0.5, 0)
  text.position.set(r, side + 2)
  root.addChild(text)
  return { root, ring: ringColor, label }
}
