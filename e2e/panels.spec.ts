import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, masterAndPlayer, putAsset, showPanel, solidPng, type AppHandle } from './helpers'
import type { LayoutSnapshot } from '../src/renderer/ui/layout'

test.afterEach(closeAll)

const layout = (page: Page): Promise<LayoutSnapshot> => page.evaluate(() => window.__mesaTest!.layout())
const groupOf = (l: LayoutSnapshot, id: string) => l.groups.find((g) => g.panels.includes(id))!

async function table(): Promise<{ master: AppHandle; player: AppHandle }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  return { master, player }
}

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
  await master.page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await master.page.mouse.down()
  await master.page.mouse.move(board!.x + board!.width / 2, board!.y + board!.height / 2, { steps: 12 })
  await master.page.mouse.up()
  await master.page.waitForTimeout(300)
  const l = await layout(master.page)
  expect(groupOf(l, 'mesa').panels).toEqual(['mesa'])
  expect(l.groups.every((g) => !(g.panels.includes('mesa') && g.floating))).toBe(true)
})
