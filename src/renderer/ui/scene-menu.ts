import type { CampaignInfo } from '../../preload/api'
import type { TableClient } from '../net/table-client'
import { h } from './dom'

export const CONFIRM_REPLACE = 'Substituir a cena atual?'
export const confirmOverwrite = (name: string): string => `Substituir a cena ${name}?`

/** In-page confirmation; resolves true for "Substituir". */
function confirm(host: HTMLElement, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean): void => {
      box.remove()
      resolve(v)
    }
    const box = h('div', { class: 'overlay', testid: 'confirm' },
      h('p', { testid: 'confirm-message' }, message),
      h('div', { class: 'row' },
        h('button', { testid: 'confirm-yes', onclick: () => done(true) }, 'Substituir'),
        h('button', { testid: 'confirm-no', class: 'secondary', onclick: () => done(false) }, 'Cancelar')
      )
    )
    host.append(box)
  })
}

/** In-page name prompt for "Salvar cena"; resolves the name, or null when cancelled. */
function askName(host: HTMLElement): Promise<string | null> {
  return new Promise((resolve) => {
    const input = h('input', { testid: 'scene-name', placeholder: 'Nome da cena', maxlength: 60 })
    const done = (v: string | null): void => {
      box.remove()
      resolve(v)
    }
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(input.value)
      if (e.key === 'Escape') done(null)
    })
    const box = h('div', { class: 'overlay', testid: 'scene-prompt' },
      h('p', {}, 'Salvar cena como'),
      input,
      h('div', { class: 'row' },
        h('button', { testid: 'scene-name-ok', onclick: () => done(input.value) }, 'Salvar'),
        h('button', { testid: 'scene-name-cancel', class: 'secondary', onclick: () => done(null) }, 'Cancelar')
      )
    )
    host.append(box)
    input.focus()
  })
}

/**
 * Master-only, in Mapas: the campaign's scenes by name (CAMP-16..19) and the full .mesa file to send to someone
 * (CAMP-21). Loading over a table with items asks first (SAVE-05).
 */
export function sceneMenu(client: TableClient, overlayHost: HTMLElement): { root: HTMLElement; destroy(): void } {
  const message = h('p', { class: 'error', testid: 'scene-message' })
  const list = h('div', { class: 'scene-list', testid: 'scene-list' })
  const show = (r: { ok: true } | { ok: false; error: string } | { ok: false; canceled: true } | { ok: false; exists: true }): void => {
    message.textContent = !r.ok && 'error' in r ? r.error : ''
  }
  const keepsItems = (): boolean => Object.keys(client.view?.tokens ?? {}).length > 0

  const save = async (): Promise<void> => {
    message.textContent = ''
    const name = await askName(overlayHost)
    if (name === null) return
    let r = await window.mesa.saveCena(name, false)
    if (!r.ok && 'exists' in r) {
      if (!(await confirm(overlayHost, confirmOverwrite(name)))) return // CAMP-17
      r = await window.mesa.saveCena(name, true)
    }
    show(r)
  }
  const load = async (name: string): Promise<void> => {
    message.textContent = ''
    if (keepsItems() && !(await confirm(overlayHost, CONFIRM_REPLACE))) return // SAVE-05
    show(await window.mesa.loadCena(name)) // CAMP-19: "Arquivo não encontrado: <caminho>"
  }
  const importMesa = async (): Promise<void> => {
    message.textContent = ''
    if (keepsItems() && !(await confirm(overlayHost, CONFIRM_REPLACE))) return // SAVE-05
    show(await window.mesa.importMesa())
  }
  const draw = (info: CampaignInfo | null): void => {
    const scenes = info?.scenes ?? []
    list.replaceChildren(
      ...(scenes.length
        ? scenes.map((n) => h('button', { class: 'campaign-row', testid: 'scene-item', onclick: () => void load(n) }, n))
        : [h('p', { class: 'hint' }, 'Nenhuma cena salva ainda')])
    )
  }
  void window.mesa.campaign().then(draw)
  const off = window.mesa.onCampaign(draw)

  const root = h('section', { class: 'panel', testid: 'scene-menu' },
    h('h3', {}, 'Cenas'),
    h('button', { testid: 'save-scene', onclick: () => void save() }, 'Salvar cena'),
    list,
    h('div', { class: 'row' },
      h('button', { testid: 'export-mesa', class: 'secondary', onclick: async () => show(await window.mesa.exportMesa()) }, 'Exportar .mesa'),
      h('button', { testid: 'import-mesa', class: 'secondary', onclick: () => void importMesa() }, 'Importar .mesa')
    ),
    message
  )
  return { root, destroy: off }
}
