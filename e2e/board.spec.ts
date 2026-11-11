import { expect, test, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
import type { TokenSnapshot } from '../src/renderer/board/board'
import { act, campaignDir, closeAll, masterAndPlayer, nextOpenDialog, putAsset, putFile, showPanel, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

/** Master and Ana on an 800x600 map with 100 px cells. */
async function table(): Promise<{ master: AppHandle; player: AppHandle; square: string; map: string }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  const square = await putAsset(master.app, solidPng(64, 64, [90, 90, 200]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  return { master, player, square, map }
}
async function item(page: Page, name: string): Promise<TokenSnapshot> {
  await expect.poll(async () => (await snap(page)).tokens.find((t) => t.name === name)?.textured ?? false, { timeout: 10_000 }).toBe(true)
  return (await snap(page)).tokens.find((t) => t.name === name)!
}
const at = async (page: Page, x: number, y: number): Promise<{ x: number; y: number }> => {
  const s = await snap(page)
  return { x: s.canvas.left + x * s.camera.scale + s.camera.x, y: s.canvas.top + y * s.camera.scale + s.camera.y }
}
/** Grabs an item at its centre and lets it go with its centre at (x, y) on the map. */
async function dragItem(page: Page, name: string, x: number, y: number, shift = false): Promise<void> {
  const t = await item(page, name)
  const a = await at(page, t.x, t.y)
  const b = await at(page, x, y)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 6 })
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.up()
  if (shift) await page.keyboard.up('Shift')
}
const centre = async (page: Page, name: string): Promise<number[]> => {
  const t = await item(page, name)
  return [Math.round(t.x * 10) / 10, Math.round(t.y * 10) / 10]
}
const place = (page: Page, hash: string, name: string, width: number, x = 450, y = 450) =>
  act(page, { type: 'token/place', hash, name, kind: 'character', x, y, width, ring: null })
async function setGridVisible(page: Page, on: boolean): Promise<void> {
  await showPanel(page, 'mapas')
  const box = page.getByTestId('grid-visible')
  if (on) await box.check()
  else await box.uncheck()
}
async function saveScene(page: Page, name: string): Promise<void> {
  await showPanel(page, 'mapas')
  await page.getByTestId('save-scene').click()
  await page.getByTestId('scene-name').fill(name)
  await page.getByTestId('scene-name-ok').click()
  await expect(page.getByTestId('scene-item').filter({ hasText: name })).toBeVisible({ timeout: 5000 })
}
const lines = async (page: Page): Promise<number> => (await snap(page)).grid?.lines ?? -1

test('[C1] BRD-01 a dropped character lands centred: on a cell centre for 1, 1.5 and 3 cells, on the lines for 2 cells', async () => {
  const { master, player, square } = await table()
  await place(master.page, square, 'Um', 1, 150, 150)
  await place(master.page, square, 'Meio', 1.5, 450, 150)
  await place(master.page, square, 'Dois', 2, 650, 450)
  await place(master.page, square, 'Tres', 3, 250, 450)
  await dragItem(master.page, 'Um', 330, 170)
  await dragItem(master.page, 'Meio', 530, 170)
  await dragItem(master.page, 'Dois', 630, 370)
  await dragItem(master.page, 'Tres', 230, 380)
  for (const page of [master.page, player.page]) {
    await expect.poll(() => centre(page, 'Um')).toEqual([350, 150])
    await expect.poll(() => centre(page, 'Meio')).toEqual([550, 150]) // not 575/175 (edges on lines)
    await expect.poll(() => centre(page, 'Dois')).toEqual([600, 400]) // on a crossing: fills 4 cells
    await expect.poll(() => centre(page, 'Tres')).toEqual([250, 350])
  }
})

test('[C2] BRD-02 a character dragged from the campaign list lands centred by the same rule', async () => {
  const { master, player } = await table()
  putFile(master, 'tokens/ogro.png', solidPng(64, 64, [200, 30, 30]))
  putFile(master, 'tokens/ogro.json', JSON.stringify({ tamanho: 1.5 }))
  putFile(master, 'tokens/gigante.png', solidPng(64, 64, [30, 30, 200]))
  putFile(master, 'tokens/gigante.json', JSON.stringify({ tamanho: 2 }))
  await showPanel(master.page, 'tokens')
  await expect(master.page.getByTestId('library-item')).toHaveCount(2, { timeout: 5000 })
  const canvas = master.page.getByTestId('board-canvas')
  const s = await snap(master.page)
  const to = (x: number, y: number) => ({ x: x * s.camera.scale + s.camera.x, y: y * s.camera.scale + s.camera.y })
  await master.page.getByTestId('library-item').filter({ hasText: 'ogro' }).dragTo(canvas, { targetPosition: to(130, 170) })
  await master.page.getByTestId('library-item').filter({ hasText: 'gigante' }).dragTo(canvas, { targetPosition: to(430, 370) })
  for (const page of [master.page, player.page]) {
    await expect.poll(() => centre(page, 'ogro')).toEqual([150, 150])
    await expect.poll(() => centre(page, 'gigante')).toEqual([400, 400])
  }
})

test('[C3] BRD-03 "Mostrar grid" off hides the lines in every window, and on draws them again', async () => {
  const { master, player } = await table()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBeGreaterThan(10)
  await setGridVisible(master.page, false)
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(0)
  await expect(master.page.getByTestId('grid-visible')).not.toBeChecked()
  await setGridVisible(master.page, true)
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(16) // 9 + 7 lines on 800 x 600
})

test('[C4] BRD-04 with the grid hidden a dropped character stays where dropped; Shift snaps it to the hidden grid', async () => {
  const { master, player, square } = await table()
  await place(master.page, square, 'Livre', 1, 150, 150)
  await place(master.page, square, 'Preso', 1, 450, 150)
  await setGridVisible(master.page, false)
  await expect.poll(() => lines(master.page)).toBe(0)
  await dragItem(master.page, 'Livre', 333, 377)
  await dragItem(master.page, 'Preso', 533, 377, true)
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await centre(page, 'Livre')).map((v, i) => Math.abs(v - [333, 377][i]) < 1.5)).toEqual([true, true])
    await expect.poll(() => centre(page, 'Preso')).toEqual([550, 350])
  }
})

