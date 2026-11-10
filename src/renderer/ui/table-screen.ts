import type { LanAddress } from '../../preload/api'
import type { TableClient } from '../net/table-client'
import { clear, h } from './dom'
import { hostInfo } from './host-info'
import type { PanelId } from './layout'
import { statusOverlay } from './status-overlay'

export interface TableScreen {
  root: HTMLElement
  board: HTMLElement
  /** Where the docking layout lives: the table and the panels around it. */
  dock: HTMLElement
  /** The content of each panel, built once (PANEL-14). */
  panels: Record<PanelId, HTMLElement>
  /** The top bar's right end, before "Encerrar mesa" / "Sair". */
  actions: HTMLElement
  destroy(): void
}

export interface HostDetails {
  port: number
  addresses: LanAddress[]
  copy(text: string): void
  stop(): void
}

/** The table: top bar, the docking area with the board and the panels (the players list is "Conectados", NET-06), status overlay. */
export function renderTableScreen(root: HTMLElement, client: TableClient, host: HostDetails | null, backHome: () => void): TableScreen {
  const players = h('ul', { class: 'players', testid: 'players' })
  const board = h('main', { class: 'board', testid: 'board' })
  const panel = (id: PanelId, ...children: HTMLElement[]): HTMLElement => h('div', { class: 'dock-panel', testid: `panel-${id}` }, ...children)
  const panels: Record<PanelId, HTMLElement> = {
    conectados: panel('conectados', players),
    rede: panel('rede', ...(host ? [h('h3', {}, 'Rede'), hostInfo(host.addresses, host.port, host.copy)] : [])), // MTB-12
    tokens: panel('tokens'),
    mapas: panel('mapas'),
    dados: panel('dados'),
    chat: panel('chat')
  }
  const dock = h('div', { class: 'dock', testid: 'dock' })
  const actions = h('div', { class: 'topbar-actions' })
  const overlaySlot = h('div', {})
  const you = client.you
  const topbar = h('header', { class: 'topbar' },
    h('strong', { testid: 'you' }, `${you?.name ?? ''} · ${you?.role === 'master' ? 'mestre' : 'jogador'}`),
    actions,
    host
      ? h('button', { testid: 'stop-host', onclick: host.stop }, 'Encerrar mesa')
      : h('button', { testid: 'leave', onclick: backHome }, 'Sair')
  )
  const screen = h('div', { class: 'table', testid: 'table' }, topbar, dock, overlaySlot)
  root.replaceChildren(screen)

  const drawPlayers = (): void => {
    clear(players)
    for (const p of client.view?.players ?? []) players.append(h('li', { testid: 'player' }, p))
  }
  const drawStatus = (): void => {
    const o = statusOverlay(client.status, backHome)
    overlaySlot.replaceChildren(...(o ? [o] : []))
  }
  drawPlayers()
  drawStatus()
  const offView = client.on('view', drawPlayers)
  const offStatus = client.on('status', drawStatus)

  return {
    root: screen,
    board,
    dock,
    panels,
    actions,
    destroy: () => {
      offView()
      offStatus()
    }
  }
}
