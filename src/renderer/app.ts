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

type SessionHook = (s: Session) => void
const hooks: SessionHook[] = []
/** Later features (board, panels) attach to a table session here. */
export function onSession(fn: SessionHook): void {
  hooks.push(fn)
}

let current: { client: TableClient; screen: TableScreen } | null = null

function leave(values?: HomeValues): void {
  current?.screen.destroy()
  current?.client.close()
  current = null
  showHome(values)
}

function enter(root: HTMLElement, client: TableClient, host: Parameters<typeof renderTableScreen>[2]): void {
  const screen = renderTableScreen(root, client, host, () => leave())
  current = { client, screen }
  for (const fn of hooks) fn(current)
}

export function showHome(values: HomeValues = {}): void {
  const root = document.getElementById('app')!
  renderHome(root, {
    host: async (portText) => {
      const res = await window.mesa.host(portText)
      if (!res.ok) return res.error
      const client = new TableClient({ ip: '127.0.0.1', port: res.port, name: 'Mestre', hostToken: res.hostToken })
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
      const client = new TableClient({ ip, port, name })
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
