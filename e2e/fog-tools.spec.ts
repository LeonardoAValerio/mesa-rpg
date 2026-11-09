import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, fogSample, masterAndPlayer, putAsset, screenOf, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

/** 800x600 map with 100 px cells and no fog; the master has picked `tool`. */
async function table(tool?: string): Promise<{ master: AppHandle; player: AppHandle }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  if (tool) await master.page.getByTestId(tool).click()
  return { master, player }
}
const fogTool = (page: Page) => page.evaluate(() => window.__mesaTest!.fogTool())
async function to(page: Page, x: number, y: number): Promise<void> {
  const p = await screenOf(page, x, y)
  await page.mouse.move(p.x, p.y, { steps: 4 })
}
/** Presses at (x0, y0), moves through `path` and stops before releasing. */
async function press(page: Page, x0: number, y0: number, ...path: Array<[number, number]>): Promise<void> {
  await to(page, x0, y0)
  await page.mouse.down()
  for (const [x, y] of path) await to(page, x, y)
}
const both = (m: AppHandle, p: AppHandle): Page[] => [m.page, p.page]

test('[C1] FOGS-01 a brush drag covers the points within the brush radius of the path, and none past it, in every window', async () => {
  const { master, player } = await table('tool-fog-brush') // radius 1 cell = 100 px, mode Cobrir
  await press(master.page, 150, 300, [300, 300], [450, 300], [650, 300])
  await master.page.mouse.up()
  const inside: Array<[number, number]> = [[400, 300], [400, 390], [400, 210], [60, 300], [740, 300], [650, 395]]
  const outside: Array<[number, number]> = [[400, 420], [400, 180], [30, 300], [770, 300], [100, 100], [700, 500]]
  for (const page of both(master, player)) {
    await expect.poll(() => fogSample(page, inside)).toEqual(inside.map(() => true))
    expect(await fogSample(page, outside)).toEqual(outside.map(() => false))
  }
})

test('[C2] FOGS-02 a rectangle covers exactly its inside in every window', async () => {
  const { master, player } = await table('tool-fog-rect')
  await press(master.page, 200, 150, [500, 350])
  await master.page.mouse.up()
  const inside: Array<[number, number]> = [[205, 155], [495, 345], [350, 250]]
  const outside: Array<[number, number]> = [[190, 250], [510, 250], [350, 140], [350, 360]]
  for (const page of both(master, player)) {
    await expect.poll(() => fogSample(page, inside)).toEqual(inside.map(() => true))
    expect(await fogSample(page, outside)).toEqual(outside.map(() => false))
  }
})

test('[C10] FOGT-01 picking a fog tool shows "Cobrir" and "Revelar" in the toolbar, "Cobrir" selected the first time', async () => {
  const { master } = await table()
  const modes = master.page.getByTestId('toolbar').getByTestId('fog-modes')
  await expect(modes).toBeHidden()
  await master.page.getByTestId('tool-fog-rect').click()
  await expect(modes).toBeVisible()
  await expect(modes.getByTestId('fog-mode-cover')).toHaveText('Cobrir')
  await expect(modes.getByTestId('fog-mode-reveal')).toHaveText('Revelar')
  await expect(modes.getByTestId('fog-mode-cover')).toHaveAttribute('aria-pressed', 'true')
  await expect(modes.getByTestId('fog-mode-reveal')).toHaveAttribute('aria-pressed', 'false')
  await master.page.getByTestId('tool-fog-brush').click()
  await expect(modes).toBeVisible()
  // the old modes in the side panel are gone
  await expect(master.page.getByTestId('fog-panel').getByTestId('fog-mode-cover')).toHaveCount(0)
})

