import { expect, test } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { textFile } from './fixtures'
import { act, closeAll, freePort, host, join as joinTable, launch, masterAndPlayer, nextOpenDialog, nextSaveDialog, putAsset, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

const dir = mkdtempSync(join(tmpdir(), 'mesa-scenes-'))

/** Map 800x600 (100 px), Guerreira (Ana's) at (1,1), hidden Ogro at (5,4), top-left 3x2 cells revealed. */
async function build(master: AppHandle): Promise<void> {
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  const tok = await putAsset(master.app, solidPng(16, 16, [10, 10, 200]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  await act(master.page, { type: 'fog/rect', x0: 0, y0: 0, x1: 299, y1: 199, mode: 'reveal' })
  await act(master.page, { type: 'token/place', hash: tok, name: 'Guerreira', faction: 'grupo', size: 1, col: 1, row: 1 })
  await act(master.page, { type: 'token/place', hash: tok, name: 'Ogro', faction: 'inimigo', size: 2, col: 5, row: 4 })
  const s = await snap(master.page)
  await act(master.page, { type: 'token/owner', id: s.tokens.find((t) => t.name === 'Guerreira')!.id, owner: 'Ana' })
  await act(master.page, { type: 'token/hide', id: s.tokens.find((t) => t.name === 'Ogro')!.id })
}
const summary = async (m: AppHandle): Promise<unknown> => {
  const s = await snap(m.page)
  return {
    map: s.map && { width: s.map.width, height: s.map.height },
    fog: s.fog,
    tokens: s.tokens.map((t) => ({ name: t.name, x: t.x, y: t.y, w: t.w, owner: t.owner, hidden: t.hidden })).sort((a, b) => a.name.localeCompare(b.name))
  }
}

test('[C73] SAVE-02 loading a .mesa shows the loaded scene in both windows', async () => {
  const file = join(dir, 'sessao1.mesa')
  const first = await launch()
  await host(first.page, await freePort())
  await build(first)
  const saved = await summary(first)
  await nextSaveDialog(first.app, file)
  await first.page.getByTestId('save-scene').click()
  await expect(first.page.getByTestId('scene-message')).toHaveText('')
  await first.app.close()

  // another day: a new table, a player joins, the master loads the file
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  const player = await launch()
  await joinTable(player.page, port, 'Ana')
  await nextOpenDialog(master.app, [file])
  await master.page.getByTestId('load-scene').click()
  await expect.poll(() => summary(master)).toEqual(saved)
  expect(saved).toMatchObject({ map: { width: 800, height: 600 }, fog: { covered: 42, alpha: 0.5 } })
  // the player sees the same scene through the fog: their own Guerreira, not the hidden Ogro
  await expect.poll(async () => (await snap(player.page)).tokens.map((t) => t.name)).toEqual(['Guerreira'])
  expect((await snap(player.page)).fog).toEqual({ covered: 42, alpha: 1 })
  await expect.poll(async () => (await snap(player.page)).map?.textured, { timeout: 10000 }).toBe(true)
})

test('[C76] SAVE-05 loading with tokens on the table asks "Substituir a cena atual?" and cancelling keeps the scene', async () => {
  const file = join(dir, 'outra.mesa')
  const { master } = await masterAndPlayer('Ana')
  await build(master)
  await nextSaveDialog(master.app, file)
  await master.page.getByTestId('save-scene').click()
  await act(master.page, { type: 'fog/coverAll' })
  const before = await summary(master)
  await master.app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = (async () => {
      ;(globalThis as { __opened?: boolean }).__opened = true
      return { canceled: true, filePaths: [] }
    }) as typeof dialog.showOpenDialog
  })
  await master.page.getByTestId('load-scene').click()
  await expect(master.page.getByTestId('confirm-message')).toHaveText('Substituir a cena atual?')
  await master.page.getByTestId('confirm-no').click()
  await expect(master.page.getByTestId('confirm')).toHaveCount(0)
  const opened = await master.app.evaluate(() => (globalThis as { __opened?: boolean }).__opened === true)
  expect(opened).toBe(false)
  expect(await summary(master)).toEqual(before)

  await nextOpenDialog(master.app, [file])
  await master.page.getByTestId('load-scene').click()
  await master.page.getByTestId('confirm-yes').click()
  await expect.poll(async () => ((await summary(master)) as { fog: { covered: number } }).fog.covered).toBe(42)
})

test('an invalid file shows "Arquivo .mesa inválido" and keeps the scene (SAVE-04)', async () => {
  const { master } = await masterAndPlayer('Ana')
  await build(master)
  const before = await summary(master)
  await nextOpenDialog(master.app, [textFile('quebrado.mesa', '{"format":"mesa","version":2}')])
  await master.page.getByTestId('load-scene').click()
  await master.page.getByTestId('confirm-yes').click()
  await expect(master.page.getByTestId('scene-message')).toHaveText('Arquivo .mesa inválido')
  expect(await summary(master)).toEqual(before)
})
