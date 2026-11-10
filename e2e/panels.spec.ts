import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, freePort, host, launch, masterAndPlayer, putAsset, showPanel, solidPng, type AppHandle } from './helpers'
import type { LayoutSnapshot } from '../src/renderer/ui/layout'

test.afterEach(closeAll)

async function layout(page: Page): Promise<LayoutSnapshot> {
  await page.waitForFunction(() => !!window.__mesaTest?.layout) // the table is set up just after it opens
  return page.evaluate(() => window.__mesaTest!.layout())
}
const groupOf = (l: LayoutSnapshot, id: string) => l.groups.find((g) => g.panels.includes(id))!

async function table(): Promise<{ master: AppHandle; player: AppHandle }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  return { master, player }
}

test('the four tabs of the master fit in the starting width: none is hidden behind the overflow menu (PANEL-01)', async () => {
  const { master } = await table()
  for (const id of ['tokens', 'mapas', 'dados', 'chat']) {
    const b = (await master.page.getByTestId(`tab-${id}`).boundingBox())!
    const hit = await master.page.evaluate(([x, y]) => (document.elementFromPoint(x, y) as HTMLElement).closest('[data-testid^="tab-"]')?.getAttribute('data-testid') ?? null, [b.x + b.width / 2, b.y + b.height / 2])
    expect(hit, id).toBe(`tab-${id}`)
  }
})

test('[C1] PANEL-01 the master starts with the table in the centre and, on its right, Conectados above Tokens · Mapas · Dados · Chat with Mapas open', async () => {
  const { master } = await table()
  const l = await layout(master.page)
  expect(l.groups.map((g) => g.panels)).toEqual([['mesa'], ['conectados'], ['tokens', 'mapas', 'dados', 'chat']])
  const mesa = groupOf(l, 'mesa')
  const con = groupOf(l, 'conectados')
  const tabs = groupOf(l, 'mapas')
  expect(mesa.header).toBe(false)
  expect(con.left).toBeGreaterThan(mesa.left + mesa.width - 2) // on the right of the table
  expect(tabs.left).toBe(con.left)
  expect(tabs.top).toBeGreaterThan(con.top) // Conectados above
  expect(tabs.active).toBe('mapas')
  expect(l.visible.sort()).toEqual(['conectados', 'mapas', 'mesa'])
  await expect(master.page.getByTestId('tab-mapas')).toBeVisible()
  for (const id of ['tokens', 'mapas', 'dados', 'chat', 'conectados']) await expect(master.page.getByTestId(`tab-${id}`)).toHaveText(new RegExp(`^${{ tokens: 'Tokens', mapas: 'Mapas', dados: 'Dados', chat: 'Chat', conectados: 'Conectados' }[id]}`))
  await expect(master.page.getByTestId('panel-conectados').getByTestId('player')).toHaveText(['Mestre', 'Ana'])
})

test('[C2] PANEL-02 a player starts with Conectados above Dados · Chat with Dados open, and no Tokens or Mapas', async () => {
  const { player } = await table()
  const l = await layout(player.page)
  expect(l.groups.map((g) => g.panels)).toEqual([['mesa'], ['conectados'], ['dados', 'chat']])
  expect(groupOf(l, 'dados').active).toBe('dados')
  expect(groupOf(l, 'dados').top).toBeGreaterThan(groupOf(l, 'conectados').top)
  await expect(player.page.getByTestId('tab-tokens')).toHaveCount(0)
  await expect(player.page.getByTestId('tab-mapas')).toHaveCount(0)
  await expect(player.page.getByTestId('panel-dados').getByTestId('dice-input')).toBeVisible()
})

test('[C3] PANEL-03 clicking a tab shows that panel in its group and marks the tab active', async () => {
  const { master } = await table()
  for (const id of ['tokens', 'dados', 'chat', 'mapas'] as const) {
    await master.page.getByTestId(`tab-${id}`).click()
    await expect.poll(async () => groupOf(await layout(master.page), id).active, id).toBe(id)
    await expect(master.page.getByTestId(`panel-${id}`), id).toBeVisible()
    for (const other of ['tokens', 'mapas', 'dados', 'chat'].filter((o) => o !== id)) await expect(master.page.getByTestId(`panel-${other}`), `${id} hides ${other}`).toBeHidden()
    // the active tab is marked (dockview's active-tab class on the tab holding our label)
    await expect(master.page.locator('.dv-tab', { has: master.page.getByTestId(`tab-${id}`) })).toHaveClass(/dv-active-tab/)
  }
})

