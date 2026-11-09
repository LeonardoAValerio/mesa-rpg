import type { ClientStatus } from '../net/table-client'
import { h } from './dom'

/** NET-10, NET-12, NET-13: what the table shows when the link to the master is not up. */
export function statusOverlay(status: ClientStatus, backHome: () => void): HTMLElement | null {
  if (status.kind === 'reconnecting') {
    return h('div', { class: 'overlay', testid: 'status' }, h('p', { testid: 'status-message' }, status.message))
  }
  if (status.kind === 'lost' || status.kind === 'closed') {
    return h('div', { class: 'overlay', testid: 'status' },
      h('p', { testid: 'status-message' }, status.message),
      h('button', { testid: 'back-home', onclick: backHome }, 'Voltar ao início')
    )
  }
  return null
}
