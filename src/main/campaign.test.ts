import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, truncateSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetStore, sha256 } from './asset-store'
import { CampaignFolder } from './campaign'
import { readSettings, writeSettings } from './settings'

function png(w = 8, h = 8, v = 120): Buffer {
  const p = new PNG({ width: w, height: h })
  p.data.fill(v)
  return PNG.sync.write(p)
}
const open: CampaignFolder[] = []
function folder(): { root: string; c: CampaignFolder; store: AssetStore } {
  const root = join(mkdtempSync(join(tmpdir(), 'mesa-camp-')), 'Mesa RPG')
  const store = new AssetStore()
  const c = new CampaignFolder(root, store, 100)
  open.push(c)
  return { root, c, store }
}
afterEach(() => {
  for (const c of open.splice(0)) c.close()
})
const put = (root: string, rel: string, data: Buffer | string): void => {
  const p = join(root, rel)
  mkdirSync(join(p, '..'), { recursive: true })
  writeFileSync(p, data)
}

describe('campaign folder', () => {
  it('lists the folders of Mesa RPG as campaigns, creating Mesa RPG when it is missing (CAMP-01)', async () => {
    const { root, c } = folder()
    expect(existsSync(root)).toBe(false)
    expect(await c.list()).toEqual([])
    expect(existsSync(root)).toBe(true)
    mkdirSync(join(root, 'Zeta'))
    mkdirSync(join(root, 'Alfa'))
    writeFileSync(join(root, 'notas.txt'), 'x') // a file is not a campaign
    expect(await c.list()).toEqual(['Alfa', 'Zeta'])
  })

  it('creates a campaign with its six folders, and refuses a bad or existing name (CAMP-02, CAMP-03)', async () => {
    const { root, c } = folder()
    expect(await c.create('Florestas Frias')).toEqual({ ok: true })
    expect((await readdir(join(root, 'Florestas Frias'))).sort()).toEqual(['cenas', 'efeitos', 'mapas', 'musicas', 'objetos', 'tokens'])
    expect(await c.create('florestas frias')).toEqual({ ok: false, error: 'Campanha já existe' })
    expect(await c.create('a/b')).toEqual({ ok: false, error: 'Nome inválido' })
    expect(await c.list()).toEqual(['Florestas Frias'])
  })

  it('opening a hand-made campaign creates the folders it lacks (CAMP-05)', async () => {
    const { root, c } = folder()
    mkdirSync(join(root, 'Feita à mão', 'mapas'), { recursive: true })
    await c.open('Feita à mão')
    expect((await readdir(join(root, 'Feita à mão'))).sort()).toEqual(['cenas', 'efeitos', 'mapas', 'musicas', 'objetos', 'tokens'])
  })

  it('remembers the last campaign in the settings file (CAMP-06)', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'mesa-set-')), 'settings.json')
    expect(await readSettings(file)).toEqual({})
    await writeSettings(file, { lastCampaign: 'Florestas Frias' })
    expect(await readSettings(file)).toEqual({ lastCampaign: 'Florestas Frias' })
    writeFileSync(file, '{ quebrado')
    expect(await readSettings(file)).toEqual({})
  })

  it('reads mapas, tokens and objetos with their subfolders as groups; objects from objetos unless the .json says otherwise (CAMP-08..10)', async () => {
    const { root, c, store } = folder()
    await c.create('C')
    const d = join(root, 'C')
    put(d, 'mapas/Florestas.png', png(40, 30))
    put(d, 'mapas/Regiões/Norte/Castelo.png', png(20, 10))
    put(d, 'tokens/goblin.png', png())
    put(d, 'tokens/goblin.json', JSON.stringify({ faccao: 'inimigo', tamanho: 2 }))
    put(d, 'tokens/Goblins/chefe.png', png(16, 24))
    put(d, 'tokens/porta.png', png())
    put(d, 'tokens/porta.json', JSON.stringify({ tipo: 'objeto' }))
    put(d, 'objetos/bau.png', png())
    put(d, 'objetos/estatua.png', png())
    put(d, 'objetos/estatua.json', JSON.stringify({ tipo: 'personagem', faccao: 'npc' }))
    const entries = await c.open('C')
    const by = Object.fromEntries(entries.map((e) => [e.path, e]))
    expect(Object.keys(by).sort()).toEqual([
      'mapas/Florestas.png', 'mapas/Regiões/Norte/Castelo.png', 'objetos/bau.png', 'objetos/estatua.png', 'tokens/Goblins/chefe.png', 'tokens/goblin.png', 'tokens/porta.png'
    ].sort())
    expect(by['mapas/Florestas.png']).toMatchObject({ section: 'mapas', group: '', name: 'Florestas', w: 40, h: 30 })
    expect(by['mapas/Regiões/Norte/Castelo.png']).toMatchObject({ group: 'Regiões/Norte', name: 'Castelo' })
    expect(by['tokens/goblin.png']).toMatchObject({ kind: 'character', width: 2, ring: 'inimigo', group: '' })
    expect(by['tokens/Goblins/chefe.png']).toMatchObject({ kind: 'character', group: 'Goblins', name: 'chefe', w: 16, h: 24 })
    expect(by['tokens/porta.png']).toMatchObject({ kind: 'object', ring: null })
    expect(by['objetos/bau.png']).toMatchObject({ kind: 'object', section: 'objetos' })
    expect(by['objetos/estatua.png']).toMatchObject({ kind: 'character', ring: 'npc' })
    // every image is in the store under its hash, for drops and the players' downloads
    for (const e of entries) expect(store.has(e.hash)).toBe(true)
    expect(by['tokens/goblin.png'].hash).toBe(sha256(new Uint8Array(png())))
    expect(c.pathOf(by['mapas/Florestas.png'].hash)).toBe('mapas/Florestas.png')
  })

  it('[C15] CAMP-15 a file that is not a readable image, or one over 50 MB, is not listed', async () => {
    const { root, c } = folder()
    await c.create('C')
    const d = join(root, 'C')
    put(d, 'tokens/ok.png', png())
    put(d, 'tokens/falso.png', 'não sou png')
    put(d, 'tokens/notas.txt', 'x')
    put(d, 'mapas/enorme.png', Buffer.concat([png(), Buffer.alloc(50 * 1024 * 1024 + 1)]))
    const entries = await c.open('C')
    expect(entries.map((e) => e.path)).toEqual(['tokens/ok.png'])
  })

  it('sees a file added, renamed or removed outside the app within 2 seconds (CAMP-11)', async () => {
    const { root, c } = folder()
    await c.create('C')
    const d = join(root, 'C')
    await c.open('C')
    const seen: string[][] = []
    c.onChange((es) => seen.push(es.map((e) => e.path)))
    const until = async (want: string[]): Promise<void> => {
      const t0 = Date.now()
      while (Date.now() - t0 < 2000) {
        if (JSON.stringify(seen.at(-1)) === JSON.stringify(want)) return
        await new Promise((r) => setTimeout(r, 50))
      }
      throw new Error(`not seen within 2 s: ${JSON.stringify(want)}; last ${JSON.stringify(seen.at(-1))}`)
    }
    put(d, 'tokens/Goblins/goblin.png', png())
    await until(['tokens/Goblins/goblin.png'])
    renameSync(join(d, 'tokens/Goblins/goblin.png'), join(d, 'tokens/Goblins/chefe.png'))
    await until(['tokens/Goblins/chefe.png'])
    rmSync(join(d, 'tokens/Goblins/chefe.png'))
    await until([])
  })

  it('adds files into a section, a repeated name becoming (2), (3) (CAMP-14)', async () => {
    const { root, c } = folder()
    await c.create('C')
    await c.open('C')
    const src = mkdtempSync(join(tmpdir(), 'mesa-src-'))
    writeFileSync(join(src, 'goblin.png'), png())
    writeFileSync(join(src, 'Goblin.PNG'), png(9, 9))
    expect(await c.addFiles('tokens', [join(src, 'goblin.png')])).toEqual(['tokens/goblin.png'])
    expect(await c.addFiles('tokens', [join(src, 'goblin.png'), join(src, 'Goblin.PNG')])).toEqual(['tokens/goblin (2).png', 'tokens/Goblin (3).PNG'])
    expect((await readdir(join(root, 'C', 'tokens'))).sort()).toEqual(['Goblin (3).PNG', 'goblin (2).png', 'goblin.png'])
    expect(c.all.map((e) => e.path).sort()).toEqual(['tokens/Goblin (3).PNG', 'tokens/goblin (2).png', 'tokens/goblin.png'])
  })
})

