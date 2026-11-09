import type { MesaApi } from '../preload/api'
import { TableClient } from './net/table-client'
import { renderHome, type HomeValues } from './ui/home'
import { renderTableScreen, type TableScreen } from './ui/table-screen'

declare global {
  interface Window {
    mesa: MesaApi
  }
}

export interface Session {
  client: TableClient
  screen: TableScreen
}

type Cleanup = () => void
type SessionHook = (s: Session) => Cleanup | void | Promise<Cleanup | void>
const hooks: SessionHook[] = []
/** Later features (board, panels) attach to a table session here. */
export function onSession(fn: SessionHook): void {
  hooks.push(fn)
}

let current: { client: TableClient; screen: TableScreen; cleanups: Array<Promise<Cleanup | void>> } | null = null

/** True while this window hosts the table (UPD-07: the master confirms before restarting). */
export function isHosting(): boolean {
  return current?.client.you?.role === 'master'
}

function leave(values?: HomeValues): void {
  const c = current
  current = null
  c?.screen.destroy()
  c?.client.close()
  for (const p of c?.cleanups ?? []) void p.then((fn) => fn?.())
  showHome(values)
}

function enter(root: HTMLElement, client: TableClient, host: Parameters<typeof renderTableScreen>[2]): void {
  const screen = renderTableScreen(root, client, host, () => leave())
  current = { client, screen, cleanups: hooks.map((fn) => Promise.resolve(fn({ client, screen }))) }
}

export function showHome(values: HomeValues = {}): void {
  const root = document.getElementById('app')!
  renderHome(root, {
    version: window.mesa.version,
    host: async (portText) => {
      const res = await window.mesa.host(portText)
      if (!res.ok) return res.error
      const client = new TableClient({ ip: '127.0.0.1', port: res.port, name: 'Mestre', hostToken: res.hostToken, version: window.mesa.version })
      try {
        await client.connect()
      } catch (err) {
        await window.mesa.stopHost()
        return (err as Error).message
      }
      const addresses = await window.mesa.addresses()
      enter(root, client, {
        port: res.port,
        addresses,
        copy: (t) => void window.mesa.copy(t),
        stop: () => {
          void window.mesa.stopHost()
          leave()
        }
      })
      return null
    },
    join: async (ip, port, name) => {
      const client = new TableClient({ ip, port, name, version: window.mesa.version })
      try {
        await client.connect()
      } catch (err) {
        return (err as Error).message
      }
      enter(root, client, null)
      return null
    }
  }, values)
}
