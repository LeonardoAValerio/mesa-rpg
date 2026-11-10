import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, masterAndPlayer, putAsset, screenOf, showPanel, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

async function table(): Promise<{ master: AppHandle; player: AppHandle }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  return { master, player }
}
const pressed = (page: Page, id: string) => expect(page.getByTestId(`tool-${id}`)).toHaveAttribute('aria-pressed', 'true')
const pings = (page: Page): Promise<number> => page.evaluate(() => window.__mesaTest!.overlays().pings.length)
const mapTools = (page: Page) => page.evaluate(() => window.__mesaTest!.mapTools())

test('[C1] MTB-01 the map shows a column of tool icons on its left edge: Mover, Régua, Ping, Desenho, and Névoa for the master', async () => {
  const { master, player } = await table()
  const ids = async (page: Page): Promise<string[]> => page.getByTestId('map-tools').locator('button').evaluateAll((bs) => bs.map((b) => b.getAttribute('data-testid')!))
  expect(await ids(master.page)).toEqual(['tool-select', 'tool-ruler', 'tool-ping', 'tool-draw', 'tool-fog'])
  expect(await ids(player.page)).toEqual(['tool-select', 'tool-ruler', 'tool-ping', 'tool-draw'])
  for (const page of [master.page, player.page]) {
    const board = (await page.getByTestId('board').boundingBox())!
    const col = (await page.getByTestId('map-tools').boundingBox())!
    expect(col.x - board.x).toBeLessThan(16) // on the left edge, inside the map
    expect(col.y).toBeGreaterThanOrEqual(board.y)
    expect(col.height).toBeGreaterThan(col.width) // a column
    await expect(page.getByTestId('map-tools').locator('svg')).toHaveCount(page === master.page ? 5 : 4) // icons, no text
    await expect(page.getByTestId('map-tools')).toHaveText('')
  }
})

test('[C2] MTB-02 pointing at a tool shows its name and shortcut', async () => {
  const { master } = await table()
  const tips: Array<[string, string]> = [['select', 'Mover (V)'], ['ruler', 'Régua (R)'], ['ping', 'Ping (P)'], ['draw', 'Desenho (D)'], ['fog', 'Névoa (N)']]
  for (const [id, tip] of tips) await expect(master.page.getByTestId(`tool-${id}`)).toHaveAttribute('title', tip)
})

test('[C3] MTB-03 clicking a tool makes it the active tool and marks its button', async () => {
  const { master } = await table()
  await pressed(master.page, 'select')
  await master.page.getByTestId('tool-ping').click()
  await pressed(master.page, 'ping')
  await expect(master.page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'false')
  const p = await screenOf(master.page, 400, 300)
  await master.page.mouse.click(p.x, p.y)
  await expect.poll(() => pings(master.page)).toBe(1) // the ping tool really acts
})

test('[C4] MTB-04 V, R, P, D and (master) N pick the tools; N does nothing for a player', async () => {
  const { master, player } = await table()
  await master.page.getByTestId('board').click({ position: { x: 600, y: 400 } }) // focus on the map, not a field
  for (const [key, id] of [['r', 'ruler'], ['p', 'ping'], ['d', 'draw'], ['v', 'select'], ['n', 'fog']] as const) {
    await master.page.keyboard.press(key)
    await pressed(master.page, id)
  }
  await pressed(master.page, 'fog-brush')
  expect((await mapTools(master.page)).flyout).toBe(true)
  await player.page.keyboard.press('p')
  await pressed(player.page, 'ping')
  await player.page.keyboard.press('n')
  await pressed(player.page, 'ping') // unchanged
  await expect(player.page.getByTestId('tool-fog')).toHaveCount(0)
})

test('[C5] MTB-05 in a text field the letters type and do not change the tool', async () => {
  const { master } = await table()
  await showPanel(master.page, 'chat')
  await master.page.getByTestId('chat-input').click()
  await master.page.keyboard.type('rpdvn')
  await expect(master.page.getByTestId('chat-input')).toHaveValue('rpdvn')
  await pressed(master.page, 'select')
  expect((await mapTools(master.page)).flyout).toBe(false)
})

