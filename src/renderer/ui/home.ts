import { DEFAULT_PORT, validatePort } from '../../core/session-rules'
import { h } from './dom'

export interface HomeHandlers {
  /** UPD-14: shown as "Versão <versão>" at the foot of the start screen. */
  version: string
  /** CAMP-01, CAMP-06: the campaigns in Documentos/Mesa RPG and the last one used. */
  campaigns(): Promise<{ list: string[]; last: string | null }>
  /** CAMP-02, CAMP-03: null when created, or the message. */
  createCampaign(name: string): Promise<string | null>
  host(portText: string, campaign: string): Promise<string | null> // error message or null
  join(ip: string, port: number, name: string): Promise<string | null>
}

export interface HomeValues {
  hostPort?: string
  ip?: string
  joinPort?: string
  name?: string
  campaign?: string
  error?: string
}

/** NET-01: the start screen with "Hospedar" and "Entrar". Fields keep their values on error (NET-08). */
export function renderHome(root: HTMLElement, handlers: HomeHandlers, values: HomeValues = {}): void {
  const error = h('p', { class: 'error', testid: 'home-error', role: 'alert' }, values.error ?? '')
  const hostPort = h('input', { testid: 'host-port', value: values.hostPort ?? String(DEFAULT_PORT), inputmode: 'numeric' })
  const ip = h('input', { testid: 'join-ip', value: values.ip ?? '', placeholder: '25.x.x.x' })
  const joinPort = h('input', { testid: 'join-port', value: values.joinPort ?? String(DEFAULT_PORT), inputmode: 'numeric' })
  const name = h('input', { testid: 'join-name', value: values.name ?? '' })

  // CAMP-01..06: the campaign list in the host box; "Hospedar" needs one
  let campaign: string | null = values.campaign ?? null
  const list = h('div', { class: 'campaigns', testid: 'campaigns', role: 'radiogroup' })
  const newName = h('input', { testid: 'new-campaign-name', placeholder: 'Nome da campanha', maxlength: 60 })
  const drawList = (names: string[]): void => {
    if (!names.length) {
      list.replaceChildren(h('p', { class: 'hint', testid: 'no-campaigns' }, 'Nenhuma campanha ainda'))
      return
    }
    list.replaceChildren(...names.map((n) => {
      const radio = h('input', { type: 'radio', name: 'campaign', value: n })
      radio.checked = n === campaign
      radio.addEventListener('change', () => {
        campaign = n
        sync()
      })
      return h('label', { class: 'campaign', testid: `campaign-${n}` }, radio, h('span', {}, n))
    }))
  }
  const refresh = async (select?: string): Promise<void> => {
    const r = await handlers.campaigns()
    if (select) campaign = select
    else if (!campaign || !r.list.includes(campaign)) campaign = r.last
    drawList(r.list)
    sync()
  }
  const createBtn = h('button', {
    testid: 'new-campaign',
    class: 'secondary',
    onclick: async () => {
      error.textContent = ''
      const name = newName.value
      const err = await handlers.createCampaign(name)
      if (err) {
        error.textContent = err
        return
      }
      newName.value = ''
      await refresh(name)
    }
  }, 'Nova campanha')

  const busy = (on: boolean): void => {
    for (const b of root.querySelectorAll('button')) b.disabled = on
    if (!on) sync()
  }
  const sync = (): void => {
    hostBtn.disabled = !campaign // CAMP-04
  }

  const hostBtn = h('button', {
    testid: 'host',
    onclick: async () => {
      error.textContent = ''
      if (!campaign) return
      busy(true)
      const err = await handlers.host(hostPort.value, campaign)
      busy(false)
      if (err) error.textContent = err
    }
  }, 'Hospedar')

  const joinBtn = h('button', {
    testid: 'join',
    onclick: async () => {
      error.textContent = ''
      const port = validatePort(joinPort.value)
      if (!port.ok) {
        error.textContent = port.error
        return
      }
      busy(true)
      const err = await handlers.join(ip.value.trim(), port.port, name.value)
      busy(false)
      if (err) error.textContent = err
    }
  }, 'Entrar')

  root.replaceChildren(
    h('div', { class: 'home' },
      h('h1', {}, 'Mesa RPG'),
      h('section', { class: 'card' },
        h('h2', {}, 'Hospedar'),
        h('h3', {}, 'Campanha'),
        list,
        h('div', { class: 'row' }, newName, createBtn),
        h('label', {}, 'Porta', hostPort),
        hostBtn
      ),
      h('section', { class: 'card' },
        h('h2', {}, 'Entrar'),
        h('label', {}, 'IP do mestre', ip),
        h('label', {}, 'Porta', joinPort),
        h('label', {}, 'Seu nome', name),
        joinBtn
      ),
      error,
      h('p', { class: 'app-version', testid: 'app-version' }, `Versão ${handlers.version}`)
    )
  )
  sync()
  void refresh()
}
