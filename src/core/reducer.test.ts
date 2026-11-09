import { describe, expect, it } from 'vitest'
import type { Action } from './protocol'
import { applyAction, NO_PERMISSION, OUTSIDE_MAP, type ReducerCtx } from './reducer'
import { emptyScene, type Actor, type Scene } from './types'

const H = 'b'.repeat(64)
const master: Actor = { role: 'master', name: 'Mestre' }
const ana: Actor = { role: 'player', name: 'Ana' }

function ctx(): ReducerCtx {
  let n = 0
  return { rng: () => 1, now: () => 0, newId: () => `t${++n}` }
}

/** 800x600 map, 100 px cells; "t1" is Ana's Guerreira at (1,1), "t2" the master's Goblin at (3,3). */
function scene(): Scene {
  const c = ctx()
  let s = emptyScene()
  const step = (a: Action): void => {
    const r = applyAction(s, master, a, c)
    if (!r.ok) throw new Error(r.reason)
    s = r.scene
  }
  step({ type: 'map/set', hash: H, width: 800, height: 600, grid: { cell: 100 } })
  step({ type: 'token/place', hash: H, name: 'Guerreira', faction: 'grupo', size: 1, col: 1, row: 1 })
  step({ type: 'token/place', hash: H, name: 'Goblin', faction: 'inimigo', size: 1, col: 3, row: 3 })
  step({ type: 'token/owner', id: 't1', owner: 'Ana' })
  return s
}

describe('applyAction', () => {
  it('[C35] TOK-10 refuses a move off the map and keeps the token where it was', () => {
    const s = scene()
    for (const [col, row] of [[8, 0], [-1, 2], [2, 6], [100, 100]]) {
      const r = applyAction(s, master, { type: 'token/move', id: 't2', col, row }, ctx())
      expect(r).toEqual({ ok: false, reason: OUTSIDE_MAP })
    }
    expect(s.tokens.t2).toMatchObject({ col: 3, row: 3 })
    const placed = applyAction(s, master, { type: 'token/place', hash: H, name: 'x', faction: 'npc', size: 1, col: 9, row: 9 }, ctx())
    expect(placed).toEqual({ ok: false, reason: OUTSIDE_MAP })
  })

  it('[C44] PERM-02 lets the master move, edit, hide, show and remove a token that is not theirs', () => {
    let s = scene()
    const c = ctx()
    const apply = (a: Action): void => {
      const r = applyAction(s, master, a, c)
      expect(r.ok, a.type).toBe(true)
      if (r.ok) s = r.scene
    }
    apply({ type: 'token/move', id: 't1', col: 5, row: 2 })
    expect(s.tokens.t1).toMatchObject({ col: 5, row: 2, owner: 'Ana' })
    apply({ type: 'token/update', id: 't1', name: 'Chefe', faction: 'npc', size: 2 })
    expect(s.tokens.t1).toMatchObject({ name: 'Chefe', faction: 'npc', size: 2 })
    apply({ type: 'token/hide', id: 't1' })
    expect(s.tokens.t1.hidden).toBe(true)
    apply({ type: 'token/show', id: 't1' })
    expect(s.tokens.t1.hidden).toBe(false)
    apply({ type: 'token/remove', id: 't1' })
    expect(s.tokens.t1).toBeUndefined()
  })

  it('lets a player move their own token and snaps to whole cells (TOK-05)', () => {
    const r = applyAction(scene(), ana, { type: 'token/move', id: 't1', col: 2, row: 4 }, ctx())
    expect(r.ok && r.scene.tokens.t1).toMatchObject({ col: 2, row: 4 })
  })

  it('refuses a player moving a token that is not theirs (PERM-03)', () => {
    const s = scene()
    expect(applyAction(s, ana, { type: 'token/move', id: 't2', col: 0, row: 0 }, ctx())).toEqual({ ok: false, reason: NO_PERMISSION })
  })

  it('[C46] PERM-04 refuses every master-only action from a player and leaves the scene untouched', () => {
    const s = scene()
    const before = JSON.stringify(s)
    const masterOnly: Action[] = [
      { type: 'token/place', hash: H, name: 'x', faction: 'npc', size: 1, col: 0, row: 0 },
      { type: 'token/update', id: 't1', name: 'x' },
      { type: 'token/remove', id: 't1' },
      { type: 'token/hide', id: 't1' },
      { type: 'token/show', id: 't1' },
      { type: 'token/owner', id: 't2', owner: 'Ana' },
      { type: 'grid/set', grid: { cell: 50 } },
      { type: 'map/set', hash: H, width: 10, height: 10 },
      { type: 'fog/brush', x: 0, y: 0, radius: 2, mode: 'reveal' },
      { type: 'fog/rect', x0: 0, y0: 0, x1: 100, y1: 100, mode: 'reveal' },
      { type: 'fog/coverAll' }
    ]
    for (const a of masterOnly) expect(applyAction(s, ana, a, ctx()), a.type).toEqual({ ok: false, reason: NO_PERMISSION })
    expect(JSON.stringify(s)).toBe(before)
  })

  it('clamps grid values set by the master (MAP-05, MAP-06)', () => {
    const r = applyAction(scene(), master, { type: 'grid/set', grid: { cell: 900, opacity: 2 } }, ctx())
    expect(r.ok && r.scene.grid).toMatchObject({ cell: 500, opacity: 1 })
  })
})
