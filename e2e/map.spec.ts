import { expect, test } from '@playwright/test'
import { gridMap, textFile } from './fixtures'
import { closeAll, masterAndPlayer, nextOpenDialog, snap } from './helpers'

test.afterEach(closeAll)

test('[C18] MAP-02 the master imports a PNG and both windows show the map at the image width and height', async () => {
  const { master, player } = await masterAndPlayer()
  await nextOpenDialog(master.app, [gridMap('secao.png', 2000, 1500, 24, 18)])
  await master.page.getByTestId('import-map').click()
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).map?.width, { timeout: 15000 }).toBe(2000)
    expect((await snap(page)).map?.height).toBe(1500)
    await expect(page.getByTestId('board-empty')).toBeHidden()
  }
  expect((await snap(master.page)).map?.textured).toBe(true)
  // the player downloads the image from the master by hash (ASSET-02) and draws it
  await expect.poll(async () => (await snap(player.page)).map?.textured, { timeout: 15000 }).toBe(true)
  // the grid was detected on import (MAP-03): ~83 px
  const cell = (await snap(player.page)).grid!.cell
  expect(cell).toBeGreaterThanOrEqual(82)
  expect(cell).toBeLessThanOrEqual(85)
  await expect(master.page.getByTestId('map-message')).toHaveText('')
})

test('[C21] MAP-05 setting the cell to 100 in the master panel redraws the grid at 100 px in both windows', async () => {
  const { master, player } = await masterAndPlayer()
  await nextOpenDialog(master.app, [gridMap('lisa.png', 2000, 1500, 1, 1)])
  await master.page.getByTestId('import-map').click()
  await expect(master.page.getByTestId('map-message')).toHaveText('Grid não detectado — ajuste manualmente')
  await master.page.getByTestId('grid-offset-x').fill('0')
  await master.page.getByTestId('grid-offset-x').press('Enter')
  await master.page.getByTestId('grid-offset-y').fill('0')
  await master.page.getByTestId('grid-offset-y').press('Enter')
  await master.page.getByTestId('grid-cell').fill('100')
  await master.page.getByTestId('grid-cell').press('Enter')
  for (const page of [master.page, player.page]) {
    // 2000x1500 at 100 px: 21 vertical + 16 horizontal lines
    await expect.poll(async () => (await snap(page)).grid).toMatchObject({ cell: 100, offsetX: 0, offsetY: 0, lines: 37 })
  }
  await master.page.getByTestId('grid-opacity').fill('30')
  await master.page.getByTestId('grid-opacity').press('Enter')
  await expect.poll(async () => (await snap(player.page)).grid?.opacity).toBeCloseTo(0.3, 5)
})

test('a text file renamed to .png shows "Imagem inválida" and keeps the current map (MAP-09)', async () => {
  const { master } = await masterAndPlayer()
  await nextOpenDialog(master.app, [textFile('falso.png', 'não é imagem')])
  await master.page.getByTestId('import-map').click()
  await expect(master.page.getByTestId('map-message')).toHaveText('Imagem inválida')
  expect((await snap(master.page)).map).toBeNull()
})
