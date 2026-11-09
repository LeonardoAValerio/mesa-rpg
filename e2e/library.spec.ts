import { expect, test } from '@playwright/test'
import { textFile, tokenFolder } from './fixtures'
import { act, closeAll, masterAndPlayer, nextOpenDialog, putAsset, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

async function withMap(master: AppHandle): Promise<void> {
  const hash = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  await act(master.page, { type: 'fog/rect', x0: 0, y0: 0, x1: 800, y1: 600, mode: 'reveal' }) // a no-op since FOGD-01 (a new map has no fog); kept so the board is open either way
}

async function importKit(master: AppHandle): Promise<void> {
  const dir = tokenFolder(`kit-${Date.now()}`, {
    'goblin.png': solidPng(64, 64, [200, 30, 30]),
    'goblin.json': JSON.stringify({ faccao: 'inimigo', tamanho: 1 }),
    'elfa.png': solidPng(64, 64, [30, 30, 200])
  })
  await nextOpenDialog(master.app, [dir])
  await master.page.getByTestId('import-tokens').click()
  await expect(master.page.getByTestId('library-name')).toHaveText(['elfa', 'goblin'])
}

test('[C29] TOK-04 dragging a library token onto the map places it in the cell under the cursor in both windows', async () => {
  const { master, player } = await masterAndPlayer()
  await withMap(master)
  await importKit(master)
  const s = await snap(master.page)
  // map pixel (250, 350) is inside cell (2, 3), whose origin is (200, 300)
  const target = { x: 250 * s.camera.scale + s.camera.x, y: 350 * s.camera.scale + s.camera.y }
  await master.page.getByTestId('library-item').filter({ hasText: 'goblin' }).dragTo(master.page.getByTestId('board-canvas'), { targetPosition: target })
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens.map((t) => ({ name: t.name, x: t.x, y: t.y, ring: t.ring }))).toEqual([
      { name: 'goblin', x: 200, y: 300, ring: '#ef4444' }
    ])
  }
  // the player downloads the token image from the master (ASSET-02)
  await expect.poll(async () => (await player.page.evaluate(() => window.__mesaTest!.board()!.tokens[0]?.textured))).toBe(true)
})

test('a loaded palette changes the ring colours in every window (TOK-09)', async () => {
  const { master, player } = await masterAndPlayer()
  await withMap(master)
  await importKit(master)
  const s = await snap(master.page)
  const target = { x: 150 * s.camera.scale + s.camera.x, y: 150 * s.camera.scale + s.camera.y }
  await master.page.getByTestId('library-item').filter({ hasText: 'goblin' }).dragTo(master.page.getByTestId('board-canvas'), { targetPosition: target })
  await expect.poll(async () => (await snap(player.page)).tokens.length).toBe(1)
  await nextOpenDialog(master.app, [textFile('palette.json', JSON.stringify({ inimigo: '#123456' }))])
  await master.page.getByTestId('load-palette').click()
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens[0]?.ring).toBe('#123456')
  }
})
