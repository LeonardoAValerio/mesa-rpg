import { h } from './dom'
import { PANEL_TITLES, ROLE_PANELS, type Layout } from './layout'

/** PANEL-09, PANEL-10: "Painéis" in the top bar lists the role's panels, marked when open, and "Restaurar layout". */
export function panelsMenu(layout: Layout): { root: HTMLElement; destroy(): void } {
  const list = h('div', { class: 'panels-menu', testid: 'panels-menu', hidden: true })
  const button = h('button', { class: 'secondary', testid: 'panels-button', onclick: () => toggleMenu() }, 'Painéis')
  const draw = (): void => {
    const rows = ROLE_PANELS[layout.role].map((id) => {
      const open = layout.isOpen(id)
      return h('button', { class: 'panels-item', testid: `panels-menu-${id}`, role: 'menuitemcheckbox', 'aria-checked': String(open), onclick: () => layout.toggle(id) }, `${open ? '✓' : ' '} ${PANEL_TITLES[id]}`)
    })
    const restore = h('button', { class: 'panels-item', testid: 'panels-restore', onclick: () => { layout.restore(); list.hidden = true } }, 'Restaurar layout')
    list.replaceChildren(...rows, h('hr', {}), restore)
  }
  const toggleMenu = (): void => {
    draw()
    list.hidden = !list.hidden
  }
  const closeOutside = (e: PointerEvent): void => {
    if (!list.hidden && !root.contains(e.target as Node)) list.hidden = true
  }
  document.addEventListener('pointerdown', closeOutside)
  const off = layout.onChange(() => !list.hidden && draw())
  const root = h('div', { class: 'panels' }, button, list)
  return {
    root,
    destroy: () => {
      off()
      document.removeEventListener('pointerdown', closeOutside)
    }
  }
}
