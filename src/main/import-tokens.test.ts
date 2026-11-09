import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { parseManifest } from '../core/manifest'
import { parsePalette } from '../core/palette'
import { importTokenFolder } from './import'

function png(): Buffer {
  const p = new PNG({ width: 8, height: 8 })
  p.data.fill(180)
  return PNG.sync.write(p)
}
function folder(files: Record<string, Buffer | string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'mesa-tokens-'))
  mkdirSync(dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content)
  return dir
}

describe('importTokenFolder', () => {
  it('[C26] TOK-01 a folder with goblin.png and elfa.png lists the tokens "goblin" and "elfa"', async () => {
    const dir = folder({ 'goblin.png': png(), 'elfa.png': png(), 'notas.txt': 'x', 'goblin.json': '{}' })
    const { tokens } = await importTokenFolder(dir)
    expect(tokens.map((t) => t.name)).toEqual(['elfa', 'goblin'])
    expect(tokens.every((t) => t.bytes.length > 0)).toBe(true)
  })

  it('[C27] TOK-02 goblin.json with "inimigo" and size 2 makes goblin an enemy 2x2', async () => {
    const dir = folder({ 'goblin.png': png(), 'goblin.json': JSON.stringify({ nome: 'Goblin Chefe', faccao: 'inimigo', tamanho: 2 }) })
    const { tokens } = await importTokenFolder(dir)
    expect(tokens).toHaveLength(1)
    expect(tokens[0]).toMatchObject({ name: 'Goblin Chefe', faction: 'inimigo', size: 2 })
  })

  it('[C28] TOK-03 no manifest, invalid JSON or `faccao: "x"` give `neutro` and size 1', async () => {
    const dir = folder({
      'sem.png': png(),
      'quebrado.png': png(),
      'quebrado.json': '{ isto não é json',
      'estranho.png': png(),
      'estranho.json': JSON.stringify({ faccao: 'x', tamanho: 5 }),
      'meio.png': png(),
      'meio.json': JSON.stringify({ faccao: 'npc', tamanho: '2' })
    })
    const byName = Object.fromEntries((await importTokenFolder(dir)).tokens.map((t) => [t.name, t]))
    expect(byName.sem).toMatchObject({ faction: 'neutro', size: 1 })
    expect(byName.quebrado).toMatchObject({ faction: 'neutro', size: 1 })
    expect(byName.estranho).toMatchObject({ faction: 'neutro', size: 1 })
    expect(byName.meio).toMatchObject({ faction: 'npc', size: 1 })
  })

  it('skips a .png that is not an image', async () => {
    const dir = folder({ 'ok.png': png(), 'falso.png': 'texto' })
    expect(await importTokenFolder(dir)).toMatchObject({ skipped: ['falso.png'] })
  })

  it('parseManifest keeps the file name when "nome" is empty', () => {
    expect(parseManifest(JSON.stringify({ nome: '  ' }), 'C:\\tokens\\orc.png')).toEqual({ name: 'orc', faction: 'neutro', size: 1 })
  })
})

describe('parsePalette', () => {
  it('[C34] TOK-09 uses the palette colours, and without one grupo #3b82f6, inimigo #ef4444, npc #eab308, neutro #9ca3af', () => {
    const defaults = { grupo: '#3b82f6', inimigo: '#ef4444', npc: '#eab308', neutro: '#9ca3af' }
    expect(parsePalette(null)).toEqual(defaults)
    expect(parsePalette('não json')).toEqual(defaults)
    expect(parsePalette(JSON.stringify({ grupo: '#00FF00', inimigo: '#111111', npc: '#222222', neutro: '#333333' }))).toEqual({
      grupo: '#00ff00',
      inimigo: '#111111',
      npc: '#222222',
      neutro: '#333333'
    })
    expect(parsePalette(JSON.stringify({ faccoes: { inimigo: '#aa0000' }, npc: 'amarelo' }))).toEqual({ ...defaults, inimigo: '#aa0000' })
  })
})
