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

  it('[C11] ITEM-11 goblin.json with "inimigo", tamanho 2 makes a 2-cell enemy character with a ring; tipo "objeto" makes an object', async () => {
    const dir = folder({
      'goblin.png': png(),
      'goblin.json': JSON.stringify({ nome: 'Goblin Chefe', faccao: 'inimigo', tamanho: 2 }),
      'bau.png': png(),
      'bau.json': JSON.stringify({ tipo: 'objeto', tamanho: 0.75, faccao: 'npc' }),
      'porta.png': png(),
      'porta.json': JSON.stringify({ tipo: 'personagem', tamanho: 1.3 })
    })
    const byName = Object.fromEntries((await importTokenFolder(dir)).tokens.map((t) => [t.name, t]))
    expect(byName['Goblin Chefe']).toMatchObject({ kind: 'character', width: 2, ring: 'inimigo' })
    expect(byName.bau).toMatchObject({ kind: 'object', width: 0.75, ring: null }) // an object never has a ring
    expect(byName.porta).toMatchObject({ kind: 'character', width: 1.25, ring: null }) // rounded to a 0.25 step
  })

  it('[C28] TOK-03 no manifest, invalid JSON or values out of range fall back to personagem, 1 cell, no ring, field by field', async () => {
    const dir = folder({
      'sem.png': png(),
      'quebrado.png': png(),
      'quebrado.json': '{ isto não é json',
      'estranho.png': png(),
      'estranho.json': JSON.stringify({ faccao: 'x', tamanho: 25, tipo: 'cadeira' }),
      'pequeno.png': png(),
      'pequeno.json': JSON.stringify({ tamanho: 0.1 }),
      'meio.png': png(),
      'meio.json': JSON.stringify({ faccao: 'npc', tamanho: '2' })
    })
    const byName = Object.fromEntries((await importTokenFolder(dir)).tokens.map((t) => [t.name, t]))
    const plain = { kind: 'character', width: 1, ring: null }
    expect(byName.sem).toMatchObject(plain)
    expect(byName.quebrado).toMatchObject(plain)
    expect(byName.estranho).toMatchObject(plain)
    expect(byName.pequeno).toMatchObject(plain)
    expect(byName.meio).toMatchObject({ kind: 'character', width: 1, ring: 'npc' })
  })

  it('skips a .png that is not an image', async () => {
    const dir = folder({ 'ok.png': png(), 'falso.png': 'texto' })
    expect(await importTokenFolder(dir)).toMatchObject({ skipped: ['falso.png'] })
  })

  it('parseManifest keeps the file name when "nome" is empty', () => {
    expect(parseManifest(JSON.stringify({ nome: '  ' }), 'C:\\tokens\\orc.png')).toEqual({ name: 'orc', kind: 'character', width: 1, ring: null })
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
