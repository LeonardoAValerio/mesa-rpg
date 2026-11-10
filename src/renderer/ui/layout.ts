import { createDockview, themeDark, type DockviewApi, type DockviewGroupPanel, type IContentRenderer, type IHeaderActionsRenderer, type ITabRenderer } from 'dockview'
import 'dockview/dist/styles/dockview.css'
import type { Role } from '../../core/types'
import { h } from './dom'

export type PanelId = 'conectados' | 'rede' | 'tokens' | 'mapas' | 'dados' | 'chat' | 'sons'
export const PANEL_TITLES: Record<PanelId, string> = { conectados: 'Conectados', rede: 'Rede', tokens: 'Tokens', mapas: 'Mapas', dados: 'Dados', chat: 'Chat', sons: 'Sons' }
/** PANEL-01, PANEL-02: the panels of each role, in the order of the starting tabs. */
export const ROLE_PANELS: Record<Role, PanelId[]> = { master: ['conectados', 'rede', 'tokens', 'mapas', 'dados', 'chat', 'sons'], player: ['conectados', 'dados', 'chat', 'sons'] } // SOM-05
/** Panels that start as tabs beside Conectados (MTB-13). */
const BESIDE_CONECTADOS: PanelId[] = ['rede']
const STARTING_ACTIVE: Record<Role, PanelId> = { master: 'mapas', player: 'dados' }
const TABLE = 'mesa'
/** PANEL-11: where each role's layout is saved on this computer. */
export const LAYOUT_KEY: Record<Role, string> = { master: 'mesa-layout-v3-master', player: 'mesa-layout-v3-player' } // v3: 0.7.0 layouts have no Sons (SOM-05)

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
  private restoring = false
  private readonly counts = new Map<PanelId, number>()
  private dotted = false
  private readonly changeListeners = new Set<() => void>()

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
      createTabComponent: () => this.tab(),
      createRightHeaderActionComponent: () => this.floatButton()
    })
    this.restoring = true
    if (!this.load()) this.buildStarting()
    this.restoring = false
    this.api.onDidLayoutChange(() => {
      if (!this.restoring) this.save()
      this.clearSeen()
      for (const fn of this.changeListeners) fn()
    })
    this.api.onDidActivePanelChange(() => this.clearSeen())
    this.api.onDidActiveGroupChange(() => this.clearSeen())
  }

  /** PANEL-11, PANEL-12: the saved layout of this role, if it reads back with the table and only this role's panels. */
  private load(): boolean {
    let raw: string | null
    try {
      raw = localStorage.getItem(LAYOUT_KEY[this.role])
    } catch {
      return false
    }
    if (!raw) return false
    try {
      this.api.fromJSON(JSON.parse(raw))
      const ids = this.api.panels.map((p) => p.id)
      const allowed: string[] = [TABLE, ...ROLE_PANELS[this.role]]
      if (!ids.includes(TABLE) || ids.some((id) => !allowed.includes(id)) || new Set(ids).size !== ids.length) throw new Error('not this role')
      this.lockTable()
      return true
    } catch {
      this.api.clear()
      return false
    }
  }

  private save(): void {
    try {
      localStorage.setItem(LAYOUT_KEY[this.role], JSON.stringify(this.api.toJSON()))
    } catch {
      // storage refused: the layout just will not come back next time
    }
  }

  onChange(fn: () => void): () => void {
    this.changeListeners.add(fn)
    return () => this.changeListeners.delete(fn)
  }

  /** PANEL-08: "Flutuar" in a group's header puts the group over the table; not on the table's own group. */
  private floatButton(): IHeaderActionsRenderer {
    const button = h('button', { class: 'dock-float', title: 'Flutuar' }, '⇱')
    const element = h('div', { class: 'dock-actions' }, button)
    let off = (): void => {}
    return {
      element,
      init: ({ group, containerApi }) => {
        const sync = (): void => {
          const panel = group.activePanel?.id ?? ''
          button.dataset.testid = `float-${panel}`
          element.hidden = panel === TABLE || group.api.location.type === 'floating'
        }
        sync()
        const a = group.api.onDidActivePanelChange(sync)
        const b = group.api.onDidLocationChange(sync)
        off = () => {
          a.dispose()
          b.dispose()
        }
        button.addEventListener('click', () => {
          // each new floating group cascades from the last, so none hides another
          const n = containerApi.groups.filter((g) => g.api.location.type === 'floating').length
          containerApi.addFloatingGroup(group as DockviewGroupPanel, { x: 40 + 32 * n, y: 40 + 32 * n, width: 340, height: 420 })
        })
      },
      dispose: () => off()
    }
  }

  /** PANEL-09: whether a panel is on screen (in a group or floating). */
  isOpen(id: PanelId): boolean {
    return !!this.api.getPanel(id)
  }

  /** PANEL-09: closes an open panel or opens a closed one in the right-hand group (or a new group right of the table). */
  toggle(id: PanelId): void {
    const panel = this.api.getPanel(id)
    if (panel) return panel.api.close()
    const groups = this.api.groups.filter((g) => !g.panels.some((p) => p.id === TABLE) && g.api.location.type === 'grid')
    const target = groups[groups.length - 1]
    if (target) this.api.addPanel({ id, component: id, title: PANEL_TITLES[id], position: { referenceGroup: target } })
    else this.api.addPanel({ id, component: id, title: PANEL_TITLES[id], position: { referencePanel: TABLE, direction: 'right' }, initialWidth: 300 })
  }

  /** PANEL-10: forgets the saved layout and shows the starting one. */
  restore(): void {
    this.restoring = true
    try {
      localStorage.removeItem(LAYOUT_KEY[this.role])
    } catch {
      // nothing saved to forget
    }
    this.buildStarting()
    this.restoring = false
    this.save()
  }

  private content(name: string): IContentRenderer {
    const element = name === TABLE ? this.table : this.panels[name as PanelId]
    return { element, init: () => {} }
  }

  /** A tab with the panel's title, a close button (PANEL-09), a count badge (PANEL-16) and a highlight dot (PANEL-18). */
  private tab(): ITabRenderer {
    const title = h('span', {})
    const count = h('span', { class: 'tab-count', hidden: true })
    const dot = h('span', { class: 'tab-dot', hidden: true }, '●')
    const close = h('button', { class: 'tab-close', title: 'Fechar' }, '×')
    const element = h('div', { class: 'tab-label' }, title, count, dot, close)
    return {
      element,
      init: ({ api }) => {
        const id = api.id
        title.textContent = id === TABLE ? 'Mesa' : PANEL_TITLES[id as PanelId]
        element.dataset.testid = `tab-${id}`
        count.dataset.testid = `tab-count-${id}`
        dot.dataset.testid = `tab-dot-${id}`
        close.dataset.testid = `close-${id}`
        close.addEventListener('pointerdown', (e) => e.stopPropagation()) // a press on × is not a tab drag
        close.addEventListener('click', (e) => {
          e.stopPropagation()
          api.close()
        })
        this.tabs.set(id, { element, count, dot })
        this.drawCount(id as PanelId)
        if (id === 'tokens') this.drawDot()
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
    this.api.addPanel({ id: 'conectados', component: 'conectados', title: PANEL_TITLES.conectados, position: { referencePanel: TABLE, direction: 'right' }, initialWidth: 380 }) // five tabs (with Sons) fit without the overflow menu (PANEL-01, SOM-05)
    const roles = ROLE_PANELS[this.role]
    for (const id of BESIDE_CONECTADOS.filter((p) => roles.includes(p))) this.api.addPanel({ id, component: id, title: PANEL_TITLES[id], position: { referencePanel: 'conectados', direction: 'within' }, inactive: true })
    const [first, ...rest] = roles.filter((p) => p !== 'conectados' && !BESIDE_CONECTADOS.includes(p))
    this.api.addPanel({ id: first, component: first, title: PANEL_TITLES[first], position: { referencePanel: 'conectados', direction: 'below' } })
    for (const id of rest) this.api.addPanel({ id, component: id, title: PANEL_TITLES[id], position: { referencePanel: first, direction: 'within' } })
    this.api.getPanel('conectados')?.group.api.setSize({ height: 140 })
    this.api.getPanel('conectados')?.api.setActive()
    this.api.getPanel(STARTING_ACTIVE[this.role])?.api.setActive()
  }

  /** PANEL-16: one more entry for a panel; counted only while the panel is not visible. */
  arrived(id: PanelId): void {
    if (this.isVisible(id)) return
    this.counts.set(id, (this.counts.get(id) ?? 0) + 1)
    this.drawCount(id)
  }

  /** PANEL-18, PANEL-19: a selection made while Tokens is not on screen dots its tab; clearing the selection undots it. */
  selected(id: string | null): void {
    this.dotted = id !== null && !this.isVisible('tokens')
    this.drawDot()
  }

  private drawDot(): void {
    const tab = this.tabs.get('tokens')
    if (tab) tab.dot.hidden = !this.dotted
  }

  /** PANEL-17, PANEL-19: a panel on screen has nothing unseen. */
  private clearSeen(): void {
    if (this.dotted && this.isVisible('tokens')) {
      this.dotted = false
      this.drawDot()
    }
    for (const id of [...this.counts.keys()]) {
      if (!this.isVisible(id)) continue
      this.counts.delete(id)
      this.drawCount(id)
    }
  }

  private drawCount(id: PanelId): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    const n = this.counts.get(id) ?? 0
    tab.count.hidden = n === 0
    tab.count.textContent = n > 9 ? '9+' : String(n)
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
