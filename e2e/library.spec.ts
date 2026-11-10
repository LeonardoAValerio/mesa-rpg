import { expect, test } from '@playwright/test'
import { textFile, tokenFolder } from './fixtures'
import { act, closeAll, showPanel, masterAndPlayer, nextOpenDialog, putAsset, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

async function withMap(master: AppHandle): Promise<void> {
  const hash = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  await act(master.page, { type: 'fog/revealAll' }) // a no-op since FOGD-01 (a new map has no fog); kept so the board is open either way
}

async function importKit(master: AppHandle): Promise<void> {
  await showPanel(master.page, 'tokens')
  const dir = tokenFolder(`kit-${Date.now()}`, {
    'goblin.png': solidPng(64, 64, [200, 30, 30]),
    'goblin.json': JSON.stringify({ faccao: 'inimigo', tamanho: 1 }),
    'elfa.png': solidPng(64, 64, [30, 30, 200]),
    'bau.png': solidPng(64, 32, [120, 80, 20]),
    'bau.json': JSON.stringify({ tipo: 'objeto', tamanho: 1 })
  })
  await nextOpenDialog(master.app, [dir])
  await master.page.getByTestId('import-tokens').click()
  await expect(master.page.getByTestId('library-name')).toHaveText(['bau', 'elfa', 'goblin'])
}

test('[C10] ITEM-10 a library drop puts the item\'s centre under the cursor, snapping a character, in both windows', async () => {
  const { master, player } = await masterAndPlayer()
  await withMap(master)
  await importKit(master)
  const s = await snap(master.page)
  const at = (x: number, y: number) => ({ x: x * s.camera.scale + s.camera.x, y: y * s.camera.scale + s.camera.y })
  // goblin (1 cell) dropped at (240, 360): its edges snap to the lines at 200 and 300, so its centre is (250, 350)
  await master.page.getByTestId('library-item').filter({ hasText: 'goblin' }).dragTo(master.page.getByTestId('board-canvas'), { targetPosition: at(240, 360) })
  // the chest (an object) dropped at (433, 211) stays there
  await master.page.getByTestId('library-item').filter({ hasText: 'bau' }).dragTo(master.page.getByTestId('board-canvas'), { targetPosition: at(433, 211) })
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens.length).toBe(2)
    const items = Object.fromEntries((await snap(page)).tokens.map((t) => [t.name, t]))
    expect([items.goblin.x, items.goblin.y]).toEqual([250, 350])
    expect(items.goblin.ring).toBe('#ef4444')
    expect(Math.abs(items.bau.x - 433)).toBeLessThan(1.5)
    expect(Math.abs(items.bau.y - 211)).toBeLessThan(1.5)
    expect(items.bau.kind).toBe('object')
  }
  // the player downloads the images from the master (ASSET-02)
  await expect.poll(async () => (await player.page.evaluate(() => window.__mesaTest!.board()!.tokens.every((t) => t.textured)))).toBe(true)
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
