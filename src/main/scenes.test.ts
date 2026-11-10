import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_GRID, type Scene } from '../core/types'
import { AssetStore, sha256 } from './asset-store'
import { CampaignFolder } from './campaign'
import { CampaignScenes, MISSING_FILE } from './scenes'

function png(v: number, w = 8, h = 8): Buffer {
  const p = new PNG({ width: w, height: h })
  p.data.fill(v)
  return PNG.sync.write(p)
}
const opened: CampaignFolder[] = []
afterEach(() => {
  for (const c of opened.splice(0)) c.close()
})
async function campaign(): Promise<{ dir: string; folder: CampaignFolder; scenes: CampaignScenes; store: AssetStore }> {
  const root = join(mkdtempSync(join(tmpdir(), 'mesa-cenas-')), 'Mesa RPG')
  const store = new AssetStore()
  const folder = new CampaignFolder(root, store, 100)
  opened.push(folder)
  await folder.create('C')
  const dir = join(root, 'C')
  mkdirSync(join(dir, 'tokens', 'Goblins'), { recursive: true })
  writeFileSync(join(dir, 'mapas', 'Floresta.png'), png(40, 40, 30))
  writeFileSync(join(dir, 'tokens', 'Goblins', 'goblin.png'), png(200))
  await folder.open('C')
  return { dir, folder, scenes: new CampaignScenes(folder, store), store }
}
function sceneWith(map: string, tok: string): Scene {
  return {
    map: { hash: map, width: 40, height: 40 },
    grid: { ...DEFAULT_GRID, cell: 10 },
    tokens: { g: { id: 'g', name: 'Goblin', hash: tok, kind: 'character', x: 15, y: 15, width: 1, rotation: 0, ring: 'inimigo', owner: null, hidden: false, movement: 'free' } },
    fog: { base: 'revealed', shapes: [] },
    palette: null
  }
}
const hashOf = (b: Buffer): string => sha256(new Uint8Array(b))

describe('campaign scenes', () => {
  it('saves a scene as cenas/<nome>.cena pointing at the campaign files, lists it and loads it back (CAMP-16, CAMP-18)', async () => {
    const { dir, scenes } = await campaign()
    const s = sceneWith(hashOf(png(40, 40, 30)), hashOf(png(200)))
    expect(await scenes.save('Emboscada', s, false)).toEqual({ ok: true })
    const file = JSON.parse(readFileSync(join(dir, 'cenas', 'Emboscada.cena'), 'utf8'))
    expect(Object.values(file.files).sort()).toEqual(['mapas/Floresta.png', 'tokens/Goblins/goblin.png'])
    expect(await scenes.list()).toEqual(['Emboscada'])
    expect(await scenes.load('Emboscada')).toEqual({ ok: true, scene: s })
  })

  it('an existing name needs replace, ignoring case; a bad name is refused (CAMP-17)', async () => {
    const { scenes } = await campaign()
    const s = sceneWith(hashOf(png(40, 40, 30)), hashOf(png(200)))
    await scenes.save('Emboscada', s, false)
    expect(await scenes.save('emboscada', s, false)).toEqual({ ok: false, exists: true })
    expect(await scenes.save('emboscada', s, true)).toEqual({ ok: true })
    expect(await scenes.list()).toEqual(['Emboscada']) // the same file, not a second one
    expect(await scenes.save('a:b', s, false)).toEqual({ ok: false, error: 'Nome inválido' })
  })

  it('a scene whose file is gone is refused with "Arquivo não encontrado: <caminho>" (CAMP-19)', async () => {
    const { dir, scenes } = await campaign()
    await scenes.save('Emboscada', sceneWith(hashOf(png(40, 40, 30)), hashOf(png(200))), false)
    rmSync(join(dir, 'tokens', 'Goblins', 'goblin.png'))
    expect(await scenes.load('Emboscada')).toEqual({ ok: false, error: 'Arquivo não encontrado: tokens/Goblins/goblin.png' })
    expect(MISSING_FILE('x')).toBe('Arquivo não encontrado: x')
  })

  it('a file changed since the scene was saved loads as it is now (CAMP-20)', async () => {
    const { dir, scenes, store } = await campaign()
    await scenes.save('Emboscada', sceneWith(hashOf(png(40, 40, 30)), hashOf(png(200))), false)
    writeFileSync(join(dir, 'tokens', 'Goblins', 'goblin.png'), png(90)) // the master redrew the goblin
    const r = await scenes.load('Emboscada')
    if (!r.ok) throw new Error(r.error)
    expect(r.scene.tokens.g.hash).toBe(hashOf(png(90)))
    expect(store.has(hashOf(png(90)))).toBe(true)
    expect(r.scene.map!.hash).toBe(hashOf(png(40, 40, 30)))
  })

  it('[C22] CAMP-22 a scene with images from outside the campaign copies them into importados/ and points at them', async () => {
    const { dir, scenes, store, folder } = await campaign()
    const outsideMap = store.put(new Uint8Array(png(70, 12, 12)))
    const outsideTok = store.put(new Uint8Array(png(71)))
    expect(await scenes.save('Importada', sceneWith(outsideMap, outsideTok), false)).toEqual({ ok: true })
    const file = JSON.parse(readFileSync(join(dir, 'cenas', 'Importada.cena'), 'utf8'))
    expect(file.files[outsideMap]).toBe(`mapas/importados/importado-${outsideMap.slice(0, 8)}.png`)
    expect(file.files[outsideTok]).toBe(`tokens/importados/importado-${outsideTok.slice(0, 8)}.png`)
    expect(readFileSync(join(dir, 'mapas', 'importados', `importado-${outsideMap.slice(0, 8)}.png`))).toEqual(png(70, 12, 12))
    expect(folder.pathOf(outsideTok)).toBe(`tokens/importados/importado-${outsideTok.slice(0, 8)}.png`)
    // and it loads from there
    expect((await scenes.load('Importada')).ok).toBe(true)
  })
})