test('[C4] PANEL-04 Tokens holds the token import, the palette, the library and the item editor', async () => {
  const { master } = await table()
  await showPanel(master.page, 'tokens')
  const p = master.page.getByTestId('panel-tokens')
  await expect(p.getByTestId('import-tokens')).toBeVisible()
  await expect(p.getByTestId('load-palette')).toBeVisible()
  await expect(p.getByTestId('library')).toHaveCount(1)
  await expect(p.getByTestId('token-editor')).toHaveCount(1) // shown when an item is selected
})

test('[C5] PANEL-05 Mapas holds Salvar cena, Carregar cena, Importar mapa, the grid settings, Cobrir tudo and Revelar tudo', async () => {
  const { master } = await table()
  const p = master.page.getByTestId('panel-mapas')
  for (const id of ['save-scene', 'load-scene', 'import-map-panel', 'grid-panel', 'grid-color', 'fog-cover-all', 'fog-reveal-all']) await expect(p.getByTestId(id), id).toBeVisible()
})

test('[C13] PANEL-13 the table has no tab, and a tab dropped on its centre does not join it', async () => {
  const { master } = await table()
  await expect(master.page.getByTestId('tab-mesa')).toBeHidden()
  const tab = master.page.getByTestId('tab-chat')
  const board = await master.page.getByTestId('board').boundingBox()
  const from = await tab.boundingBox()
  await master.page.mouse.move(from!.x + 8, from!.y + from!.height / 2)
  await master.page.mouse.down()
  await humanMove(master.page, from!.x + 8, from!.y + from!.height / 2, board!.x + board!.width / 2, board!.y + board!.height / 2)
  await master.page.mouse.up()
  await master.page.waitForTimeout(300)
  const l = await layout(master.page)
  expect(groupOf(l, 'mesa').panels).toEqual(['mesa'])
  expect(l.groups.every((g) => !(g.panels.includes('mesa') && g.floating))).toBe(true)
})

async function dragTo(page: Page, from: string, x: number, y: number): Promise<void> {
  const box = (await page.getByTestId(from).boundingBox())!
  await page.mouse.move(box.x + 8, box.y + box.height / 2) // on the title, clear of the × button
  await page.mouse.down()
  await humanMove(page, box.x + 8, box.y + box.height / 2, x, y)
  await page.mouse.up()
}
/** Moves like a hand does, with a frame between steps: dockview's drags read the pointer as it goes. */
async function humanMove(page: Page, x0: number, y0: number, x1: number, y1: number, steps = 12): Promise<void> {
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps)
    await page.waitForTimeout(20)
  }
}
async function groupBox(page: Page, panel: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const g = groupOf(await layout(page), panel)
  return { x: g.left, y: g.top, width: g.width, height: g.height }
}

test('[C6] PANEL-06 a tab dropped on another group moves there; dropped on a group\'s bottom edge it splits that group', async () => {
  const { master } = await table()
  // Chat onto the middle of Conectados: same group
  const con = await groupBox(master.page, 'conectados')
  await dragTo(master.page, 'tab-chat', con.x + con.width / 2, con.y + con.height / 2 + 10)
  await expect.poll(async () => groupOf(await layout(master.page), 'chat').panels.sort()).toEqual(['chat', 'conectados'])
  // Dados onto the bottom part of its own group (not the window's edge): a new group below
  const tabs = await groupBox(master.page, 'dados')
  await dragTo(master.page, 'tab-dados', tabs.x + tabs.width / 2, tabs.y + tabs.height * 0.85)
  await expect.poll(async () => groupOf(await layout(master.page), 'dados').panels).toEqual(['dados'])
  const l = await layout(master.page)
  expect(groupOf(l, 'dados').top).toBeGreaterThan(groupOf(l, 'mapas').top)
  expect(groupOf(l, 'dados').left).toBe(groupOf(l, 'mapas').left)
  expect(groupOf(l, 'mapas').panels).toEqual(['tokens', 'mapas'])
})

