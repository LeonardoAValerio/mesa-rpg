import type { CampaignInfo } from '../../preload/api'
import { h } from './dom'

/** CAMP-05, CAMP-07: the open campaign's name and "Abrir pasta", at the top of Mapas. */
export function campaignHeader(): { root: HTMLElement; destroy(): void } {
  const name = h('strong', { testid: 'campaign-name' })
  const draw = (info: CampaignInfo | null): void => {
    name.textContent = info?.name ?? ''
  }
  void window.mesa.campaign().then(draw)
  const off = window.mesa.onCampaign(draw)
  const root = h('section', { class: 'panel', testid: 'campaign-header' },
    h('h3', {}, 'Campanha'),
    h('div', { class: 'row' }, name, h('button', { testid: 'open-folder', class: 'secondary', onclick: () => void window.mesa.openFolder() }, 'Abrir pasta'))
  )
  return { root, destroy: off }
}
