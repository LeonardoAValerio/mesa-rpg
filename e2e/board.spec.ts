import { expect, test, type Page } from '@playwright/test'
import type { BoardSnapshot } from '../src/renderer/board/board'
import { act, closeAll, masterAndPlayer, putAsset, screenOf, snap, type AppHandle } from './helpers'

test.afterEach(closeAll)

let H = ''

async function mapReady(masterApp: AppHandle, player: Page): Promise<void> {
  const master = masterApp.page
  H = await putAsset(masterApp.app)
  await act(master, { type: 'map/set', hash: H, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  await expect.poll(async () => (await snap(player)).map?.width).toBe(800)
}

test('[C17] MAP-01 with no map the master sees "Nenhum mapa carregado" and "Importar mapa"; the player sees "Aguardando o mestre carregar um mapa"', async () => {
  const { master, player } = await masterAndPlayer()
  await expect(master.page.getByTestId('empty-message')).toHaveText('Nenhum mapa carregado')
  await expect(master.page.getByTestId('import-map')).toHaveText('Importar mapa')
  await expect(player.page.getByTestId('empty-message')).toHaveText('Aguardando o mestre carregar um mapa')
  await expect(player.page.getByTestId('import-map')).toHaveCount(0)
})

test('[C23] MAP-07 the wheel zooms only that window, between 10% and 400%, keeping the point under the cursor', async () => {
  const { master, player } = await masterAndPlayer()
  await mapReady(master, player.page)
  const other = (await snap(player.page)).camera
  const before = await snap(master.page)
  const cursor = { x: Math.round(before.canvas.left + 300), y: Math.round(before.canvas.top + 200) }
  const worldUnder = (s: BoardSnapshot): { x: number; y: number } => ({
    x: (cursor.x - s.canvas.left - s.camera.x) / s.camera.scale,
    y: (cursor.y - s.canvas.top - s.camera.y) / s.camera.scale
  })
  await master.page.mouse.move(cursor.x, cursor.y)
  await master.page.mouse.wheel(0, -100)
  await expect.poll(async () => (await snap(master.page)).camera.scale).toBeCloseTo(before.camera.scale * 1.1, 5)
  const after = await snap(master.page)
  expect(worldUnder(after).x).toBeCloseTo(worldUnder(before).x, 3)
  expect(worldUnder(after).y).toBeCloseTo(worldUnder(before).y, 3)
  for (let i = 0; i < 60; i++) await master.page.mouse.wheel(0, -100)
  await expect.poll(async () => (await snap(master.page)).camera.scale).toBe(4)
  for (let i = 0; i < 120; i++) await master.page.mouse.wheel(0, 100)
  await expect.poll(async () => (await snap(master.page)).camera.scale).toBeCloseTo(0.1, 10)
  expect((await snap(player.page)).camera).toEqual(other)
})

test('[C24] MAP-08 dragging with the middle button pans only that window', async () => {
  const { master, player } = await masterAndPlayer()
  await mapReady(master, player.page)
  const other = (await snap(player.page)).camera
  const before = await snap(master.page)
  const p = { x: before.canvas.left + 400, y: before.canvas.top + 300 }
  await master.page.mouse.move(p.x, p.y)
  await master.page.mouse.down({ button: 'middle' })
  await master.page.mouse.move(p.x + 100, p.y + 50, { steps: 5 })
  await master.page.mouse.up({ button: 'middle' })
  const after = await snap(master.page)
  expect(after.camera.x - before.camera.x).toBeCloseTo(100, 0)
  expect(after.camera.y - before.camera.y).toBeCloseTo(50, 0)
  expect(after.camera.scale).toBe(before.camera.scale)
  expect((await snap(player.page)).camera).toEqual(other)
})

test('[C30] TOK-05 dropping a dragged token snaps its top-left corner to the cell under it, in both windows', async () => {
  const { master, player } = await masterAndPlayer()
  await mapReady(master, player.page)
  await act(master.page, { type: 'token/place', hash: H, name: 'Goblin', faction: 'inimigo', size: 1, col: 1, row: 1 })
  await expect.poll(async () => (await snap(player.page)).tokens.length).toBe(1)
  // grab the centre (150,150) and move by (+235,+120): the corner lands at (335,220), inside cell (3,2)
  const from = await screenOf(master.page, 150, 150)
  const to = await screenOf(master.page, 385, 270)
  await master.page.mouse.move(from.x, from.y)
  await master.page.mouse.down()
  await master.page.mouse.move(to.x, to.y, { steps: 8 })
  await master.page.mouse.up()
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens.map((t) => [t.x, t.y])).toEqual([[300, 200]])
  }
})

test('[C31] TOK-06 a size-2 token covers 2x2 cells, shows its name and has a ring in its faction colour', async () => {
  const { master, player } = await masterAndPlayer()
  await mapReady(master, player.page)
  await act(master.page, { type: 'token/place', hash: H, name: 'Ogro', faction: 'inimigo', size: 2, col: 2, row: 2 })
  await act(master.page, { type: 'token/place', hash: H, name: 'Elfa', faction: 'grupo', size: 1, col: 5, row: 1 })
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens.length).toBe(2)
    const tokens = (await snap(page)).tokens.sort((a, b) => a.name.localeCompare(b.name))
    expect(tokens[1]).toMatchObject({ name: 'Ogro', label: 'Ogro', x: 200, y: 200, w: 200, h: 200, ring: '#ef4444' })
    expect(tokens[0]).toMatchObject({ name: 'Elfa', label: 'Elfa', x: 500, y: 100, w: 100, h: 100, ring: '#3b82f6' })
  }
})