test('[C7] PANEL-07 dragging the divider between the table and the panels resizes both, and the table fits', async () => {
  const { master } = await table()
  const before = await layout(master.page)
  const mesa = groupOf(before, 'mesa')
  const right = groupOf(before, 'mapas')
  const x = mesa.left + mesa.width
  const y = mesa.top + mesa.height / 2
  await master.page.mouse.move(x, y)
  await master.page.mouse.down()
  await humanMove(master.page, x, y, x - 200, y)
  await master.page.mouse.up()
  await expect.poll(async () => groupOf(await layout(master.page), 'mesa').width).toBeLessThan(mesa.width - 150)
  const after = await layout(master.page)
  expect(groupOf(after, 'mapas').width).toBeGreaterThan(right.width + 150)
  // the table's canvas follows its new size
  await expect.poll(async () => Math.round((await master.page.evaluate(() => window.__mesaTest!.board()!.canvas.width)))).toBe(groupOf(after, 'mesa').width)
})

test('[C8] PANEL-08 a floated group shows over the table and moves; with the right column empty the table takes its space', async () => {
  const { master } = await table()
  const fullWidth = (await master.page.getByTestId('dock').boundingBox())!.width
  await master.page.getByTestId('float-mapas').click()
  await expect.poll(async () => groupOf(await layout(master.page), 'mapas').floating).toBe(true)
  await master.page.getByTestId('float-conectados').click()
  await expect.poll(async () => groupOf(await layout(master.page), 'conectados').floating).toBe(true)
  // nothing is docked beside the table any more: it fills the width
  await expect.poll(async () => groupOf(await layout(master.page), 'mesa').width).toBe(Math.round(fullWidth))
  // the floating groups sit over the table, cascaded so neither hides the other
  const g = await groupBox(master.page, 'mapas')
  const c = await groupBox(master.page, 'conectados')
  expect(c.x - g.x).toBeGreaterThanOrEqual(30)
  const board = (await master.page.getByTestId('board').boundingBox())!
  expect(g.x).toBeGreaterThanOrEqual(board.x)
  expect(g.x + g.width).toBeLessThanOrEqual(board.x + board.width + 1)
  // and it moves when dragged by its title bar
  const handles = master.page.locator('.dv-floating-titlebar')
  let handle = (await handles.first().boundingBox())!
  for (let i = 0; i < (await handles.count()); i++) {
    const b = (await handles.nth(i).boundingBox())!
    if (Math.abs(b.x - g.x) < 4 && b.y < g.y) handle = b // the bar right above the Mapas group
  }
  const hx = handle!.x + handle!.width / 2
  const hy = handle!.y + handle!.height / 2
  await master.page.mouse.move(hx, hy)
  await master.page.mouse.down()
  await humanMove(master.page, hx, hy, hx + 200, hy + 150)
  await master.page.mouse.up()
  await expect.poll(async () => (await groupBox(master.page, 'mapas')).x).toBeGreaterThan(g.x + 100)
  // the table still has no tab and does not float
  expect(groupOf(await layout(master.page), 'mesa').floating).toBe(false)
})

test('[C9] PANEL-09 a closed panel leaves the screen and shows unmarked in "Painéis"; picking it opens it again', async () => {
  const { master } = await table()
  await master.page.getByTestId('close-chat').click()
  await expect.poll(async () => (await layout(master.page)).groups.flatMap((g) => g.panels)).not.toContain('chat')
  await expect(master.page.getByTestId('tab-chat')).toHaveCount(0)
  await master.page.getByTestId('panels-button').click()
  await expect(master.page.getByTestId('panels-menu-chat')).toHaveAttribute('aria-checked', 'false')
  await expect(master.page.getByTestId('panels-menu-dados')).toHaveAttribute('aria-checked', 'true')
  await master.page.getByTestId('panels-menu-chat').click()
  await expect(master.page.getByTestId('tab-chat')).toBeVisible()
  await expect(master.page.getByTestId('panels-menu-chat')).toHaveAttribute('aria-checked', 'true')
  // and from the menu an open panel closes
  await master.page.getByTestId('panels-menu-tokens').click()
  await expect(master.page.getByTestId('tab-tokens')).toHaveCount(0)
})

