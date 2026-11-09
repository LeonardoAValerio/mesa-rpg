import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, coveredCenters, fogSample, masterAndPlayer, putAsset, screenOf, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

/** 800x600 map with 100 px cells (48 cells, all covered), Goblin at (1,1) and Ogro at (5,4). */
async function table(): Promise<{ master: AppHandle; player: AppHandle }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  const tok = await putAsset(master.app, solidPng(16, 16))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  await act(master.page, { type: 'fog/coverAll' }) // a new map has no fog (FOGD-01)
  await act(master.page, { type: 'token/place', hash: tok, name: 'Goblin', faction: 'inimigo', size: 1, col: 1, row: 1 })
  await act(master.page, { type: 'token/place', hash: tok, name: 'Ogro', faction: 'inimigo', size: 1, col: 5, row: 4 })
  await expect.poll(() => coveredCenters(player.page)).toBe(48)
  return { master, player }
}
async function dragRect(page: Page, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  const a = await screenOf(page, x0, y0)
  const b = await screenOf(page, x1, y1)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 6 })
  await page.mouse.up()
}
const names = async (page: Page): Promise<string[]> => (await snap(page)).tokens.map((t) => t.name).sort()

test('[C65] FOG-02 a covered cell is opaque in the player window and 50% opaque in the master window', async () => {
  const { master, player } = await table()
  expect((await snap(player.page)).fog.alpha).toBe(1)
  expect((await snap(master.page)).fog.alpha).toBe(0.5)
  expect(await coveredCenters(master.page)).toBe(48)
  await master.page.getByTestId('tool-fog-rect').click()
  await master.page.getByTestId('fog-mode-reveal').click()
  await dragRect(master.page, 10, 10, 290, 190) // the centres of cells (0..2, 0..1)
  await expect.poll(() => coveredCenters(player.page)).toBe(42)
  await expect.poll(() => coveredCenters(master.page)).toBe(42)
  expect((await snap(player.page)).fog.alpha).toBe(1)
  expect((await snap(master.page)).fog.alpha).toBe(0.5)
})

test('the master reveals a rectangle and the player sees only that area and the tokens whose centre is inside it (FOGS-02, FOGS-06)', async () => {
  const { master, player } = await table()
  expect(await names(player.page)).toEqual([])
  expect(await names(master.page)).toEqual(['Goblin', 'Ogro'])
  await master.page.getByTestId('tool-fog-rect').click()
  await master.page.getByTestId('fog-mode-reveal').click()
  await dragRect(master.page, 10, 10, 290, 190)
  await expect.poll(() => names(player.page)).toEqual(['Goblin'])
  await master.page.getByTestId('fog-mode-cover').click()
  await dragRect(master.page, 110, 110, 190, 190)
  await expect.poll(() => names(player.page)).toEqual([])
})

test('the brush reveals around the cursor and "Cobrir tudo" covers everything again (FOGS-01, FOGS-05)', async () => {
  const { master, player } = await table()
  await master.page.getByTestId('fog-radius').fill('1')
  await master.page.getByTestId('fog-radius').press('Enter')
  await master.page.getByTestId('tool-fog-brush').click()
  await master.page.getByTestId('fog-mode-reveal').click()
  // (570, 470): within one cell (100 px) of the centres of (5,4), (6,4) and (5,5) only (82 px); the rest are over 100 px away
  const p = await screenOf(master.page, 570, 470)
  await master.page.mouse.click(p.x, p.y)
  await expect.poll(() => coveredCenters(player.page)).toBe(45)
  await expect.poll(() => names(player.page)).toEqual(['Ogro'])
  await master.page.getByTestId('fog-cover-all').click()
  await expect.poll(() => coveredCenters(player.page)).toBe(48)
  await expect.poll(() => names(player.page)).toEqual([])
})

test('[C2] FOGD-02 "Revelar tudo" clears the fog in the master\'s and the player\'s windows', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  // FOGD-01 on screen: the imported map shows with no fog in both windows
  await expect.poll(() => coveredCenters(player.page)).toBe(0)
  expect(await coveredCenters(master.page)).toBe(0)
  await master.page.getByTestId('fog-cover-all').click()
  await expect.poll(() => coveredCenters(player.page)).toBe(48)
  await expect.poll(() => coveredCenters(master.page)).toBe(48)
  await expect(master.page.getByTestId('fog-reveal-all')).toHaveText('Revelar tudo')
  await master.page.getByTestId('fog-reveal-all').click()
  await expect.poll(() => coveredCenters(player.page)).toBe(0)
  await expect.poll(() => coveredCenters(master.page)).toBe(0)
  await expect(player.page.getByTestId('fog-reveal-all')).toHaveCount(0) // master-only control
})

test('[C5] FOGS-05 "Cobrir tudo" covers and "Revelar tudo" reveals the whole map, edges included, in every window', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  // a revealed and a covered shape first, so "tudo" must override both
  await act(master.page, { type: 'fog/shape', shape: { kind: 'rect', mode: 'cover', x: 0, y: 0, w: 200, h: 200 } })
  const points: Array<[number, number]> = [[1, 1], [799, 1], [1, 599], [799, 599], [400, 300], [123, 457], [100, 100]]
  await master.page.getByTestId('fog-cover-all').click()
  for (const page of [master.page, player.page]) await expect.poll(() => fogSample(page, points)).toEqual(points.map(() => true))
  expect((await snap(player.page)).fog).toEqual({ shapes: 0, base: 'covered', alpha: 1 })
  expect((await snap(master.page)).fog).toEqual({ shapes: 0, base: 'covered', alpha: 0.5 })
  await act(master.page, { type: 'fog/shape', shape: { kind: 'rect', mode: 'reveal', x: 0, y: 0, w: 200, h: 200 } })
  await master.page.getByTestId('fog-reveal-all').click()
  for (const page of [master.page, player.page]) await expect.poll(() => fogSample(page, points)).toEqual(points.map(() => false))
})
