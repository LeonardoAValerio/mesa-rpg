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
import { panelsMenu } from './ui/panels-menu'
import { libraryPanel } from './ui/library'
import { chatPanel, dicePanel } from './ui/log-panel'
import { sceneMenu } from './ui/scene-menu'
import { tokenEditor } from './ui/token-editor'
import { campaignHeader } from './ui/campaign-header'
import { campaignSection } from './ui/campaign-lists'
import { mapToolbar } from './ui/map-toolbar'
import { groupBar } from './ui/group-bar'
import { mountUpdateBar } from './ui/update-bar'
import { masterSoundControls, personalControls } from './ui/sound-panel'
import { SoundEngine, type SoundSnapshot } from './sound/engine'
import { AssetLoader, webSha256 } from './net/asset-loader'

declare global {
  interface Window {
    __mesaTest?: {
      layout(): LayoutSnapshot
      board(): BoardSnapshot | null
      fogSample(points: Array<[number, number]>): boolean[]
      fogTool(): FogToolSnapshot | null
      mapTools(): { flyout: boolean; fogIcon: string | null }
      overlays(): OverlaySnapshot
      send(action: Action): Promise<ActionResult>
      sound(): SoundSnapshot
    }
  }
}

onSession(async ({ client, screen }) => {
  const textures = new TextureStore()
  const master = client.you?.role === 'master'
  if (master) screen.panels.mapas.append(campaignHeader().root)
  const scenesMenu = master ? sceneMenu(client, screen.root) : null
  if (scenesMenu) screen.panels.mapas.append(scenesMenu.root)
  const panel = master ? gridPanel(client, textures) : null
  if (panel) screen.panels.mapas.append(panel.root)
  const editor = master ? tokenEditor(client) : null
  const layout = new Layout(screen.dock, master ? 'master' : 'player', screen.board, screen.panels)
  const menu = panelsMenu(layout)
  screen.actions.append(menu.root)
  const board = await Board.create(screen.board, client, {
    textures,
    onImportMap: () => void panel?.importMap(),
    onSelect: (id) => {
      editor?.select(id)
      layout.selected(id)
    }
  })
  const stopSync = syncAssets(client, textures, screen.board)
  // SOM-06..18: the table's sounds, files fetched from the master like images (hash checked, cached)
  const audioFiles = new AssetLoader({
    baseUrl: client.httpBase,
    fetch: (...a) => fetch(...a),
    cache: { get: (hash) => window.mesa.cacheGet(hash), put: (hash, bytes) => window.mesa.cachePut(hash, bytes) },
    sha256: webSha256
  })
  const sound = new SoundEngine({
    ctx: new AudioContext(),
    load: (hash) => audioFiles.ensure([hash]).then((got) => got.get(hash) ?? null),
    serverNow: () => client.serverNow()
  })
  const offSound = [
    client.on('view', (v) => sound.setLayers(v.sound.layers)),
    client.on('effect', (e) => void sound.playEffect(e.hash, e.at)),
    client.on('effects', (hs) => sound.preload(hs)),
    client.on('status', (s) => s.kind !== 'connected' && sound.stopAll()) // SOM-15; the next welcome brings the layers back
  ]
  if (client.view) sound.setLayers(client.view.sound.layers)
  sound.preload(client.effects)
  screen.panels.sons.append(personalControls((p) => sound.setPersonal(p)))
  const soundControls = master ? masterSoundControls(client) : null // SOM-19: a player has no play controls
  if (soundControls) screen.panels.sons.append(soundControls.root)
  const overlays = new Overlays(board, client)
  const groups = groupBar(screen.board, board, client) // BRD-15..19
  const fog = master ? new FogTools(board, client) : null
  const tools = mapToolbar(screen.board, board, fog?.modes ?? null)
  if (fog) screen.panels.mapas.append(fog.panel)
  const dice = dicePanel(client, (id) => layout.arrived(id))
  screen.panels.dados.append(dice.root)
  const chat = chatPanel(client, (id) => layout.arrived(id))
  screen.panels.chat.append(chat.root)
  const library = master ? libraryPanel(client, board, screen.board) : null
  // CAMP-08..14: the campaign's tokens, objects and maps, kept up to date as the folder changes
  const sections = master
    ? [campaignSection('tokens'), campaignSection('objetos'), campaignSection('mapas', (e) => void panel?.loadMap(e.hash, e.w, e.h))]
    : []
  if (master) {
    screen.panels.tokens.append(sections[0].root, sections[1].root)
    screen.panels.mapas.insertBefore(sections[2].root, screen.panels.mapas.children[1] ?? null)
  }
  const drawCampaign = (info: Parameters<(typeof sections)[number]['draw']>[0]): void => {
    sections.forEach((sec) => sec.draw(info))
    soundControls?.draw(info)
  }
  if (master) void window.mesa.campaign().then(drawCampaign)
  const offCampaign = master ? window.mesa.onCampaign(drawCampaign) : () => {}
  if (library) screen.panels.tokens.append(library.root)
  if (editor) screen.panels.tokens.append(editor.root)
  if (window.mesa.isTest) window.__mesaTest = { layout: () => layout.snapshot(), board: () => board.snapshot(), fogSample: (p) => board.fogSample(p), fogTool: () => fog?.snapshot() ?? null, mapTools: () => tools.snapshot(), overlays: () => overlays.snapshot(), send: (a) => client.send(a), sound: () => sound.snapshot() }
  return () => {
    if (window.__mesaTest) window.__mesaTest = undefined
    stopSync()
    for (const off of offSound) off()
    sound.close()
    soundControls?.destroy()
    tools.destroy()
    overlays.destroy()
    groups.destroy()
    fog?.destroy()
    dice.destroy()
    chat.destroy()
    library?.destroy()
    offCampaign()
    scenesMenu?.destroy()
    editor?.destroy()
    panel?.destroy()
    board.destroy()
    menu.destroy()
    layout.dispose()
  }
})

mountUpdateBar(document.body, { isHosting, install: () => void window.mesa.installUpdate() })
showHome()