test('[C6] MTB-06 the top bar has no tool buttons, fog modes or radius', async () => {
  const { master } = await table()
  const top = master.page.locator('header.topbar')
  await expect(top.locator('[data-testid^="tool-"]')).toHaveCount(0)
  await expect(top.locator('[data-testid^="fog-"]')).toHaveCount(0)
  await expect(top.locator('button')).toHaveText(['Painéis', 'Encerrar mesa'])
})

test('[C7] MTB-07 clicks and drags on the tool column and the fog panel do not reach the map', async () => {
  const { master } = await table()
  await master.page.getByTestId('tool-ping').click()
  const col = (await master.page.getByTestId('map-tools').boundingBox())!
  await master.page.mouse.click(col.x + col.width / 2, col.y + col.height - 2) // the column's own padding
  await master.page.mouse.move(col.x + 3, col.y + 3)
  await master.page.mouse.down()
  await master.page.mouse.move(col.x + 3, col.y + col.height - 3, { steps: 4 })
  await master.page.mouse.up()
  await master.page.waitForTimeout(300)
  expect(await pings(master.page)).toBe(0)
  // the fog panel too: a click on its body draws no fog and sends no ping
  await master.page.getByTestId('tool-fog').click()
  const fly = (await master.page.getByTestId('fog-flyout').boundingBox())!
  await master.page.mouse.click(fly.x + fly.width - 4, fly.y + fly.height - 4)
  await master.page.waitForTimeout(300)
  expect((await master.page.evaluate(() => window.__mesaTest!.board()!.fog)).shapes).toBe(0)
})

test('[C8] MTB-08 Névoa opens the fog panel with Pincel, Retângulo, Polígono, Cobrir, Revelar and the radius; Pincel and Cobrir the first time', async () => {
  const { master } = await table()
  await expect(master.page.getByTestId('fog-flyout')).toBeHidden()
  await master.page.getByTestId('tool-fog').click()
  const fly = master.page.getByTestId('fog-flyout')
  await expect(fly).toBeVisible()
  for (const id of ['tool-fog-brush', 'tool-fog-rect', 'tool-fog-poly', 'fog-mode-cover', 'fog-mode-reveal', 'fog-radius']) await expect(fly.getByTestId(id), id).toBeVisible()
  await pressed(master.page, 'fog-brush')
  await expect(fly.getByTestId('fog-mode-cover')).toHaveAttribute('aria-pressed', 'true')
  // it opens beside the column
  const col = (await master.page.getByTestId('map-tools').boundingBox())!
  const box = (await fly.boundingBox())!
  expect(box.x).toBeGreaterThan(col.x + col.width - 1)
})

test('[C9] MTB-09 picking a shape makes it the active tool and the Névoa button shows its icon', async () => {
  const { master } = await table()
  await master.page.getByTestId('tool-fog').click()
  expect((await mapTools(master.page)).fogIcon).toBe('brush')
  await master.page.getByTestId('tool-fog-rect').click()
  await pressed(master.page, 'fog-rect')
  expect((await mapTools(master.page)).fogIcon).toBe('square')
  await master.page.getByTestId('tool-fog-poly').click()
  await pressed(master.page, 'fog-poly')
  expect((await mapTools(master.page)).fogIcon).toBe('pentagon')
})

test('[C10] MTB-10 the radius shows only with the brush', async () => {
  const { master } = await table()
  await master.page.getByTestId('tool-fog').click()
  await expect(master.page.getByTestId('fog-radius-label')).toBeVisible()
  await master.page.getByTestId('tool-fog-rect').click()
  await expect(master.page.getByTestId('fog-radius-label')).toBeHidden()
  await master.page.getByTestId('tool-fog-poly').click()
  await expect(master.page.getByTestId('fog-radius-label')).toBeHidden()
  await master.page.getByTestId('tool-fog-brush').click()
  await expect(master.page.getByTestId('fog-radius-label')).toBeVisible()
})

