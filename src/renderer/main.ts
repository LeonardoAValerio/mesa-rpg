import './style.css'
import type { Action } from '../core/protocol'
import { onSession, showHome } from './app'
import { TextureStore } from './assets/textures'
import { Board, type BoardSnapshot } from './board/board'
import type { ActionResult } from './net/table-client'
import { gridPanel } from './ui/grid-panel'

declare global {
  interface Window {
    __mesaTest?: {
      board(): BoardSnapshot | null
      send(action: Action): Promise<ActionResult>
    }
  }
}

onSession(async ({ client, screen }) => {
  const textures = new TextureStore()
  const master = client.you?.role === 'master'
  const panel = master ? gridPanel(client, textures) : null
  if (panel) screen.sidebar.append(panel.root)
  const board = await Board.create(screen.board, client, { textures, onImportMap: () => void panel?.importMap() })
  if (window.mesa.isTest) window.__mesaTest = { board: () => board.snapshot(), send: (a) => client.send(a) }
  return () => {
    if (window.__mesaTest) window.__mesaTest = undefined
    panel?.destroy()
    board.destroy()
  }
})

showHome()