test('[C5] BRD-05 a scene saved with the grid hidden loads hidden, as .cena and as .mesa', async () => {
  const { master, player } = await table()
  await setGridVisible(master.page, false)
  await saveScene(master.page, 'Cidade')
  await setGridVisible(master.page, true)
  await expect.poll(() => lines(player.page)).toBeGreaterThan(0)
  await master.page.getByTestId('scene-item').filter({ hasText: 'Cidade' }).click()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(0)
  await expect(master.page.getByTestId('grid-visible')).not.toBeChecked()
  // the full file
  const out = pathJoin(campaignDir(master), '..', 'cidade.mesa')
  await master.app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog
  }, out)
  await master.page.getByTestId('export-mesa').click()
  await expect.poll(() => { try { return JSON.parse(readFileSync(out, 'utf8')).scene.grid.visible } catch { return null } }).toBe(false)
  await setGridVisible(master.page, true)
  await expect.poll(() => lines(player.page)).toBeGreaterThan(0)
  await nextOpenDialog(master.app, [out])
  await master.page.getByTestId('import-mesa').click()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(0)
})

test('[C6] BRD-06 a scene saved before this feature, and a new map, show the grid', async () => {
  const { master, player, map } = await table()
  await saveScene(master.page, 'Antiga')
  const file = pathJoin(campaignDir(master), 'cenas', 'Antiga.cena')
  const old = JSON.parse(readFileSync(file, 'utf8'))
  delete old.scene.grid.visible // as 0.8.0 wrote it
  writeFileSync(file, JSON.stringify(old))
  await setGridVisible(master.page, false)
  await expect.poll(() => lines(player.page)).toBe(0)
  await master.page.getByTestId('scene-item').filter({ hasText: 'Antiga' }).click()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBeGreaterThan(0)
  // a new map shows the grid even when it was hidden
  await setGridVisible(master.page, false)
  await expect.poll(() => lines(player.page)).toBe(0)
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBeGreaterThan(0)
  await expect(master.page.getByTestId('grid-visible')).toBeChecked()
})

test('[C7] BRD-07 a player\'s change of the grid visibility is refused with "Sem permissão"', async () => {
  const { master, player } = await table()
  const r = await player.page.evaluate(() => window.__mesaTest!.send({ type: 'grid/set', grid: { visible: false } }))
  expect(r).toEqual({ ok: false, reason: 'Sem permissão' })
  for (const page of [master.page, player.page]) expect(await lines(page)).toBeGreaterThan(0)
  await expect(player.page.getByTestId('grid-visible')).toHaveCount(0) // no switch for a player
})
