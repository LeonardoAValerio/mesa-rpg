import { describe, expect, it } from 'vitest'
import { diffViews, viewFor } from './view'
import { emptyScene, type Actor, type Scene, type Token } from './types'

const master: Actor = { role: 'master', name: 'Mestre' }
const ana: Actor = { role: 'player', name: 'Ana' }
const tok = (id: string, extra: Partial<Token> = {}): Token => ({
  id,
  name: id,
  hash: 'c'.repeat(64),
  faction: 'inimigo',
  size: 1,
  col: 0,
  row: 0,
  owner: null,
  hidden: false,
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
      players: ['Mestre', 'Ana']
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
    const b = sceneWith(tok('x', { hidden: true, col: 4 }))
    expect(diffViews(viewFor(a, ana, ['Ana']), viewFor(b, ana, ['Ana']))).toEqual([])
    const c = { ...a, grid: { ...a.grid, cell: 90 }, map: { hash: 'e'.repeat(64), width: 10, height: 10 } }
    expect(diffViews(viewFor(a, ana, ['Ana']), viewFor(c, ana, ['Ana', 'Bia']))).toEqual([
      { op: 'map', map: c.map },
      { op: 'grid', grid: c.grid },
      { op: 'players', players: ['Ana', 'Bia'] }
    ])
  })
})
