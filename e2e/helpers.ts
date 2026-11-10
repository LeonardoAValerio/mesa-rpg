import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { PNG } from 'pngjs'
import { tmpdir } from 'node:os'
import { join as pathJoin } from 'node:path'
import type { Action } from '../src/core/protocol'
import type { BoardSnapshot } from '../src/renderer/board/board'

export interface AppHandle {
  app: ElectronApplication
  page: Page
  userData: string
}

const open: AppHandle[] = []

/** Starts one app instance with its own profile, as a second PC would have. */
export async function launch(opts: { ifaces?: string[]; version?: string; unpackaged?: boolean; userData?: string; campaign?: false } = {}): Promise<AppHandle> {
  const fresh = !opts.userData
  const userData = opts.userData ?? mkdtempSync(pathJoin(tmpdir(), 'mesa-e2e-')) // the same profile again: what it saved comes back
  const documents = pathJoin(userData, 'Documentos') // AD-009: this test's own Documentos/Mesa RPG
  if (fresh && opts.campaign !== false) {
    // a campaign "Teste", marked as the last one used, so "Hospedar" works as before (CAMP-06)
    mkdirSync(pathJoin(documents, 'Mesa RPG', 'Teste'), { recursive: true })
    writeFileSync(pathJoin(userData, 'settings.json'), JSON.stringify({ lastCampaign: 'Teste' }))
  }
  const env: Record<string, string> = { ...(process.env as Record<string, string>), MESA_TEST: '1', MESA_USER_DATA: userData, MESA_DOCUMENTS: documents }
  delete env.ELECTRON_RUN_AS_NODE // set by VS Code terminals; it turns Electron into plain Node
  if (opts.ifaces) env.MESA_TEST_IFACES = JSON.stringify(opts.ifaces)
  if (opts.version) env.MESA_VERSION = opts.version // runs this instance as another app version
  else delete env.MESA_VERSION
  if (opts.unpackaged) env.MESA_TEST_UNPACKAGED = '1' // the fake updater gets Electron's own isPackaged, as in `npm run dev`
  else delete env.MESA_TEST_UNPACKAGED
  const app = await electron.launch({ args: [pathJoin(__dirname, '..')], env })
  const page = await app.firstWindow()
  await page.waitForSelector('[data-testid=host]')
  const handle = { app, page, userData }
  open.push(handle)
  return handle
}

export async function closeAll(): Promise<void> {
  for (const h of open.splice(0)) {
    await h.app.close().catch(() => {})
    rmSync(h.userData, { recursive: true, force: true }) // each profile is tens of MB; never leave them in /tmp
  }
}

export async function freePort(): Promise<number> {
  const s = createServer()
  await new Promise<void>((r) => s.listen(0, '0.0.0.0', () => r()))
  const port = (s.address() as { port: number }).port
  await new Promise<void>((r) => s.close(() => r()))
  return port
}

export async function host(page: Page, port: number): Promise<void> {
  await page.getByTestId('host-port').fill(String(port))
  await page.getByTestId('host').click()
  await expect(page.getByTestId('table')).toBeVisible()
}

export async function join(page: Page, port: number, name: string): Promise<void> {
  await page.getByTestId('join-ip').fill('127.0.0.1')
  await page.getByTestId('join-port').fill(String(port))
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join').click()
  await expect(page.getByTestId('table')).toBeVisible()
}

/** Master and one player ("Ana") on a free port. */
export async function masterAndPlayer(name = 'Ana'): Promise<{ master: AppHandle; player: AppHandle; port: number }> {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  const player = await launch()
  await join(player.page, port, name)
  return { master, player, port }
}

