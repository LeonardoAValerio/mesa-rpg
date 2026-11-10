import type { TableClient } from '../net/table-client'
import { h } from './dom'

export const CONFIRM_REPLACE = 'Substituir a cena atual?'

/** In-page confirmation; resolves true for "Substituir". */
function confirmReplace(host: HTMLElement): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean): void => {
      box.remove()
      resolve(v)
    }
    const box = h('div', { class: 'overlay', testid: 'confirm' },
      h('p', { testid: 'confirm-message' }, CONFIRM_REPLACE),
      h('div', { class: 'row' },
        h('button', { testid: 'confirm-yes', onclick: () => done(true) }, 'Substituir'),
        h('button', { testid: 'confirm-no', class: 'secondary', onclick: () => done(false) }, 'Cancelar')
      )
    )
    host.append(box)
  })
}

/** Master-only: save the scene to a .mesa file and load one back (SAVE-01..05). */
export function sceneMenu(client: TableClient, overlayHost: HTMLElement): { root: HTMLElement } {
  const message = h('p', { class: 'error', testid: 'scene-message' })
  const save = async (): Promise<void> => {
    const r = await window.mesa.exportMesa()
    message.textContent = r.ok ? '' : 'error' in r ? r.error : ''
  }
  const load = async (): Promise<void> => {
    message.textContent = ''
    if (Object.keys(client.view?.tokens ?? {}).length > 0 && !(await confirmReplace(overlayHost))) return // SAVE-05
    const r = await window.mesa.importMesa()
    if (!r.ok && 'error' in r) message.textContent = r.error
  }
  const root = h('section', { class: 'panel', testid: 'scene-menu' },
    h('h3', {}, 'Cena'),
    h('div', { class: 'row' },
      h('button', { testid: 'save-scene', onclick: () => void save() }, 'Salvar cena'),
      h('button', { testid: 'load-scene', class: 'secondary', onclick: () => void load() }, 'Carregar cena')
    ),
    message
  )
  return { root }
}
