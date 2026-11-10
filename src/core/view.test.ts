import { describe, expect, it } from 'vitest'
import { diffViews, viewFor } from './view'
import { emptyScene, type Actor, type Scene, type Token } from './types'

const master: Actor = { role: 'master', name: 'Mestre' }
const ana: Actor = { role: 'player', name: 'Ana' }
const tok = (id: string, extra: Partial<Token> = {}): Token => ({
  id,
  name: id,
  hash: 'c'.repeat(64),
  kind: 'character',
  x: 50,
  y: 50,
  width: 1,
  rotation: 0,
  ring: null,
  owner: null,
  hidden: false,
  movement: 'free',
  ...extra
})
const sceneWith = (...tokens: Token[]): Scene => ({
  ...emptyScene(),
  map: { hash: 'd'.repeat(64), width: 800, height: 600 },
  tokens: Object.fromEntries(tokens.map((t) => [t.id, t]))
})

describe('viewFor', () => {
  it('leaves hidden tokens out of a player view and keeps them, flagged, in the master view (PERM-05)', () => {
    const s = sceneWith(tok('goblin', { hidden: true }), tok('elfa'))
    expect(Object.keys(viewFor(s, ana, []).tokens)).toEqual(['elfa'])
    const mv = viewFor(s, master, [])
    expect(Object.keys(mv.tokens).sort()).toEqual(['elfa', 'goblin'])
    expect(mv.tokens.goblin.hidden).toBe(true)
  })

  it('carries map, grid, players and the viewer role', () => {
    const s = sceneWith()
    expect(viewFor(s, ana, ['Mestre', 'Ana'])).toEqual({
      role: 'player',
      map: s.map,
      grid: s.grid,
      tokens: {},
      fog: null,
      palette: null,
      players: ['Mestre', 'Ana'],
      sound: { layers: [] }
    })
  })
})

describe('diffViews', () => {
  it('hiding a token removes it for the player; showing it adds it back (PERM-05, PERM-06)', () => {
    const shown = sceneWith(tok('goblin'))
    const hidden = sceneWith(tok('goblin', { hidden: true }))
    expect(diffViews(viewFor(shown, ana, []), viewFor(hidden, ana, []))).toEqual([{ op: 'token/remove', id: 'goblin' }])
    expect(diffViews(viewFor(hidden, ana, []), viewFor(shown, ana, []))).toEqual([{ op: 'token/upsert', token: tok('goblin') }])
    expect(diffViews(viewFor(shown, master, []), viewFor(hidden, master, []))).toEqual([
      { op: 'token/upsert', token: tok('goblin', { hidden: true }) }
    ])
  })

  it('is empty when nothing the viewer sees changed, and lists map, grid and players changes', () => {
    const a = sceneWith(tok('x', { hidden: true }))
    const b = sceneWith(tok('x', { hidden: true, x: 450 }))
    expect(diffViews(viewFor(a, ana, ['Ana']), viewFor(b, ana, ['Ana']))).toEqual([])
    const c = { ...a, grid: { ...a.grid, cell: 90 }, map: { hash: 'e'.repeat(64), width: 10, height: 10 } }
    expect(diffViews(viewFor(a, ana, ['Ana']), viewFor(c, ana, ['Ana', 'Bia']))).toEqual([
      { op: 'map', map: c.map },
      { op: 'grid', grid: c.grid },
      { op: 'players', players: ['Ana', 'Bia'] }
    ])
  })
})

describe('sound in the view (SOM-06, SOM-12)', () => {
  it('every viewer gets the same layers, and a change of layers is one sound op', () => {
    const sound = { layers: [{ hash: 'a'.repeat(64), volume: 100, startedAt: 5, stoppingAt: null }] }
    const s = emptyScene()
    expect(viewFor(s, ana, [], sound).sound).toEqual(sound)
    expect(viewFor(s, master, [], sound).sound).toEqual(sound)
    const before = viewFor(s, ana, [])
    expect(before.sound).toEqual({ layers: [] })
    expect(diffViews(before, viewFor(s, ana, [], sound))).toEqual([{ op: 'sound', sound }])
    expect(diffViews(viewFor(s, ana, [], sound), viewFor(s, ana, [], sound))).toEqual([])
  })
})
