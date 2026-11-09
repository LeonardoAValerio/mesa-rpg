import { DEFAULT_PORT, validatePort } from '../../core/session-rules'
import { h } from './dom'

export interface HomeHandlers {
  host(portText: string): Promise<string | null> // error message or null
  join(ip: string, port: number, name: string): Promise<string | null>
}

export interface HomeValues {
  hostPort?: string
  ip?: string
  joinPort?: string
  name?: string
  error?: string
}

/** NET-01: the start screen with "Hospedar" and "Entrar". Fields keep their values on error (NET-08). */
export function renderHome(root: HTMLElement, handlers: HomeHandlers, values: HomeValues = {}): void {
  const error = h('p', { class: 'error', testid: 'home-error', role: 'alert' }, values.error ?? '')
  const hostPort = h('input', { testid: 'host-port', value: values.hostPort ?? String(DEFAULT_PORT), inputmode: 'numeric' })
  const ip = h('input', { testid: 'join-ip', value: values.ip ?? '', placeholder: '25.x.x.x' })
  const joinPort = h('input', { testid: 'join-port', value: values.joinPort ?? String(DEFAULT_PORT), inputmode: 'numeric' })
  const name = h('input', { testid: 'join-name', value: values.name ?? '', maxlength: 24 })

  const busy = (on: boolean): void => {
    for (const b of root.querySelectorAll('button')) b.disabled = on
  }

  const hostBtn = h('button', {
    testid: 'host',
    onclick: async () => {
      error.textContent = ''
      busy(true)
      const err = await handlers.host(hostPort.value)
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
      error
    )
  )
}
