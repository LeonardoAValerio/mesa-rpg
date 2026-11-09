import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { toBase64 } from './base64'
import { fogAt } from './fog'
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
      a: { id: 'a', name: 'Guerreira', hash: TOK, kind: 'character', x: 291.5, y: 377.3, width: 1.25, rotation: 30, ring: 'grupo', owner: 'Ana', hidden: false, movement: 'free' },
      b: { id: 'b', name: 'Baú', hash: TOK, kind: 'object', x: 900, y: 650.5, width: 0.5, rotation: 345, ring: null, owner: null, hidden: true, movement: 'locked' },
      c: { id: 'c', name: 'Ogro', hash: TOK, kind: 'character', x: 1000, y: 700, width: 3, rotation: 0, ring: null, owner: null, hidden: false, movement: 'master' }
    },
    fog: {
      base: 'covered',
      shapes: [
        { kind: 'rect', mode: 'reveal', x: 0, y: 0, w: 400, h: 300 },
        { kind: 'stroke', mode: 'cover', radius: 20, points: [50, 50, 120, 80] },
        { kind: 'poly', mode: 'reveal', points: [500, 500, 700, 520, 600, 650] }
      ]
    },
    palette: { grupo: '#000001', inimigo: '#000002', npc: '#000003', neutro: '#000004' }
  }
}
const assets = (): Map<string, Uint8Array> => new Map([[MAP, mapBytes], [TOK, tokBytes]])

describe('.mesa file', () => {
  it('[C72] SAVE-01 the saved .mesa has the map, grid, tokens with every field, fog and each image in base64', () => {
    const file = JSON.parse(encodeMesa(scene(), assets()))
    expect(file.format).toBe('mesa')
    expect(file.version).toBe(3)
    expect(file.scene.map).toEqual({ hash: MAP, width: 2000, height: 1500 })
    expect(file.scene.grid).toEqual(scene().grid)
    expect(file.scene.tokens.a).toEqual(scene().tokens.a)
    expect(file.scene.tokens.b).toMatchObject({ kind: 'object', owner: null, hidden: true, movement: 'locked' })
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

  it('[C75] SAVE-04 invalid JSON, version 4 or an image with the wrong hash give "Arquivo .mesa inválido"', () => {
    const good = JSON.parse(encodeMesa(scene(), assets()))
    const bad = (mutate: (f: typeof good) => void): string => {
      const f = structuredClone(good)
      mutate(f)
      return JSON.stringify(f)
    }
    const cases = [
      '{ não é json',
      '',
      bad((f) => (f.version = 4)),
      bad((f) => (f.scene.fog.shapes[0].kind = 'circle')),
      bad((f) => (f.format = 'zip')),
      bad((f) => (f.assets[TOK] = Buffer.from([9, 9, 9]).toString('base64'))),
      bad((f) => delete f.assets[MAP]),
      bad((f) => (f.scene.tokens.a.kind = 'cadeira')),
      bad((f) => (f.scene.tokens.a.ring = 'pirata')),
      bad((f) => (f.scene.tokens.a.movement = 'solto')),
      bad((f) => delete f.scene.tokens.a.x),
      bad((f) => (f.assets[MAP] = '%%%')),
      bad((f) => (f.scene.tokens.a.id = 'outro'))
    ]
    for (const text of cases) expect(decodeMesa(text, sha), text.slice(0, 40)).toEqual({ error: 'Arquivo .mesa inválido' })
  })

  it('[C18] FOGS-11 saving and loading keeps the fog shapes in the same order', () => {
    const r = decodeMesa(encodeMesa(scene(), assets()), sha)
    if ('error' in r) throw new Error(r.error)
    expect(r.scene.fog).toEqual(scene().fog)
    expect(r.scene.fog!.shapes.map((s) => s.kind)).toEqual(['rect', 'stroke', 'poly'])
  })

  it('[C17] FOGS-10 a version 1 file loads with its cell fog as covered rectangles over the same areas', () => {
    // what 0.2.1 saved: 4x3 cells of 100 px, all covered but the top-left 2x2 block
    const grid = { ...DEFAULT_GRID, cell: 100, offsetX: 0, offsetY: 0 }
    const bits = new Uint8Array(2)
    for (let i = 0; i < 12; i++) {
      const col = i % 4
      const row = Math.floor(i / 4)
      if (!(col < 2 && row < 2)) bits[i >> 3] |= 1 << (i & 7)
    }
    const v1 = {
      format: 'mesa',
      version: 1,
      scene: { map: { hash: MAP, width: 400, height: 300 }, grid, tokens: {}, fog: { colStart: 0, rowStart: 0, cols: 4, rows: 3, covered: toBase64(bits) }, palette: null },
      assets: { [MAP]: Buffer.from(mapBytes).toString('base64') }
    }
    const r = decodeMesa(JSON.stringify(v1), sha)
    if ('error' in r) throw new Error(r.error)
    const at = (x: number, y: number): boolean => fogAt(r.scene.fog!, x, y)
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        expect(at(col * 100 + 50, row * 100 + 50), `cell ${col},${row}`).toBe(!(col < 2 && row < 2))
      }
    }
    expect(r.scene.fog!.shapes.every((s) => s.kind === 'rect' && s.mode === 'cover')).toBe(true)
  })

  it('[C21] ITEM-21 saving and loading keeps every item field: kind, position, size, rotation, ring, owner, Movimento, hidden', () => {
    const r = decodeMesa(encodeMesa(scene(), assets()), sha)
    if ('error' in r) throw new Error(r.error)
    expect(r.scene.tokens).toEqual(scene().tokens)
  })

  it('[C20] ITEM-20 a version 2 (and 1) file loads its tokens as characters centred on their cells, as wide as their size, with their faction as ring, Livre', () => {
    const grid = { ...DEFAULT_GRID, cell: 100, offsetX: 0, offsetY: 0 }
    const oldTokens = {
      g: { id: 'g', name: 'Goblin', hash: TOK, faction: 'inimigo', size: 2, col: 3, row: 4, owner: 'Ana', hidden: true },
      n: { id: 'n', name: 'Velho', hash: TOK, faction: 'neutro', size: 1, col: 0, row: 0, owner: null, hidden: false }
    }
    for (const [version, fog] of [[2, { base: 'revealed', shapes: [] }], [1, null]] as const) {
      const old = {
        format: 'mesa',
        version,
        scene: { map: { hash: MAP, width: 800, height: 600 }, grid, tokens: oldTokens, fog, palette: null },
        assets: { [MAP]: Buffer.from(mapBytes).toString('base64'), [TOK]: Buffer.from(tokBytes).toString('base64') }
      }
      const r = decodeMesa(JSON.stringify(old), sha)
      if ('error' in r) throw new Error(`v${version}: ${r.error}`)
      expect(r.scene.tokens.g, `v${version}`).toEqual({ id: 'g', name: 'Goblin', hash: TOK, kind: 'character', x: 400, y: 500, width: 2, rotation: 0, ring: 'inimigo', owner: 'Ana', hidden: true, movement: 'free' })
      expect(r.scene.tokens.n, `v${version}`).toMatchObject({ kind: 'character', x: 50, y: 50, width: 1, ring: 'neutro', movement: 'free' })
    }
  })
})
