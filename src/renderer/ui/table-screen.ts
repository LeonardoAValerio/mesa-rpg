import type { LanAddress } from '../../preload/api'
import type { TableClient } from '../net/table-client'
import { clear, h } from './dom'
import { hostInfo } from './host-info'
import { statusOverlay } from './status-overlay'

export interface TableScreen {
  root: HTMLElement
  board: HTMLElement
  sidebar: HTMLElement
  toolbar: HTMLElement
  destroy(): void
}

export interface HostDetails {
  port: number
  addresses: LanAddress[]
  copy(text: string): void
  stop(): void
}

/** The table: top bar, board area, sidebar with the players list (NET-06), status overlay. */
export function renderTableScreen(root: HTMLElement, client: TableClient, host: HostDetails | null, backHome: () => void): TableScreen {
  const players = h('ul', { class: 'players', testid: 'players' })
  const board = h('main', { class: 'board', testid: 'board' })
  const toolbar = h('div', { class: 'toolbar', testid: 'toolbar' })
  const sidebar = h('aside', { class: 'sidebar' }, h('h3', {}, 'Conectados'), players)
  const overlaySlot = h('div', {})
  const you = client.you
  const topbar = h('header', { class: 'topbar' },
    h('strong', { testid: 'you' }, `${you?.name ?? ''} · ${you?.role === 'master' ? 'mestre' : 'jogador'}`),
    host ? hostInfo(host.addresses, host.port, host.copy) : null,
    toolbar,
    host
      ? h('button', { testid: 'stop-host', onclick: host.stop }, 'Encerrar mesa')
      : h('button', { testid: 'leave', onclick: backHome }, 'Sair')
  )
  const screen = h('div', { class: 'table', testid: 'table' }, topbar, board, sidebar, overlaySlot)
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
    sidebar,
    toolbar,
    destroy: () => {
      offView()
      offStatus()
    }
  }
}
