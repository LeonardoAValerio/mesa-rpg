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
    expect(await scenes.load('Emboscada')).toEqual({ ok: true, scene: s, sound: [] })
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

  it('[C20] CAMP-20 a file changed since the scene was saved loads as it is now', async () => {
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

  const wav = (n: number): Buffer => Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([n, 0, 0, 0]), Buffer.from('WAVEfmt ', 'latin1')])
  const layer = (hash: string, volume: number, stoppingAt: number | null = null) => ({ hash, volume, startedAt: 0, stoppingAt })

  it('[C25] SOM-25 a saved scene keeps each playing layer\'s path and volume, not one fading out', async () => {
    const { dir, folder, scenes } = await campaign()
    mkdirSync(join(dir, 'musicas', 'Ambiente'), { recursive: true })
    writeFileSync(join(dir, 'musicas', 'Ambiente', 'chuva.wav'), wav(1))
    writeFileSync(join(dir, 'musicas', 'taverna.wav'), wav(2))
    writeFileSync(join(dir, 'musicas', 'batalha.wav'), wav(3))
    await folder.scan()
    const s = sceneWith(hashOf(png(40, 40, 30)), hashOf(png(200)))
    const layers = [layer(hashOf(wav(1)), 30), layer(hashOf(wav(2)), 60), layer(hashOf(wav(3)), 100, 5000)]
    expect(await scenes.save('Taverna', s, false, layers)).toEqual({ ok: true })
    const file = JSON.parse(readFileSync(join(dir, 'cenas', 'Taverna.cena'), 'utf8'))
    expect(file.sound).toEqual([{ path: 'musicas/Ambiente/chuva.wav', volume: 30 }, { path: 'musicas/taverna.wav', volume: 60 }])
    expect(await scenes.load('Taverna')).toEqual({ ok: true, scene: s, sound: [{ hash: hashOf(wav(1)), volume: 30 }, { hash: hashOf(wav(2)), volume: 60 }] })
  })

  it('SOM-27 a scene saved with no layers, or before sounds existed, loads with no layers', async () => {
    const { dir, scenes } = await campaign()
    const s = sceneWith(hashOf(png(40, 40, 30)), hashOf(png(200)))
    await scenes.save('Vazia', s, false, [])
    expect(await scenes.load('Vazia')).toEqual({ ok: true, scene: s, sound: [] })
    const old = JSON.parse(readFileSync(join(dir, 'cenas', 'Vazia.cena'), 'utf8'))
    delete old.sound // a 0.7.0 scene
    writeFileSync(join(dir, 'cenas', 'Antiga.cena'), JSON.stringify(old))
    expect(await scenes.load('Antiga')).toEqual({ ok: true, scene: s, sound: [] })
  })

  it('SOM-28 a scene whose music file is gone is refused with "Arquivo não encontrado: <caminho>"', async () => {
    const { dir, folder, scenes } = await campaign()
    writeFileSync(join(dir, 'musicas', 'taverna.wav'), wav(2))
    await folder.scan()
    await scenes.save('Taverna', sceneWith(hashOf(png(40, 40, 30)), hashOf(png(200))), false, [layer(hashOf(wav(2)), 60)])
    rmSync(join(dir, 'musicas', 'taverna.wav'))
    expect(await scenes.load('Taverna')).toEqual({ ok: false, error: 'Arquivo não encontrado: musicas/taverna.wav' })
  })
})
