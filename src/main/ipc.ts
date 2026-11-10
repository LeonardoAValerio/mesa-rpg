import { randomBytes } from 'node:crypto'
import { app, clipboard, dialog, ipcMain, shell, type WebContents } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { decodeMesa, encodeMesa, sceneHashes } from '../core/mesa-file'
import { parsePalette } from '../core/palette'
import type { CampaignInfo, CampaignsResult, HostResult, ImportedImage, PaletteResult, SceneFileResult } from '../preload/api'
import { join } from 'node:path'
import { AssetCache } from './asset-cache'
import { AssetStore, sha256 } from './asset-store'
import { CampaignFolder, type Section, type SoundSection } from './campaign'
import { readImageFile } from './import'
import { CampaignScenes, type SaveResult } from './scenes'
import { readSettings, writeSettings } from './settings'
import { validatePort } from '../core/session-rules'
import { listAddresses } from './netinfo'
import { startTableServer, type TableServer } from './table-server'

let server: TableServer | null = null
/** Lives as long as the app, so re-hosting keeps the imported images. */
const store = new AssetStore()
let folder: CampaignFolder | null = null
let scenes: CampaignScenes | null = null
let watcherOff: (() => void) | null = null

/** AD-009: `Documentos/Mesa RPG`; tests point `MESA_DOCUMENTS` at their own folder. */
function campaignRoot(): string {
  const docs = process.env.MESA_TEST === '1' && process.env.MESA_DOCUMENTS ? process.env.MESA_DOCUMENTS : app.getPath('documents')
  return join(docs, 'Mesa RPG')
}
const settingsFile = (): string => join(app.getPath('userData'), 'settings.json')

async function campaignInfo(): Promise<CampaignInfo | null> {
  if (!folder?.name || !scenes) return null
  return { name: folder.name, entries: folder.all, sounds: folder.sounds, scenes: await scenes.list() }
}

/** Ends the hosted table; players see "O mestre encerrou a mesa" (NET-13). */
export async function stopHost(): Promise<void> {
  const s = server
  server = null
  watcherOff?.()
  watcherOff = null
  folder?.close()
  exposeForTests()
  await s?.close()
}

function exposeForTests(): void {
  if (process.env.MESA_TEST !== '1') return
  const g = globalThis as { __mesaServer?: TableServer | null; __mesaStore?: AssetStore }
  g.__mesaServer = server
  g.__mesaStore = store
}

