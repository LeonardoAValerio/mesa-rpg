import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { coverAll, fogDims, rect } from './fog'
import { decodeMesa, encodeMesa } from './mesa-file'
import { DEFAULT_GRID, type Scene } from './types'

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex')
const mapBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 10, 20, 30, 40, 50])
const tokBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
const MAP = sha(mapBytes)
const TOK = sha(tokBytes)

function scene(): Scene {
  const grid = { ...DEFAULT_GRID, cell: 83.33, offsetX: 4, offsetY: 2, color: '#112233', opacity: 0.4 }
  const map = { hash: MAP, width: 2000, height: 1500 }
  return {
    map,
    grid,
    tokens: {
      a: { id: 'a', name: 'Guerreira', hash: TOK, faction: 'grupo', size: 1, col: 3, row: 4, owner: 'Ana', hidden: false },
      b: { id: 'b', name: 'Ogro', hash: TOK, faction: 'inimigo', size: 3, col: 10, row: 7, owner: null, hidden: true }
    },
    fog: rect(coverAll(fogDims(map, grid)), grid, 0, 0, 400, 300, 'reveal'),
    palette: { grupo: '#000001', inimigo: '#000002', npc: '#000003', neutro: '#000004' }
  }
}
const assets = (): Map<string, Uint8Array> => new Map([[MAP, mapBytes], [TOK, tokBytes]])

describe('.mesa file', () => {
  it('[C72] SAVE-01 the saved .mesa has the map, grid, tokens with every field, fog and each image in base64', () => {
    const file = JSON.parse(encodeMesa(scene(), assets()))
    expect(file.format).toBe('mesa')
    expect(file.version).toBe(1)
    expect(file.scene.map).toEqual({ hash: MAP, width: 2000, height: 1500 })
    expect(file.scene.grid).toEqual(scene().grid)
    expect(file.scene.tokens.a).toEqual({ id: 'a', name: 'Guerreira', hash: TOK, faction: 'grupo', size: 1, col: 3, row: 4, owner: 'Ana', hidden: false })
    expect(file.scene.tokens.b).toMatchObject({ size: 3, owner: null, hidden: true })
    expect(file.scene.fog).toEqual(scene().fog)
    expect(Object.keys(file.assets).sort()).toEqual([MAP, TOK].sort())
    expect(Buffer.from(file.assets[MAP], 'base64')).toEqual(Buffer.from(mapBytes))
    expect(Buffer.from(file.assets[TOK], 'base64')).toEqual(Buffer.from(tokBytes))
  })

  it('[C74] SAVE-03 encoding then decoding a scene gives back the same scene and the same image bytes', () => {
    const r = decodeMesa(encodeMesa(scene(), assets()), sha)
    if ('error' in r) throw new Error(r.error)
    expect(r.scene).toEqual(scene())
    expect(r.assets.get(MAP)).toEqual(mapBytes)
    expect(r.assets.get(TOK)).toEqual(tokBytes)
    const empty: Scene = { map: null, grid: DEFAULT_GRID, tokens: {}, fog: null, palette: null }
    const e = decodeMesa(encodeMesa(empty, new Map()), sha)
    expect('error' in e ? e : e.scene).toEqual(empty)
  })

  it('[C75] SAVE-04 invalid JSON, version 2 or an image with the wrong hash give "Arquivo .mesa inválido"', () => {
    const good = JSON.parse(encodeMesa(scene(), assets()))
    const bad = (mutate: (f: typeof good) => void): string => {
      const f = structuredClone(good)
      mutate(f)
      return JSON.stringify(f)
    }
    const cases = [
      '{ não é json',
      '',
      bad((f) => (f.version = 2)),
      bad((f) => (f.format = 'zip')),
      bad((f) => (f.assets[TOK] = Buffer.from([9, 9, 9]).toString('base64'))),
      bad((f) => delete f.assets[MAP]),
      bad((f) => (f.scene.tokens.a.size = 4)),
      bad((f) => (f.scene.tokens.a.faction = 'pirata')),
      bad((f) => (f.assets[MAP] = '%%%')),
      bad((f) => (f.scene.tokens.a.id = 'outro'))
    ]
    for (const text of cases) expect(decodeMesa(text, sha), text.slice(0, 40)).toEqual({ error: 'Arquivo .mesa inválido' })
  })
})