const STARTING = [['mesa'], ['conectados'], ['tokens', 'mapas', 'dados', 'chat']]

test('[C10] PANEL-10 "Restaurar layout" brings back the starting layout', async () => {
  const { master } = await table()
  await master.page.getByTestId('close-chat').click()
  await master.page.getByTestId('float-mapas').click()
  await expect.poll(async () => groupOf(await layout(master.page), 'mapas').floating).toBe(true)
  await master.page.getByTestId('panels-button').click()
  await master.page.getByTestId('panels-restore').click()
  await expect.poll(async () => (await layout(master.page)).groups.map((g) => g.panels)).toEqual(STARTING)
  const l = await layout(master.page)
  expect(l.groups.some((g) => g.floating)).toBe(false)
  expect(groupOf(l, 'mapas').active).toBe('mapas')
})

test('[C11] PANEL-11 the layout is saved per role on the computer and comes back at the next table', async () => {
  const first = await launch()
  await host(first.page, await freePort())
  await first.page.getByTestId('close-chat').click()
  await first.page.getByTestId('float-mapas').click()
  await expect.poll(async () => groupOf(await layout(first.page), 'mapas').floating).toBe(true)
  await first.app.close()
  // the next table on this computer, as master: the same arrangement
  const again = await launch({ userData: first.userData })
  await host(again.page, await freePort())
  await expect.poll(async () => groupOf(await layout(again.page), 'mapas').floating).toBe(true)
  expect((await layout(again.page)).groups.flatMap((g) => g.panels)).not.toContain('chat')
  const port = await freePort()
  await again.page.getByTestId('stop-host').click()
  // as a player on the same computer: the player's own (starting) layout
  const masterApp = await launch()
  await host(masterApp.page, port)
  await again.page.getByTestId('join-ip').fill('127.0.0.1')
  await again.page.getByTestId('join-port').fill(String(port))
  await again.page.getByTestId('join-name').fill('Ana')
  await again.page.getByTestId('join').click()
  await expect.poll(async () => (await layout(again.page)).groups.map((g) => g.panels)).toEqual([['mesa'], ['conectados'], ['dados', 'chat']])
})

test('[C12] PANEL-12 an unreadable saved layout, or one with another role\'s panels, gives the starting layout', async () => {
  const first = await launch()
  for (const bad of ['{ não é json', JSON.stringify({ grid: 1 }), 'null']) {
    await first.page.evaluate((v) => localStorage.setItem('mesa-layout-v1-master', v), bad)
    await host(first.page, await freePort())
    await expect.poll(async () => (await layout(first.page)).groups.map((g) => g.panels), bad).toEqual(STARTING)
    await first.page.getByTestId('stop-host').click()
    await expect(first.page.getByTestId('host')).toBeVisible()
  }
  // a player's saved layout holding the master's Tokens is not used
  const masterApp = await launch()
  const port = await freePort()
  await host(masterApp.page, port)
  await first.page.evaluate(() => {
    const m = localStorage.getItem('mesa-layout-v1-master')!
    localStorage.setItem('mesa-layout-v1-player', m)
  })
  await first.page.getByTestId('join-ip').fill('127.0.0.1')
  await first.page.getByTestId('join-port').fill(String(port))
  await first.page.getByTestId('join-name').fill('Ana')
  await first.page.getByTestId('join').click()
  await expect.poll(async () => (await layout(first.page)).groups.map((g) => g.panels)).toEqual([['mesa'], ['conectados'], ['dados', 'chat']])
})

test('[C14] PANEL-14 text typed in a panel stays when it is moved, floated, closed and reopened', async () => {
  const { master } = await table()
  await showPanel(master.page, 'dados')
  await master.page.getByTestId('dice-input').fill('3d6+2')
  const con = await groupBox(master.page, 'conectados')
  await dragTo(master.page, 'tab-dados', con.x + con.width / 2, con.y + con.height / 2 + 10)
  await expect.poll(async () => groupOf(await layout(master.page), 'dados').panels.sort()).toEqual(['conectados', 'dados'])
  await expect(master.page.getByTestId('dice-input')).toHaveValue('3d6+2')
  await master.page.getByTestId('float-dados').click()
  await expect.poll(async () => groupOf(await layout(master.page), 'dados').floating).toBe(true)
  await expect(master.page.getByTestId('dice-input')).toHaveValue('3d6+2')
  await master.page.getByTestId('close-dados').click()
  await master.page.getByTestId('panels-button').click()
  await master.page.getByTestId('panels-menu-dados').click()
  await showPanel(master.page, 'dados')
  await expect(master.page.getByTestId('dice-input')).toHaveValue('3d6+2')
})