export function registerIpc(version: string): void {
  exposeForTests()
  const cache = new AssetCache(join(app.getPath('userData'), 'cache'))
  ipcMain.handle('mesa:cacheGet', (_e, hash: string) => cache.get(String(hash)))
  ipcMain.handle('mesa:cachePut', (_e, hash: string, bytes: Uint8Array) => cache.put(String(hash), new Uint8Array(bytes)))
  ipcMain.on('mesa:isTest', (e) => {
    e.returnValue = process.env.MESA_TEST === '1'
  })
  ipcMain.on('mesa:version', (e) => {
    e.returnValue = version
  })
  folder = new CampaignFolder(campaignRoot(), store)
  scenes = new CampaignScenes(folder, store)
  /** CAMP-01, CAMP-06: the campaigns, and the last one used if it still exists. */
  ipcMain.handle('mesa:campaigns', async (): Promise<CampaignsResult> => {
    const list = await folder!.list()
    const last = (await readSettings(settingsFile())).lastCampaign
    return { list, last: last && list.includes(last) ? last : null }
  })
  ipcMain.handle('mesa:createCampaign', (_e, name: string) => folder!.create(String(name)))
  ipcMain.handle('mesa:campaign', () => campaignInfo())
  ipcMain.handle('mesa:host', async (e, portText: string, campaign: string): Promise<HostResult> => {
    const check = validatePort(String(portText))
    if (!check.ok) return { ok: false, error: check.error }
    if (!(await folder!.list()).includes(String(campaign))) return { ok: false, error: 'Escolha uma campanha' } // CAMP-04
    await stopHost()
    const hostToken = randomBytes(24).toString('hex')
    try {
      server = await startTableServer({ port: check.port, host: '0.0.0.0', hostToken, store, version })
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    // CAMP-05: the campaign opens (missing folders created), is remembered, and its changes reach this window
    await folder!.open(String(campaign))
    await writeSettings(settingsFile(), { lastCampaign: String(campaign) })
    const sender: WebContents = e.sender
    const effectsOf = (): string[] => folder!.sounds.filter((s) => s.section === 'efeitos').map((s) => s.hash)
    server.setEffects(effectsOf()) // SOM-17
    watcherOff = folder!.onChange(() => {
      server?.setEffects(effectsOf())
      void campaignInfo().then((info) => !sender.isDestroyed() && sender.send('mesa:campaign', info))
    })
    exposeForTests()
    return { ok: true, port: server.port, hostToken }
  })
  /** CAMP-07 */
  ipcMain.handle('mesa:openFolder', async (): Promise<void> => {
    const dir = folder?.dir()
    if (!dir) return
    if (process.env.MESA_TEST === '1') (globalThis as { __mesaOpened?: string }).__mesaOpened = dir
    else await shell.openPath(dir)
  })
  /** CAMP-14 */
  ipcMain.handle('mesa:addFiles', async (_e, section: Section | SoundSection): Promise<{ ok: true; added: string[] } | { ok: false; canceled: true }> => {
    const filter = section === 'musicas' || section === 'efeitos' ? { name: 'Áudio', extensions: ['mp3', 'ogg', 'wav', 'm4a'] } : { name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] } // SOM-04
    const pick = await dialog.showOpenDialog({ title: 'Adicionar arquivos', properties: ['openFile', 'multiSelections'], filters: [filter] })
    if (pick.canceled || !pick.filePaths.length) return { ok: false, canceled: true }
    return { ok: true, added: await folder!.addFiles(section, pick.filePaths) }
  })
  /** The bytes of an image in the store (a campaign map, for grid detection and the master's own texture). */
  ipcMain.handle('mesa:assetBytes', (_e, hash: string) => store.get(String(hash)))
  /** CAMP-16, CAMP-17, CAMP-22 */
  ipcMain.handle('mesa:saveCena', async (_e, name: string, replace: boolean): Promise<SaveResult> => {
    if (!server) return { ok: false, error: 'Nenhuma mesa hospedada' }
    return scenes!.save(String(name), server.getScene(), !!replace)
  })
  /** CAMP-18..20 */
  ipcMain.handle('mesa:loadCena', async (_e, name: string): Promise<SceneFileResult> => {
    if (!server) return { ok: false, error: 'Nenhuma mesa hospedada' }
    const r = await scenes!.load(String(name))
    if (!r.ok) return r
    server.setScene(r.scene)
    return { ok: true }
  })
  ipcMain.handle('mesa:stopHost', () => stopHost())
  ipcMain.handle('mesa:addresses', () => listAddresses())
  ipcMain.handle('mesa:copy', (_e, text: string) => clipboard.writeText(String(text)))
  ipcMain.handle('mesa:loadPalette', async (): Promise<PaletteResult> => {
    const pick = await dialog.showOpenDialog({
      title: 'Carregar paleta',
      properties: ['openFile'],
      filters: [{ name: 'Paleta', extensions: ['json'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true }
    const text = await readFile(pick.filePaths[0], 'utf8').catch(() => null)
    return { ok: true, palette: parsePalette(text) }
  })
  ipcMain.handle('mesa:exportMesa', async (): Promise<SceneFileResult> => {
    if (!server) return { ok: false, error: 'Nenhuma mesa hospedada' }
    const pick = await dialog.showSaveDialog({ title: 'Salvar cena', defaultPath: 'cena.mesa', filters: [{ name: 'Cena', extensions: ['mesa'] }] })
    if (pick.canceled || !pick.filePath) return { ok: false, canceled: true }
    const scene = server.getScene()
    const assets = new Map(sceneHashes(scene).map((h) => [h, store.get(h)!]))
    await writeFile(pick.filePath, encodeMesa(scene, assets))
    return { ok: true }
  })
  ipcMain.handle('mesa:importMesa', async (): Promise<SceneFileResult> => {
    if (!server) return { ok: false, error: 'Nenhuma mesa hospedada' }
    const pick = await dialog.showOpenDialog({ title: 'Carregar cena', properties: ['openFile'], filters: [{ name: 'Cena', extensions: ['mesa'] }] })
    if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true }
    const text = await readFile(pick.filePaths[0], 'utf8').catch(() => '')
    const file = decodeMesa(text, sha256)
    if ('error' in file) return { ok: false, error: file.error } // SAVE-04: the scene stays as it is
    for (const bytes of file.assets.values()) store.put(bytes)
    server.setScene(file.scene)
    return { ok: true }
  })
  ipcMain.handle('mesa:importMap', async (): Promise<ImportedImage> => {
    const pick = await dialog.showOpenDialog({
      title: 'Importar mapa',
      properties: ['openFile'],
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
    })
    if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true }
    const img = await readImageFile(pick.filePaths[0])
    if (!img.ok) return img
    if (folder?.name) await folder.addFiles('mapas', [pick.filePaths[0]]) // AD-009: an imported map joins the campaign
    const hash = store.put(img.bytes)
    return { ok: true, hash, width: img.info.width, height: img.info.height, bytes: img.bytes }
  })

  // NET-13: closing the app tells every player before the server goes away.
  app.on('before-quit', (e) => {
    if (!server) return
    e.preventDefault()
    void stopHost().finally(() => app.quit())
  })
}