describe('sounds in the campaign folder', () => {
  const header = (kind: 'wav' | 'ogg' | 'mp3'): Buffer =>
    kind === 'wav' ? Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'latin1') : kind === 'ogg' ? Buffer.from('OggS\x00\x02rest', 'latin1') : Buffer.from('ID3\x03\x00\x00rest', 'latin1')

  it('SOM-01 lists musicas/ and efeitos/ by name without extension, subfolders as groups', async () => {
    const { root, c } = folder()
    await c.create('Mesa')
    put(join(root, 'Mesa'), 'musicas/Ambiente/chuva.mp3', header('mp3'))
    put(join(root, 'Mesa'), 'musicas/batalha.ogg', header('ogg'))
    put(join(root, 'Mesa'), 'efeitos/espada.wav', header('wav'))
    await c.open('Mesa')
    expect(c.sounds.map((s) => [s.section, s.group, s.name, s.path, s.type])).toEqual([
      ['efeitos', '', 'espada', 'efeitos/espada.wav', 'wav'],
      ['musicas', '', 'batalha', 'musicas/batalha.ogg', 'ogg'],
      ['musicas', 'Ambiente', 'chuva', 'musicas/Ambiente/chuva.mp3', 'mp3']
    ])
    expect(c.all).toEqual([]) // sounds are not images
    expect(c.pathOf(c.sounds[0].hash)).toBe('efeitos/espada.wav')
  })

  it('[C3] SOM-03 files that are not MP3, OGG, WAV or M4A, or over 100 MB, are not listed; exactly 100 MB is', async () => {
    const { root, c } = folder()
    await c.create('Mesa')
    const dir = join(root, 'Mesa')
    put(dir, 'musicas/ok.wav', header('wav'))
    put(dir, 'musicas/falso.mp3', png()) // an image renamed
    put(dir, 'musicas/notas.txt', 'texto')
    put(dir, 'efeitos/vazio.ogg', '')
    const big = (name: string, size: number): void => {
      put(dir, name, header('wav'))
      truncateSync(join(dir, name), size)
    }
    big('musicas/limite.wav', 100 * 1024 * 1024)
    big('musicas/grande.wav', 100 * 1024 * 1024 + 1)
    await c.open('Mesa')
    expect(c.sounds.map((s) => s.path)).toEqual(['musicas/limite.wav', 'musicas/ok.wav'])
  })

  it('SOM-04 "Adicionar arquivos" copies into musicas/ or efeitos/, a repeat named (2)', async () => {
    const { root, c } = folder()
    await c.create('Mesa')
    await c.open('Mesa')
    const src = join(mkdtempSync(join(tmpdir(), 'mesa-src-')), 'chuva.wav')
    writeFileSync(src, header('wav'))
    expect(await c.addFiles('musicas', [src])).toEqual(['musicas/chuva.wav'])
    expect(await c.addFiles('musicas', [src])).toEqual(['musicas/chuva (2).wav'])
    expect(await c.addFiles('efeitos', [src])).toEqual(['efeitos/chuva.wav'])
    expect(c.sounds.map((s) => s.path).sort()).toEqual(['efeitos/chuva.wav', 'musicas/chuva (2).wav', 'musicas/chuva.wav'])
    expect(existsSync(join(root, 'Mesa', 'musicas', 'chuva (2).wav'))).toBe(true)
  })
})