test('[C16] FOGT-07 without a fog tool the toolbar shows no fog modes, and a player never sees them', async () => {
  const { master, player } = await table('tool-fog-brush')
  await expect(master.page.getByTestId('fog-modes')).toBeVisible()
  for (const tool of ['tool-select', 'tool-ruler', 'tool-ping', 'tool-draw']) {
    await master.page.getByTestId(tool).click()
    await expect(master.page.getByTestId('fog-modes'), tool).toBeHidden()
  }
  await expect(player.page.getByTestId('fog-modes')).toHaveCount(0)
})

test('[C11] FOGT-02 holding Alt draws in the opposite mode, and releasing it goes back to the selected mode', async () => {
  const { master, player } = await table('tool-fog-rect')
  await master.page.getByTestId('fog-cover-all').click()
  await master.page.keyboard.down('Alt')
  await press(master.page, 100, 100, [300, 300])
  await master.page.mouse.up()
  await master.page.keyboard.up('Alt')
  await expect.poll(() => fogSample(player.page, [[200, 200], [400, 400]])).toEqual([false, true]) // revealed with Cobrir selected
  await press(master.page, 150, 150, [250, 250])
  await master.page.mouse.up()
  await expect.poll(() => fogSample(player.page, [[200, 200], [120, 120]])).toEqual([true, false]) // no Alt: Cobrir again
  // and the other way round
  await master.page.getByTestId('fog-mode-reveal').click()
  await master.page.keyboard.down('Alt')
  await press(master.page, 500, 100, [700, 300])
  await master.page.mouse.up()
  await master.page.keyboard.up('Alt')
  await expect.poll(() => fogSample(player.page, [[600, 200]])).toEqual([true])
})

test('[C12] FOGT-03 the brush shows a circle of its radius under the cursor', async () => {
  const { master } = await table('tool-fog-brush')
  await to(master.page, 400, 300)
  await expect.poll(() => fogTool(master.page)).toMatchObject({ cursor: { r: 100 } })
  const c = (await fogTool(master.page))!.cursor!
  expect(c.x).toBeCloseTo(400, 0)
  expect(c.y).toBeCloseTo(300, 0)
  await master.page.getByTestId('fog-radius').fill('2.5')
  await master.page.getByTestId('fog-radius').press('Enter')
  await to(master.page, 200, 200)
  await expect.poll(async () => (await fogTool(master.page))!.cursor).toMatchObject({ r: 250 })
  // the input clamps what the master types (FOGT-06)
  await master.page.getByTestId('fog-radius').fill('13')
  await master.page.getByTestId('fog-radius').press('Enter')
  await expect(master.page.getByTestId('fog-radius')).toHaveValue('10')
  // no circle with the rectangle
  await master.page.getByTestId('tool-fog-rect').click()
  await to(master.page, 300, 300)
  expect((await fogTool(master.page))!.cursor).toBeNull()
})

test('[C13] FOGT-04 while drawing only the master sees a preview; the fog changes in every window on release', async () => {
  const { master, player } = await table('tool-fog-brush')
  await press(master.page, 150, 300, [400, 300], [600, 300])
  await expect.poll(async () => (await fogTool(master.page))!.preview).toMatchObject({ kind: 'stroke', mode: 'cover' })
  await master.page.waitForTimeout(400)
  for (const page of both(master, player)) expect(await fogSample(page, [[400, 300]]), 'nothing sent yet').toEqual([false])
  await master.page.mouse.up()
  expect((await fogTool(master.page))!.preview).toBeNull()
  for (const page of both(master, player)) await expect.poll(() => fogSample(page, [[400, 300]])).toEqual([true])
  // the rectangle the same
  await master.page.getByTestId('tool-fog-rect').click()
  await press(master.page, 100, 450, [300, 550])
  await expect.poll(async () => (await fogTool(master.page))!.preview).toMatchObject({ kind: 'rect' })
  await master.page.waitForTimeout(400)
  expect(await fogSample(player.page, [[200, 500]])).toEqual([false])
  await master.page.mouse.up()
  await expect.poll(() => fogSample(player.page, [[200, 500]])).toEqual([true])
})