async function say(page: Page, text: string): Promise<void> {
  await page.getByTestId('chat-input').fill(text)
  await page.getByTestId('chat-input').press('Enter')
  await expect(page.getByTestId('chat-input')).toHaveValue('') // sent: the input clears when the server accepts it
}
async function roll(page: Page, expr: string): Promise<void> {
  await page.getByTestId('dice-input').fill(expr)
  await page.getByTestId('dice-input').press('Enter')
}

test('[C15] PANEL-15 Dados holds the roller and only the rolls; Chat only the messages and the input', async () => {
  const { master, player } = await table()
  await roll(player.page, '1d6') // the player starts on Dados
  await showPanel(player.page, 'chat')
  await say(player.page, 'olá')
  for (const page of [master.page, player.page]) {
    await showPanel(page, 'dados')
    const dados = page.getByTestId('panel-dados')
    await expect(dados.getByTestId('log-entry')).toHaveCount(1)
    await expect(dados.getByTestId('log-entry')).toContainText('Ana rolou 1d6')
    await expect(dados.getByTestId('dice-input')).toBeVisible()
    await expect(dados.getByTestId('chat-input')).toHaveCount(0)
    await showPanel(page, 'chat')
    const chat = page.getByTestId('panel-chat')
    await expect(chat.getByTestId('log-entry')).toHaveText(['Ana: olá'])
    await expect(chat.getByTestId('chat-input')).toBeVisible()
    await expect(chat.getByTestId('dice-input')).toHaveCount(0)
  }
})

test('[C16] PANEL-16 a hidden Dados or Chat tab shows how many entries arrived, up to "9+"', async () => {
  const { master, player } = await table()
  // the player is on Dados; the master's messages count on the player's Chat tab
  await showPanel(master.page, 'chat')
  await expect(player.page.getByTestId('tab-count-chat')).toBeHidden()
  await say(master.page, 'um')
  await expect(player.page.getByTestId('tab-count-chat')).toHaveText('1')
  await say(master.page, 'dois')
  await expect(player.page.getByTestId('tab-count-chat')).toHaveText('2')
  for (let i = 3; i <= 10; i++) await say(master.page, `m${i}`)
  await expect(player.page.getByTestId('tab-count-chat')).toHaveText('9+')
  // the master is on Chat: rolls count on the master's Dados tab, not on the visible Chat
  await roll(player.page, '1d4')
  await roll(player.page, '1d4')
  await expect(master.page.getByTestId('tab-count-dados')).toHaveText('2')
  await expect(master.page.getByTestId('tab-count-chat')).toBeHidden()
  // the player sees Dados: their own rolls do not count there
  await expect(player.page.getByTestId('tab-count-dados')).toBeHidden()
})

test('[C17] PANEL-17 the count disappears when its panel is shown, also when shown by floating it', async () => {
  const { master, player } = await table()
  await showPanel(master.page, 'chat')
  await say(master.page, 'um')
  await expect(player.page.getByTestId('tab-count-chat')).toHaveText('1')
  await showPanel(player.page, 'chat')
  await expect(player.page.getByTestId('tab-count-chat')).toBeHidden()
  // a new message while Chat is shown adds nothing
  await say(master.page, 'dois')
  await player.page.waitForTimeout(300)
  await expect(player.page.getByTestId('tab-count-chat')).toBeHidden()
  // hidden again, then shown by floating its group
  await showPanel(player.page, 'dados')
  await say(master.page, 'três')
  await expect(player.page.getByTestId('tab-count-chat')).toHaveText('1')
  await player.page.getByTestId('close-dados').click()
  await expect(player.page.getByTestId('tab-count-chat')).toBeHidden() // Chat is the group's only panel now, so visible
})
