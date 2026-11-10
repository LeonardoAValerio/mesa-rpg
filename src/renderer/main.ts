import './style.css'
import type { Action } from '../core/protocol'
import { isHosting, onSession, showHome } from './app'
import { syncAssets } from './assets/sync'
import { TextureStore } from './assets/textures'
import { Board, type BoardSnapshot } from './board/board'
import { FogTools, type FogToolSnapshot } from './board/fog-tools'
import { Overlays, type OverlaySnapshot } from './board/overlays'
import type { ActionResult } from './net/table-client'
import { gridPanel } from './ui/grid-panel'
import { Layout, type LayoutSnapshot } from './ui/layout'
import { libraryPanel } from './ui/library'
import { logPanel } from './ui/log-panel'
import { sceneMenu } from './ui/scene-menu'
import { tokenEditor } from './ui/token-editor'
import { toolbar } from './ui/toolbar'
import { mountUpdateBar } from './ui/update-bar'

declare global {
  interface Window {
    __mesaTest?: {
      layout(): LayoutSnapshot
      board(): BoardSnapshot | null
      fogSample(points: Array<[number, number]>): boolean[]
      fogTool(): FogToolSnapshot | null
      overlays(): OverlaySnapshot
      send(action: Action): Promise<ActionResult>
    }
  }
}

onSession(async ({ client, screen }) => {
  const textures = new TextureStore()
  const master = client.you?.role === 'master'
  if (master) screen.panels.mapas.append(sceneMenu(client, screen.root).root)
  const panel = master ? gridPanel(client, textures) : null
  if (panel) screen.panels.mapas.append(panel.root)
  const editor = master ? tokenEditor(client) : null
  const layout = new Layout(screen.dock, master ? 'master' : 'player', screen.board, screen.panels)
  const board = await Board.create(screen.board, client, {
    textures,
    onImportMap: () => void panel?.importMap(),
    onSelect: (id) => editor?.select(id)
  })
  const stopSync = syncAssets(client, textures, screen.board)
  const overlays = new Overlays(board, client)
  const stopToolbar = toolbar(screen.toolbar, board, master ? [{ tool: 'fog-brush', label: 'Pincel de névoa' }, { tool: 'fog-rect', label: 'Retângulo de névoa' }, { tool: 'fog-poly', label: 'Polígono de névoa' }] : [])
  const fog = master ? new FogTools(board, client, screen.toolbar) : null
  if (fog) screen.panels.mapas.append(fog.panel)
  const log = logPanel(client)
  screen.panels.dados.append(log.root)
  const library = master ? libraryPanel(client, board, screen.board) : null
  if (library) screen.panels.tokens.append(library.root)
  if (editor) screen.panels.tokens.append(editor.root)
  if (window.mesa.isTest) window.__mesaTest = { layout: () => layout.snapshot(), board: () => board.snapshot(), fogSample: (p) => board.fogSample(p), fogTool: () => fog?.snapshot() ?? null, overlays: () => overlays.snapshot(), send: (a) => client.send(a) }
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
    layout.dispose()
  }
})

mountUpdateBar(document.body, { isHosting, install: () => void window.mesa.installUpdate() })
showHome()