test('[C11] MTB-11 Esc, a press outside or another tool closes the fog panel; shape and mode stay for next time', async () => {
  const { master } = await table()
  const fly = master.page.getByTestId('fog-flyout')
  await master.page.getByTestId('tool-fog').click()
  await master.page.getByTestId('tool-fog-rect').click()
  await master.page.getByTestId('fog-mode-reveal').click()
  await master.page.keyboard.press('Escape')
  await expect(fly).toBeHidden()
  await pressed(master.page, 'fog-rect') // still the active tool
  await master.page.keyboard.press('n')
  await expect(fly).toBeVisible()
  await pressed(master.page, 'fog-rect')
  await expect(fly.getByTestId('fog-mode-reveal')).toHaveAttribute('aria-pressed', 'true')
  // a press on the map closes it, and the press still draws
  await master.page.getByTestId('fog-cover-all').click()
  const a = await screenOf(master.page, 300, 200)
  const b = await screenOf(master.page, 500, 400)
  await master.page.mouse.move(a.x, a.y)
  await master.page.mouse.down()
  await master.page.mouse.move(b.x, b.y, { steps: 6 })
  await master.page.mouse.up()
  await expect(fly).toBeHidden()
  await expect.poll(async () => (await master.page.evaluate(() => window.__mesaTest!.fogSample([[400, 300]])))[0]).toBe(false) // revealed
  // another tool closes it
  await master.page.getByTestId('tool-fog').click()
  await expect(fly).toBeVisible()
  await master.page.getByTestId('tool-ruler').click()
  await expect(fly).toBeHidden()
  // Esc closes it with the focus in its own radius field too
  await master.page.getByTestId('tool-fog').click()
  await master.page.getByTestId('tool-fog-brush').click()
  await master.page.getByTestId('fog-radius').click()
  await master.page.keyboard.press('Escape')
  await expect(fly).toBeHidden()
})

test('Space after clicking Névoa and closing its panel does not open it again (MAP-08, MTB-11)', async () => {
  const { master } = await table()
  const fly = master.page.getByTestId('fog-flyout')
  await master.page.getByTestId('tool-fog').click()
  await expect(fly).toBeVisible()
  await master.page.keyboard.press('Escape')
  await expect(fly).toBeHidden()
  await master.page.keyboard.press('Space') // the pan key; the Névoa button must not have kept the focus
  await master.page.waitForTimeout(200)
  await expect(fly).toBeHidden()
  // and after a Space + drag pan, releasing Space does not open it either
  const box = (await master.page.getByTestId('board').boundingBox())!
  await master.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await master.page.keyboard.down('Space')
  await master.page.mouse.down()
  await master.page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 4 })
  await master.page.mouse.up()
  await master.page.keyboard.up('Space')
  await master.page.waitForTimeout(200)
  await expect(fly).toBeHidden()
})

test('an item dragged and released over the tool column ends its drag (MTB-07)', async () => {
  const { master } = await table()
  const tok = await putAsset(master.app, solidPng(32, 32, [200, 30, 30]))
  await act(master.page, { type: 'token/place', hash: tok, name: 'Goblin', kind: 'object', x: 400, y: 300, width: 1, ring: null })
  await expect.poll(async () => (await master.page.evaluate(() => window.__mesaTest!.board()!.tokens.length))).toBe(1)
  const from = await screenOf(master.page, 400, 300)
  const col = (await master.page.getByTestId('map-tools').boundingBox())!
  await master.page.mouse.move(from.x, from.y)
  await master.page.mouse.down()
  await master.page.mouse.move(col.x + col.width / 2, col.y + col.height / 2, { steps: 8 })
  expect(await master.page.evaluate(() => window.__mesaTest!.board()!.dragging)).not.toBeNull()
  await master.page.mouse.up()
  await expect.poll(async () => master.page.evaluate(() => window.__mesaTest!.board()!.dragging)).toBeNull()
})
