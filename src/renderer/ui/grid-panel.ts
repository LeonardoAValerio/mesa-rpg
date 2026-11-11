import { detectGrid, gridFromDetection } from '../../core/grid-detect'
import { INVALID_IMAGE } from '../../core/image-info'
import type { Grid } from '../../core/types'
import { decodeImage, pixelsOf, type TextureStore } from '../assets/textures'
import type { TableClient } from '../net/table-client'
import { h } from './dom'

export interface GridPanel {
  root: HTMLElement
  /** MAP-02, MAP-03, MAP-04, MAP-09: pick an image, detect its grid and make it the scene map. */
  importMap(): Promise<void>
  /** CAMP-13: makes a campaign map (already in the store) the scene map, as "Importar mapa" does. */
  loadMap(hash: string, width: number, height: number): Promise<void>
  destroy(): void
}

/** Master-only panel: import a map and adjust the grid (MAP-05). */
export function gridPanel(client: TableClient, textures: TextureStore): GridPanel {
  const message = h('p', { class: 'error', testid: 'map-message', role: 'status' })
  const num = (testid: string, min: number, max: number, step = 1): HTMLInputElement =>
    h('input', { type: 'number', testid, min, max, step })
  const cell = num('grid-cell', 10, 500, 0.01)
  const offX = num('grid-offset-x', 0, 500, 0.01)
  const offY = num('grid-offset-y', 0, 500, 0.01)
  const opacity = num('grid-opacity', 0, 100)
  const color = h('input', { type: 'color', testid: 'grid-color' })
  const visible = h('input', { type: 'checkbox', testid: 'grid-visible' }) // BRD-03: kept with the scene

  const send = (grid: Partial<Grid>): void => void client.send({ type: 'grid/set', grid })
  const onNum = (input: HTMLInputElement, key: 'cell' | 'offsetX' | 'offsetY' | 'opacity'): void => {
    input.addEventListener('change', () => {
      const v = Number(input.value)
      if (!Number.isFinite(v)) return
      send({ [key]: key === 'opacity' ? v / 100 : v })
    })
  }
  onNum(cell, 'cell')
  onNum(offX, 'offsetX')
  onNum(offY, 'offsetY')
  onNum(opacity, 'opacity')
  color.addEventListener('change', () => send({ color: color.value }))
  visible.addEventListener('change', () => send({ visible: visible.checked }))

  const fill = (): void => {
    const g = client.view?.grid
    if (!g) return
    const set = (input: HTMLInputElement, v: string): void => {
      if (document.activeElement !== input) input.value = v
    }
    set(cell, String(g.cell))
    set(offX, String(g.offsetX))
    set(offY, String(g.offsetY))
    set(opacity, String(Math.round(g.opacity * 100)))
    set(color, g.color)
    visible.checked = g.visible !== false
  }
  fill()
  const off = client.on('view', fill)

  /** MAP-02..04: detect the grid of the image and make it the scene map. */
  const setMap = async (hash: string, width: number, height: number, bytes: Uint8Array): Promise<void> => {
    const bitmap = await decodeImage(bytes)
    if (!bitmap) {
      message.textContent = INVALID_IMAGE
      return
    }
    const { grid, warning } = gridFromDetection(detectGrid(pixelsOf(bitmap), bitmap.width, bitmap.height), client.view?.grid)
    textures.add(hash, bitmap)
    const r = await client.send({ type: 'map/set', hash, width, height, grid })
    if (!r.ok) message.textContent = r.reason
    else if (warning) message.textContent = warning
  }
  const importMap = async (): Promise<void> => {
    message.textContent = ''
    const res = await window.mesa.importMap()
    if (!res.ok) {
      if ('error' in res) message.textContent = res.error
      return
    }
    await setMap(res.hash, res.width, res.height, res.bytes)
  }
  const loadMap = async (hash: string, width: number, height: number): Promise<void> => {
    message.textContent = ''
    const bytes = await window.mesa.assetBytes(hash)
    if (!bytes) {
      message.textContent = INVALID_IMAGE
      return
    }
    await setMap(hash, width, height, bytes)
  }

  const root = h('section', { class: 'panel', testid: 'grid-panel' },
    h('h3', {}, 'Mapa e grid'),
    h('button', { testid: 'import-map-panel', onclick: () => void importMap() }, 'Importar mapa'),
    message,
    h('label', { class: 'check' }, visible, 'Mostrar grid'),
    h('label', {}, 'Célula (px)', cell),
    h('div', { class: 'row' }, h('label', {}, 'Deslocamento X', offX), h('label', {}, 'Deslocamento Y', offY)),
    h('div', { class: 'row' }, h('label', {}, 'Cor', color), h('label', {}, 'Opacidade (%)', opacity))
  )
  return { root, importMap, loadMap, destroy: off }
}
