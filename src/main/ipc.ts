import { randomBytes } from 'node:crypto'
import { app, clipboard, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { decodeMesa, encodeMesa, sceneHashes } from '../core/mesa-file'
import { parsePalette } from '../core/palette'
import type { HostResult, ImportedImage, ImportTokensResult, PaletteResult, SceneFileResult } from '../preload/api'
import { join } from 'node:path'
import { AssetCache } from './asset-cache'
import { AssetStore, sha256 } from './asset-store'
import { importTokenFolder, readImageFile } from './import'
import { validatePort } from '../core/session-rules'
import { listAddresses } from './netinfo'
import { startTableServer, type TableServer } from './table-server'

let server: TableServer | null = null
/** Lives as long as the app, so re-hosting keeps the imported images. */
const store = new AssetStore()

async function stopHost(): Promise<void> {
  const s = server
  server = null
  exposeForTests()
  await s?.close()
}

function exposeForTests(): void {
  if (process.env.MESA_TEST !== '1') return
  const g = globalThis as { __mesaServer?: TableServer | null; __mesaStore?: AssetStore }
  g.__mesaServer = server
  g.__mesaStore = store
}

export function registerIpc(): void {
  exposeForTests()
  const cache = new AssetCache(join(app.getPath('userData'), 'cache'))
  ipcMain.handle('mesa:cacheGet', (_e, hash: string) => cache.get(String(hash)))
  ipcMain.handle('mesa:cachePut', (_e, hash: string, bytes: Uint8Array) => cache.put(String(hash), new Uint8Array(bytes)))
  ipcMain.on('mesa:isTest', (e) => {
    e.returnValue = process.env.MESA_TEST === '1'
  })
  ipcMain.handle('mesa:host', async (_e, portText: string): Promise<HostResult> => {
    const check = validatePort(String(portText))
    if (!check.ok) return { ok: false, error: check.error }
    await stopHost()
    const hostToken = randomBytes(24).toString('hex')
    try {
      server = await startTableServer({ port: check.port, host: '0.0.0.0', hostToken, store })
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    exposeForTests()
    return { ok: true, port: server.port, hostToken }
  })
  ipcMain.handle('mesa:stopHost', () => stopHost())
  ipcMain.handle('mesa:addresses', () => listAddresses())
  ipcMain.handle('mesa:copy', (_e, text: string) => clipboard.writeText(String(text)))
  ipcMain.handle('mesa:importTokens', async (): Promise<ImportTokensResult> => {
    const pick = await dialog.showOpenDialog({ title: 'Importar pasta de tokens', properties: ['openDirectory'] })
    if (pick.canceled || !pick.filePaths[0]) return { ok: false, canceled: true }
    const { tokens, skipped } = await importTokenFolder(pick.filePaths[0])
    const items = tokens.map((t) => ({ hash: store.put(t.bytes), name: t.name, faction: t.faction, size: t.size }))
    server?.addLibrary(items)
    return { ok: true, count: items.length, skipped }
  })
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
  ipcMain.handle('mesa:saveScene', async (): Promise<SceneFileResult> => {
    if (!server) return { ok: false, error: 'Nenhuma mesa hospedada' }
    const pick = await dialog.showSaveDialog({ title: 'Salvar cena', defaultPath: 'cena.mesa', filters: [{ name: 'Cena', extensions: ['mesa'] }] })
    if (pick.canceled || !pick.filePath) return { ok: false, canceled: true }
    const scene = server.getScene()
    const assets = new Map(sceneHashes(scene).map((h) => [h, store.get(h)!]))
    await writeFile(pick.filePath, encodeMesa(scene, assets))
    return { ok: true }
  })
  ipcMain.handle('mesa:loadScene', async (): Promise<SceneFileResult> => {
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
