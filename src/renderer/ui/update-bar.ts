import { updateBanner, type UpdateState } from '../../core/update-state'
import { h } from './dom'

export interface UpdateBarDeps {
  isHosting(): boolean
  install(): void
}

export const MSG_CONFIRM_RESTART = 'Reiniciar encerra a mesa para todos. Continuar?'

/**
 * UPD-04..UPD-07: a bar at the top of the window, above every screen, with the download notice and,
 * once ready, "Reiniciar e atualizar". While hosting, the restart asks first, since it ends the table.
 */
export function mountUpdateBar(parent: HTMLElement, deps: UpdateBarDeps): void {
  const text = h('span', { testid: 'update-text' })
  const confirm = h('div', { class: 'update-confirm', testid: 'update-confirm', role: 'dialog', hidden: true },
    h('div', { class: 'card' },
      h('p', {}, MSG_CONFIRM_RESTART),
      h('div', { class: 'row' },
        h('button', { testid: 'update-confirm-yes', onclick: () => { confirm.hidden = true; deps.install() } }, 'Sim'),
        h('button', { class: 'secondary', testid: 'update-confirm-no', onclick: () => { confirm.hidden = true } }, 'Não')
      )
    )
  )
  const install = h('button', {
    testid: 'update-install',
    onclick: () => {
      if (deps.isHosting()) confirm.hidden = false
      else deps.install()
    }
  }, 'Reiniciar e atualizar')
  const bar = h('div', { class: 'update-bar', testid: 'update-bar', role: 'status', hidden: true }, text, install)
  parent.prepend(bar)
  parent.append(confirm)

  const show = (state: UpdateState): void => {
    const banner = updateBanner(state)
    bar.hidden = !banner
    text.textContent = banner?.text ?? ''
    install.hidden = !banner?.install
    if (!banner?.install) confirm.hidden = true
  }
  let pushed = false
  window.mesa.onUpdateState((state) => {
    pushed = true
    show(state)
  })
  // A window that loads after the updater spoke still shows where it stands.
  void window.mesa.updateState().then((state) => {
    if (!pushed) show(state)
  })
}
