import { Brush, CloudFog, createElement, Crosshair, MousePointer2, Pencil, Pentagon, Ruler, Square, type IconNode } from 'lucide'
import type { Board, Tool } from '../board/board'
import { h } from './dom'

type FogShape = 'fog-brush' | 'fog-rect' | 'fog-poly'
interface ToolDef {
  tool: Tool | 'fog'
  label: string
  key: string
  icon: IconNode
  name: string
}

const TOOLS: ToolDef[] = [
  { tool: 'select', label: 'Mover', key: 'V', icon: MousePointer2, name: 'mouse-pointer' },
  { tool: 'ruler', label: 'Régua', key: 'R', icon: Ruler, name: 'ruler' },
  { tool: 'ping', label: 'Ping', key: 'P', icon: Crosshair, name: 'crosshair' },
  { tool: 'draw', label: 'Desenho', key: 'D', icon: Pencil, name: 'pencil' }
]
const FOG: ToolDef = { tool: 'fog', label: 'Névoa', key: 'N', icon: CloudFog, name: 'cloud-fog' }
const SHAPES: Array<{ tool: FogShape; label: string; icon: IconNode; name: string }> = [
  { tool: 'fog-brush', label: 'Pincel', icon: Brush, name: 'brush' },
  { tool: 'fog-rect', label: 'Retângulo', icon: Square, name: 'square' },
  { tool: 'fog-poly', label: 'Polígono', icon: Pentagon, name: 'pentagon' }
]
const icon = (node: IconNode, name: string): SVGElement => {
  const svg = createElement(node, { width: 18, height: 18, 'aria-hidden': 'true' })
  svg.dataset.icon = name
  return svg
}
const isFog = (t: Tool): t is FogShape => t === 'fog-brush' || t === 'fog-rect' || t === 'fog-poly'
const typing = (t: EventTarget | null): boolean =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable)

/**
 * MTB-01..11: the tool column on the map's left edge, icons with "Name (Key)" tips and one-letter shortcuts; for the
 * master, Névoa opens a panel beside it with the three shapes and the fog options (mode, radius).
 */
export function mapToolbar(host: HTMLElement, board: Board, fogOptions: HTMLElement | null): { root: HTMLElement; snapshot(): { flyout: boolean; fogIcon: string | null }; destroy(): void } {
  let lastFog: FogShape = 'fog-brush'
  const button = (def: ToolDef): HTMLButtonElement =>
    h('button', { class: 'map-tool', testid: `tool-${def.tool}`, title: `${def.label} (${def.key})`, 'aria-label': def.label, 'aria-pressed': 'false', onclick: () => pick(def.tool) }, icon(def.icon, def.name))
  const buttons = new Map<string, HTMLButtonElement>(TOOLS.map((d) => [d.tool, button(d)]))
  const fogButton = fogOptions ? button(FOG) : null
  const shapeButtons = new Map<FogShape, HTMLButtonElement>(
    SHAPES.map((s) => [s.tool, h('button', { class: 'map-tool', testid: `tool-${s.tool}`, title: s.label, 'aria-label': s.label, 'aria-pressed': 'false', onclick: () => board.setTool(s.tool) }, icon(s.icon, s.name))])
  )
  const flyout = h('div', { class: 'fog-flyout', testid: 'fog-flyout', hidden: true },
    h('div', { class: 'row' }, ...shapeButtons.values()),
    ...(fogOptions ? [fogOptions] : [])
  )
  const column = h('div', { class: 'map-tools', testid: 'map-tools' }, ...buttons.values(), ...(fogButton ? [fogButton] : []))
  const root = h('div', { class: 'map-toolbar' }, column, flyout)
  // MTB-07: presses on the column and the panel never reach the map; a release still does, so a drag that ends here ends
  for (const e of ['pointerdown', 'click', 'wheel', 'contextmenu'] as const) root.addEventListener(e, (ev) => ev.stopPropagation())
  // a clicked button does not keep the focus, so Space (pan, MAP-08) never presses it again; the radius field still takes focus
  root.addEventListener('mousedown', (ev) => {
    if ((ev.target as Element).closest('button')) ev.preventDefault()
  })
  host.append(root)

  const pick = (tool: Tool | 'fog'): void => {
    if (tool === 'fog') {
      board.setTool(lastFog)
      flyout.hidden = false
      return
    }
    board.setTool(tool)
  }
  const sync = (tool: Tool): void => {
    for (const [t, b] of buttons) b.setAttribute('aria-pressed', String(t === tool))
    if (isFog(tool)) {
      lastFog = tool
      if (fogButton) { const shape = SHAPES.find((s) => s.tool === tool)!
        fogButton.replaceChildren(icon(shape.icon, shape.name))
      } // MTB-09
    } else flyout.hidden = true // MTB-11: another tool closes it
    fogButton?.setAttribute('aria-pressed', String(isFog(tool)))
    for (const [t, b] of shapeButtons) b.setAttribute('aria-pressed', String(t === tool))
  }
  const offTool = board.onToolChange(sync)
  sync(board.tool)

  /** MTB-04, MTB-05: letters pick tools unless the focus is in a field; Esc closes the fog panel (MTB-11). */
  const key = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      flyout.hidden = true // also from the panel's own radius field (MTB-11)
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return
    const k = e.key.toUpperCase()
    const def = TOOLS.find((d) => d.key === k)
    if (def) pick(def.tool)
    else if (k === FOG.key && fogButton) pick('fog')
  }
  /** MTB-11: a press outside the panel (and outside the Névoa button) closes it; the press still does its work. */
  const outside = (e: PointerEvent): void => {
    if (!flyout.hidden && !flyout.contains(e.target as Node) && !fogButton?.contains(e.target as Node)) flyout.hidden = true
  }
  window.addEventListener('keydown', key)
  document.addEventListener('pointerdown', outside, true)
  return {
    root,
    snapshot: () => ({ flyout: !flyout.hidden, fogIcon: fogButton?.querySelector('svg')?.dataset.icon ?? null }),
    destroy: () => {
      offTool()
      window.removeEventListener('keydown', key)
      document.removeEventListener('pointerdown', outside, true)
      root.remove()
    }
  }
}
