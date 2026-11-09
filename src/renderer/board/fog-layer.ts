import { Graphics, type FederatedPointerEvent } from 'pixi.js'
import { coveredCells, type FogMode } from '../../core/fog'
import { cellOrigin } from '../../core/grid'
import type { View } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from '../ui/dom'
import type { Board } from './board'

export const MASTER_FOG_ALPHA = 0.5
export const PLAYER_FOG_ALPHA = 1

/** FOG-02: covered cells are opaque for players and 50% for the master. */
export function drawFog(g: Graphics, view: View): { covered: number; alpha: number } {
  g.clear()
  const alpha = view.role === 'master' ? MASTER_FOG_ALPHA : PLAYER_FOG_ALPHA
  if (!view.fog || !view.map) return { covered: 0, alpha }
  const cells = coveredCells(view.fog)
  const { cell } = view.grid
  for (const [c, r] of cells) {
    const o = cellOrigin(view.grid, c, r)
    g.rect(o.x, o.y, cell, cell)
  }
  if (cells.length) g.fill({ color: 0x000000, alpha })
  return { covered: cells.length, alpha }
}

/** Master-only fog tools: brush and rectangle in Reveal/Cover mode, and "Cobrir tudo" (FOG-03..05). */
export function fogTools(board: Board, client: TableClient): { root: HTMLElement; destroy(): void } {
  let mode: FogMode = 'reveal'
  let radius = 2
  let start: { x: number; y: number } | null = null
  let lastCell = ''
  const preview = new Graphics()
  board.overlayLayer.addChild(preview)

  const brushAt = (x: number, y: number): void => {
    const g = client.view?.grid
    if (!g) return
    const key = `${Math.floor(x / (g.cell / 2))}:${Math.floor(y / (g.cell / 2))}`
    if (key === lastCell) return
    lastCell = key
    void client.send({ type: 'fog/brush', x, y, radius, mode })
  }
  const world = (e: FederatedPointerEvent): { x: number; y: number } => board.toWorld(e.global.x, e.global.y)
  const down = (e: FederatedPointerEvent): void => {
    if (e.button !== 0 || board.spaceHeld) return
    const p = world(e)
    if (board.tool === 'fog-brush') {
      start = p
      lastCell = ''
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
    if (board.tool === 'fog-rect') void client.send({ type: 'fog/rect', x0: start.x, y0: start.y, x1: p.x, y1: p.y, mode })
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
  const radiusInput = h('input', { type: 'number', testid: 'fog-radius', min: 1, max: 10, value: String(radius) })
  radiusInput.addEventListener('change', () => {
    radius = Math.min(10, Math.max(1, Math.round(Number(radiusInput.value) || 1)))
    radiusInput.value = String(radius)
  })
  const root = h('section', { class: 'panel', testid: 'fog-panel' },
    h('h3', {}, 'Névoa'),
    h('div', { class: 'row' }, reveal, cover),
    h('label', {}, 'Raio do pincel (células)', radiusInput),
    h('button', { testid: 'fog-cover-all', class: 'secondary', onclick: () => void client.send({ type: 'fog/coverAll' }) }, 'Cobrir tudo')
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
