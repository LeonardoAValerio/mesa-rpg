import type { LanAddress } from '../../preload/api'
import { h } from './dom'

/** NET-03: the master's IPv4 addresses, labelled, each with "Copiar" for IP:porta. */
export function hostInfo(addresses: LanAddress[], port: number, copy: (text: string) => void): HTMLElement {
  return h('div', { class: 'host-info', testid: 'host-info' },
    h('span', { class: 'hint' }, `Porta ${port} · Se o Windows perguntar, permita o acesso à rede.`),
    ...addresses.map((a) =>
      h('div', { class: 'address', testid: 'address' },
        h('span', { class: 'label', testid: 'address-label' }, a.label),
        h('code', { testid: 'address-ip' }, `${a.ip}:${port}`),
        h('button', { testid: 'copy', onclick: () => copy(`${a.ip}:${port}`) }, 'Copiar')
      )
    )
  )
}
