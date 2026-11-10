import { createDockview, themeDark, type DockviewApi, type DockviewGroupPanel, type IContentRenderer, type ITabRenderer } from 'dockview'
import 'dockview/dist/styles/dockview.css'
import type { Role } from '../../core/types'
import { h } from './dom'

export type PanelId = 'conectados' | 'tokens' | 'mapas' | 'dados' | 'chat'
export const PANEL_TITLES: Record<PanelId, string> = { conectados: 'Conectados', tokens: 'Tokens', mapas: 'Mapas', dados: 'Dados', chat: 'Chat' }
/** PANEL-01, PANEL-02: the panels of each role, in the order of the starting tabs. */
export const ROLE_PANELS: Record<Role, PanelId[]> = { master: ['conectados', 'tokens', 'mapas', 'dados', 'chat'], player: ['conectados', 'dados', 'chat'] }
const STARTING_ACTIVE: Record<Role, PanelId> = { master: 'mapas', player: 'dados' }
const TABLE = 'mesa'

export interface LayoutSnapshot {
  groups: Array<{ panels: string[]; active: string | null; floating: boolean; header: boolean; left: number; top: number; width: number; height: number }>
  visible: string[]
}

interface Tab {
  element: HTMLElement
  count: HTMLElement
  dot: HTMLElement
}

/**
 * PANEL-01..05, PANEL-13: the table in the centre, in a locked group with no tab header, and the role's panels around
 * it. Each panel's content is an element built once and moved, never recreated, so what is typed in it stays (PANEL-14).
 */
export class Layout {
  readonly api: DockviewApi
  private readonly tabs = new Map<string, Tab>()

  constructor(
    host: HTMLElement,
    readonly role: Role,
    private readonly table: HTMLElement,
    private readonly panels: Record<PanelId, HTMLElement>
  ) {
    this.api = createDockview(host, {
      theme: themeDark,
      createComponent: ({ name }) => this.content(name),
      defaultTabComponent: 'label',
      createTabComponent: () => this.tab()
    })
    this.buildStarting()
  }

  private content(name: string): IContentRenderer {
    const element = name === TABLE ? this.table : this.panels[name as PanelId]
    return { element, init: () => {} }
  }

  /** A tab with the panel's title, a count badge (PANEL-16) and a highlight dot (PANEL-18); dockview tells it which panel in `init`. */
  private tab(): ITabRenderer {
    const title = h('span', {})
    const count = h('span', { class: 'tab-count', hidden: true })
    const dot = h('span', { class: 'tab-dot', hidden: true }, '●')
    const element = h('div', { class: 'tab-label' }, title, count, dot)
    return {
      element,
      init: ({ api }) => {
        const id = api.id
        title.textContent = id === TABLE ? 'Mesa' : PANEL_TITLES[id as PanelId]
        element.dataset.testid = `tab-${id}`
        count.dataset.testid = `tab-count-${id}`
        dot.dataset.testid = `tab-dot-${id}`
        this.tabs.set(id, { element, count, dot })
      }
    }
  }

  /** The table group: no header, nothing dropped into it, never closed or floated (PANEL-13). */
  private lockTable(): void {
    const group = this.api.getPanel(TABLE)?.group
    if (!group) return
    group.locked = true
    group.header.hidden = true
  }

  /** PANEL-01, PANEL-02: the table on the left; on the right "Conectados" above the role's other panels as tabs. */
  buildStarting(): void {
    this.api.clear()
    this.api.addPanel({ id: TABLE, component: TABLE, title: 'Mesa' })
    this.lockTable()
    this.api.addPanel({ id: 'conectados', component: 'conectados', title: PANEL_TITLES.conectados, position: { referencePanel: TABLE, direction: 'right' }, initialWidth: 300 })
    const [first, ...rest] = ROLE_PANELS[this.role].filter((p) => p !== 'conectados')
    this.api.addPanel({ id: first, component: first, title: PANEL_TITLES[first], position: { referencePanel: 'conectados', direction: 'below' } })
    for (const id of rest) this.api.addPanel({ id, component: id, title: PANEL_TITLES[id], position: { referencePanel: first, direction: 'within' } })
    this.api.getPanel('conectados')?.group.api.setSize({ height: 140 })
    this.api.getPanel(STARTING_ACTIVE[this.role])?.api.setActive()
  }

  isVisible(id: PanelId): boolean {
    return this.api.getPanel(id)?.api.isVisible ?? false
  }

  tabOf(id: PanelId): Tab | undefined {
    return this.tabs.get(id)
  }

  snapshot(): LayoutSnapshot {
    const group = (g: DockviewGroupPanel) => ({
      left: Math.round(g.element.getBoundingClientRect().left),
      top: Math.round(g.element.getBoundingClientRect().top),
      panels: g.panels.map((p) => p.id),
      active: g.activePanel?.id ?? null,
      floating: g.api.location.type === 'floating',
      header: !g.header.hidden,
      width: Math.round(g.width),
      height: Math.round(g.height)
    })
    return { groups: this.api.groups.map(group), visible: this.api.panels.filter((p) => p.api.isVisible).map((p) => p.id) }
  }

  dispose(): void {
    this.api.dispose()
  }
}