export async function snap(page: Page): Promise<BoardSnapshot> {
  return page.evaluate(() => window.__mesaTest!.board()!)
}
export async function act(page: Page, action: Action): Promise<void> {
  const r = await page.evaluate((a) => window.__mesaTest!.send(a), action)
  expect(r, JSON.stringify(action)).toEqual({ ok: true })
}
/** The folder of the test's "Teste" campaign (AD-009). */
export function campaignDir(app: AppHandle): string {
  return pathJoin(app.userData, 'Documentos', 'Mesa RPG', 'Teste')
}
/** Writes a file into the campaign, as the master would with the file manager. */
export function putFile(app: AppHandle, rel: string, data: Buffer | string): void {
  const p = pathJoin(campaignDir(app), ...rel.split('/'))
  mkdirSync(pathJoin(p, '..'), { recursive: true })
  writeFileSync(p, data)
}
/** Picks a map tool from the tool column; a fog shape opens the Névoa panel first (MTB-08). */
export async function pickTool(page: Page, tool: string): Promise<void> {
  if (tool.startsWith('fog-')) await openFog(page)
  await page.getByTestId(`tool-${tool}`).click()
}
/** Opens the Névoa panel if it is closed (it closes when the map is pressed). */
export async function openFog(page: Page): Promise<void> {
  if (!(await page.getByTestId('fog-flyout').isVisible())) await page.getByTestId('tool-fog').click()
  await expect(page.getByTestId('fog-flyout')).toBeVisible()
}
/** Brings a docked panel to the front by clicking its tab (PANEL-03). */
export async function showPanel(page: Page, id: 'conectados' | 'rede' | 'tokens' | 'mapas' | 'dados' | 'chat'): Promise<void> {
  await page.getByTestId(`tab-${id}`).click()
  await expect(page.getByTestId(`panel-${id}`)).toBeVisible()
}
/** Whether the fog drawn in this window hides each map point (read from the fog texture). */
export async function fogSample(page: Page, points: Array<[number, number]>): Promise<boolean[]> {
  return page.evaluate((p) => window.__mesaTest!.fogSample(p), points)
}
/** How many cell centres the drawn fog hides, on a `cols` x `rows` grid of `cell` px from (0, 0). */
export async function coveredCenters(page: Page, cols = 8, rows = 6, cell = 100): Promise<number> {
  const points: Array<[number, number]> = []
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) points.push([c * cell + cell / 2, r * cell + cell / 2])
  return (await fogSample(page, points)).filter(Boolean).length
}
/** Page coordinates of a map pixel in this window. */
export async function screenOf(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const s = await snap(page)
  return { x: s.canvas.left + x * s.camera.scale + s.camera.x, y: s.canvas.top + y * s.camera.scale + s.camera.y }
}

/** Makes the next native "open" dialog of this app return `paths` (or cancel when empty). */
export async function nextOpenDialog(app: AppHandle['app'], paths: string[]): Promise<void> {
  await app.evaluate(({ dialog }, filePaths) => {
    dialog.showOpenDialog = (async () => ({ canceled: filePaths.length === 0, filePaths })) as typeof dialog.showOpenDialog
  }, paths)
}

/** A tiny valid PNG of w x h pixels in one colour. */
export function solidPng(w = 4, h = 4, rgb: [number, number, number] = [200, 60, 60]): Buffer {
  const p = new PNG({ width: w, height: h })
  for (let i = 0; i < w * h; i++) p.data.set([...rgb, 255], i * 4)
  return PNG.sync.write(p)
}

/** Puts an image in the hosting app's asset store, as an import would, and returns its hash. */
export async function putAsset(app: AppHandle['app'], bytes: Buffer = solidPng()): Promise<string> {
  return app.evaluate((_e, b64) => {
    const store = (globalThis as unknown as { __mesaStore: { put(b: Uint8Array): string } }).__mesaStore
    return store.put(new Uint8Array(Buffer.from(b64, 'base64')))
  }, bytes.toString('base64'))
}

/** Makes the next native "save" dialog of this app return `path`. */
export async function nextSaveDialog(app: AppHandle['app'], path: string): Promise<void> {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath })) as typeof dialog.showSaveDialog
  }, path)
}
