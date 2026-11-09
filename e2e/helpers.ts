import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
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
export async function launch(opts: { ifaces?: string[] } = {}): Promise<AppHandle> {
  const userData = mkdtempSync(pathJoin(tmpdir(), 'mesa-e2e-'))
  const env: Record<string, string> = { ...(process.env as Record<string, string>), MESA_TEST: '1', MESA_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE // set by VS Code terminals; it turns Electron into plain Node
  if (opts.ifaces) env.MESA_TEST_IFACES = JSON.stringify(opts.ifaces)
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
