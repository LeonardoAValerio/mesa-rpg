import './style.css'
import type { Action } from '../core/protocol'
import { onSession, showHome } from './app'
import { syncAssets } from './assets/sync'
import { TextureStore } from './assets/textures'
import { Board, type BoardSnapshot } from './board/board'
import { fogTools } from './board/fog-layer'
import { Overlays, type OverlaySnapshot } from './board/overlays'
import type { ActionResult } from './net/table-client'
import { gridPanel } from './ui/grid-panel'
import { libraryPanel } from './ui/library'
import { logPanel } from './ui/log-panel'
import { tokenEditor } from './ui/token-editor'
import { toolbar } from './ui/toolbar'

declare global {
  interface Window {
    __mesaTest?: {
      board(): BoardSnapshot | null
      overlays(): OverlaySnapshot
      send(action: Action): Promise<ActionResult>
    }
  }
}

onSession(async ({ client, screen }) => {
  const textures = new TextureStore()
  const master = client.you?.role === 'master'
  const panel = master ? gridPanel(client, textures) : null
  if (panel) screen.sidebar.append(panel.root)
  const editor = master ? tokenEditor(client) : null
  if (editor) screen.sidebar.append(editor.root)
  const board = await Board.create(screen.board, client, {
    textures,
    onImportMap: () => void panel?.importMap(),
    onSelect: (id) => editor?.select(id)
  })
  const stopSync = syncAssets(client, textures, screen.board)
  const overlays = new Overlays(board, client)
  const stopToolbar = toolbar(screen.toolbar, board, master ? [{ tool: 'fog-brush', label: 'Pincel de névoa' }, { tool: 'fog-rect', label: 'Retângulo de névoa' }] : [])
  const fog = master ? fogTools(board, client) : null
  if (fog) screen.sidebar.append(fog.root)
  const log = logPanel(client)
  screen.sidebar.append(log.root)
  const library = master ? libraryPanel(client, board, screen.board) : null
  if (library) screen.sidebar.append(library.root)
  if (window.mesa.isTest) window.__mesaTest = { board: () => board.snapshot(), overlays: () => overlays.snapshot(), send: (a) => client.send(a) }
  return () => {
    if (window.__mesaTest) window.__mesaTest = undefined
    stopSync()
    stopToolbar()
    overlays.destroy()
    fog?.destroy()
    log.destroy()
    library?.destroy()
    editor?.destroy()
    panel?.destroy()
    board.destroy()
  }
})

showHome()
