import { describe, expect, it } from 'vitest'
import { LOCKED_ITEM, MASTER_ONLY_ITEM } from './items'
import type { Action } from './protocol'
import { applyAction, NO_PERMISSION, OUTSIDE_MAP, type ReducerCtx } from './reducer'
import { DEFAULT_GRID, emptyScene, type Actor, type Scene, type Token } from './types'

const H = 'b'.repeat(64)
const master: Actor = { role: 'master', name: 'Mestre' }
const ana: Actor = { role: 'player', name: 'Ana' }

function ctx(): ReducerCtx {
  let n = 0
  return { rng: () => 1, now: () => 0, newId: () => `t${++n}` }
}

/** 800x600 map, 100 px cells; "t1" is Ana's Guerreira at (150, 150), "t2" the Goblin at (350, 350), "t3" a chest object at (520, 240). */
function scene(): Scene {
  const c = ctx()
  let s = emptyScene()
  const step = (a: Action): void => {
    const r = applyAction(s, master, a, c)
    if (!r.ok) throw new Error(r.reason)
    s = r.scene
  }
  step({ type: 'map/set', hash: H, width: 800, height: 600, grid: { cell: 100 } })
  step({ type: 'token/place', hash: H, name: 'Guerreira', kind: 'character', x: 150, y: 150, width: 1, ring: 'grupo' })
  step({ type: 'token/place', hash: H, name: 'Goblin', kind: 'character', x: 350, y: 350, width: 1, ring: null })
  step({ type: 'token/place', hash: H, name: 'Baú', kind: 'object', x: 520, y: 240, width: 0.5, ring: 'inimigo' })
  step({ type: 'token/owner', id: 't1', owner: 'Ana' })
  return s
}
const run = (s: Scene, actor: Actor, a: Action): Scene => {
  const r = applyAction(s, actor, a, ctx())
  if (!r.ok) throw new Error(`${a.type}: ${r.reason}`)
  return r.scene
}

describe('applyAction', () => {
  it('[C19] ITEM-19 a placed item is Livre, unrotated and unowned; an object gets no ring', () => {
    const s = scene()
    expect(s.tokens.t2).toEqual({ id: 't2', name: 'Goblin', hash: H, kind: 'character', x: 350, y: 350, width: 1, rotation: 0, ring: null, owner: null, hidden: false, movement: 'free' })
    expect(s.tokens.t1).toMatchObject({ ring: 'grupo', movement: 'free' })
    expect(s.tokens.t3).toMatchObject({ kind: 'object', ring: null, width: 0.5, movement: 'free' })
  })

  it('[C35] TOK-10 refuses an item whose centre would leave the map and keeps it where it was', () => {
    const s = scene()
    for (const [x, y] of [[801, 300], [-1, 300], [400, 601], [4000, 4000]]) {
      expect(applyAction(s, master, { type: 'token/move', id: 't2', x, y }, ctx())).toEqual({ ok: false, reason: OUTSIDE_MAP })
    }
    expect(s.tokens.t2).toMatchObject({ x: 350, y: 350 })
    expect(applyAction(s, master, { type: 'token/move', id: 't2', x: 800, y: 0 }, ctx()).ok).toBe(true) // the edge is on the map
    const placed = applyAction(s, master, { type: 'token/place', hash: H, name: 'x', kind: 'object', x: 900, y: 10, width: 1, ring: null }, ctx())
    expect(placed).toEqual({ ok: false, reason: OUTSIDE_MAP })
  })

  it('[C14] ITEM-14 any player who sees a Livre item moves and rotates it, theirs or not, object or character', () => {
    let s = scene()
    s = run(s, ana, { type: 'token/move', id: 't2', x: 433.5, y: 120.25 }) // not hers, free position
    expect(s.tokens.t2).toMatchObject({ x: 433.5, y: 120.25 })
    s = run(s, ana, { type: 'token/rotate', id: 't3', rotation: 90 })
    expect(s.tokens.t3.rotation).toBe(90)
    s = run(s, ana, { type: 'token/move', id: 't3', x: 10, y: 10 })
    expect(s.tokens.t3).toMatchObject({ x: 10, y: 10 })
    // a hidden item is not seen, so not moved
    s = run(s, master, { type: 'token/hide', id: 't2' })
    expect(applyAction(s, ana, { type: 'token/move', id: 't2', x: 50, y: 50 }, ctx())).toEqual({ ok: false, reason: NO_PERMISSION })
    // nor one under the fog that is not hers
    s = run(s, master, { type: 'token/show', id: 't2' })
    s = run(s, master, { type: 'fog/coverAll' })
    expect(applyAction(s, ana, { type: 'token/rotate', id: 't2', rotation: 15 }, ctx())).toEqual({ ok: false, reason: NO_PERMISSION })
    expect(run(s, ana, { type: 'token/move', id: 't1', x: 160, y: 160 }).tokens.t1).toMatchObject({ x: 160, y: 160 }) // her own, under the fog
  })

  it('[C15] ITEM-15 a "Só mestre" item moves and rotates only for the master; a player gets "Só o mestre move este item"', () => {
    const s = run(scene(), master, { type: 'token/update', id: 't2', movement: 'master' })
    expect(applyAction(s, ana, { type: 'token/move', id: 't2', x: 50, y: 50 }, ctx())).toEqual({ ok: false, reason: 'Só o mestre move este item' })
    expect(applyAction(s, ana, { type: 'token/rotate', id: 't2', rotation: 15 }, ctx())).toEqual({ ok: false, reason: MASTER_ONLY_ITEM })
    expect(run(s, master, { type: 'token/move', id: 't2', x: 50, y: 50 }).tokens.t2).toMatchObject({ x: 50, y: 50 })
    expect(run(s, master, { type: 'token/rotate', id: 't2', rotation: 30 }).tokens.t2.rotation).toBe(30)
    // even for her own character
    const own = run(scene(), master, { type: 'token/update', id: 't1', movement: 'master' })
    expect(applyAction(own, ana, { type: 'token/move', id: 't1', x: 50, y: 50 }, ctx())).toEqual({ ok: false, reason: MASTER_ONLY_ITEM })
  })

  it('ITEM-16 a Travado item refuses every move and rotation, the master\'s too, with "Item travado"', () => {
    const s = run(scene(), master, { type: 'token/update', id: 't3', movement: 'locked' })
    for (const actor of [master, ana]) {
      expect(applyAction(s, actor, { type: 'token/move', id: 't3', x: 50, y: 50 }, ctx())).toEqual({ ok: false, reason: 'Item travado' })
      expect(applyAction(s, actor, { type: 'token/rotate', id: 't3', rotation: 15 }, ctx())).toEqual({ ok: false, reason: LOCKED_ITEM })
    }
    // the master unlocks it in the editor, and it moves again
    const open = run(s, master, { type: 'token/update', id: 't3', movement: 'free' })
    expect(run(open, ana, { type: 'token/move', id: 't3', x: 50, y: 50 }).tokens.t3).toMatchObject({ x: 50, y: 50 })
  })

  it('[C18] ITEM-18 a player\'s edits other than move and rotate are refused with "Sem permissão" and change nothing', () => {
    const s = scene()
    const before = JSON.stringify(s)
    const edits: Action[] = [
      { type: 'token/update', id: 't1', name: 'x' },
      { type: 'token/update', id: 't1', width: 3 },
      { type: 'token/update', id: 't1', ring: 'npc' },
      { type: 'token/update', id: 't1', kind: 'object' },
      { type: 'token/update', id: 't2', movement: 'free' },
      { type: 'token/update', id: 't2', rotation: 45 },
      { type: 'token/hide', id: 't1' },
      { type: 'token/show', id: 't1' },
      { type: 'token/owner', id: 't2', owner: 'Ana' },
      { type: 'token/remove', id: 't1' },
      { type: 'token/place', hash: H, name: 'x', kind: 'character', x: 10, y: 10, width: 1, ring: null }
    ]
    for (const a of edits) expect(applyAction(s, ana, a, ctx()), JSON.stringify(a)).toEqual({ ok: false, reason: NO_PERMISSION })
    expect(JSON.stringify(s)).toBe(before)
  })

  it('[C44] PERM-02 lets the master move, edit, hide, show and remove any item', () => {
    let s = scene()
    s = run(s, master, { type: 'token/move', id: 't1', x: 555, y: 222 })
    expect(s.tokens.t1).toMatchObject({ x: 555, y: 222, owner: 'Ana' })
    s = run(s, master, { type: 'token/update', id: 't1', name: 'Chefe', width: 2.3, rotation: 50, ring: 'npc', movement: 'master' })
    expect(s.tokens.t1).toMatchObject({ name: 'Chefe', width: 2.25, rotation: 45, ring: 'npc', movement: 'master' })
    s = run(s, master, { type: 'token/hide', id: 't1' })
    expect(s.tokens.t1.hidden).toBe(true)
    s = run(s, master, { type: 'token/show', id: 't1' })
    expect(s.tokens.t1.hidden).toBe(false)
    s = run(s, master, { type: 'token/remove', id: 't1' })
    expect(s.tokens.t1).toBeUndefined()
  })

  it('turning a character into an object drops its ring and owner; an object cannot get an owner or a ring', () => {
    let s = run(scene(), master, { type: 'token/update', id: 't1', kind: 'object' })
    expect(s.tokens.t1).toMatchObject({ kind: 'object', ring: null, owner: null })
    s = run(s, master, { type: 'token/update', id: 't1', ring: 'grupo' })
    expect(s.tokens.t1.ring).toBeNull()
    expect(applyAction(s, master, { type: 'token/owner', id: 't1', owner: 'Ana' }, ctx())).toEqual({ ok: false, reason: 'Objetos não têm dono' })
    s = run(s, master, { type: 'token/update', id: 't1', kind: 'character', ring: 'grupo' })
    expect(s.tokens.t1).toMatchObject({ kind: 'character', ring: 'grupo' })
  })

  it('[C46] PERM-04 refuses every master-only action from a player and leaves the scene untouched', () => {
    const s = scene()
    const before = JSON.stringify(s)
    const masterOnly: Action[] = [
      { type: 'grid/set', grid: { cell: 50 } },
      { type: 'map/set', hash: H, width: 10, height: 10 },
      { type: 'fog/shape', shape: { kind: 'rect', mode: 'cover', x: 0, y: 0, w: 100, h: 100 } },
      { type: 'fog/coverAll' },
      { type: 'fog/revealAll' }
    ]
    for (const a of masterOnly) expect(applyAction(s, ana, a, ctx()), a.type).toEqual({ ok: false, reason: NO_PERMISSION })
    expect(JSON.stringify(s)).toBe(before)
  })

  it('clamps grid values set by the master (MAP-05, MAP-06)', () => {
    const r = applyAction(scene(), master, { type: 'grid/set', grid: { cell: 900, opacity: 2 } }, ctx())
    expect(r.ok && r.scene.grid).toMatchObject({ cell: 500, opacity: 1 })
  })
})

describe('board selection rules (BRD)', () => {
  const ctx = { rng: () => 1, now: () => 1, newId: (() => { let n = 0; return () => `g${++n}` })() }
  const master = { role: 'master' as const, name: 'Mestre' }
  const ana = { role: 'player' as const, name: 'Ana' }
  const item = (id: string, extra: Partial<Token> = {}): Token => ({ id, name: id, hash: 'c'.repeat(64), kind: 'character', x: 150, y: 150, width: 1, rotation: 0, ring: null, owner: null, hidden: false, movement: 'free', ...extra })
  const base = (...tokens: Token[]): Scene => ({ ...emptyScene(), map: { hash: 'a'.repeat(64), width: 800, height: 600 }, grid: { ...DEFAULT_GRID, cell: 100 }, fog: null, tokens: Object.fromEntries(tokens.map((t) => [t.id, t])) })
  const run = (s: Scene, actor: typeof master | typeof ana, a: Action) => applyAction(s, actor, a, ctx)
  const ok = (r: ReturnType<typeof run>): Scene => {
    if (!r.ok) throw new Error(r.reason)
    return r.scene
  }

  it('BRD-07 grid visibility is the master\'s: a player\'s change is refused with "Sem permissão"', () => {
    const s = base()
    expect(ok(run(s, master, { type: 'grid/set', grid: { visible: false } })).grid.visible).toBe(false)
    expect(run(s, ana, { type: 'grid/set', grid: { visible: false } })).toEqual({ ok: false, reason: 'Sem permissão' })
  })

  it('BRD-06 a new map shows the grid again', () => {
    const hidden = ok(run(base(), master, { type: 'grid/set', grid: { visible: false } }))
    expect(ok(run(hidden, master, { type: 'map/set', hash: 'b'.repeat(64), width: 400, height: 300 })).grid.visible).toBe(true)
  })

  it('BRD-15 2+ items become one group, leaving their old groups; a group left with one item ends', () => {
    let s = ok(run(base(item('a'), item('b'), item('c')), master, { type: 'token/group', ids: ['a', 'b'] }))
    const g1 = s.tokens.a.group
    expect(g1).toBeTruthy()
    expect(s.tokens.b.group).toBe(g1)
    expect(s.tokens.c.group ?? null).toBeNull()
    s = ok(run(s, master, { type: 'token/group', ids: ['b', 'c'] }))
    expect(s.tokens.b.group).toBe(s.tokens.c.group)
    expect(s.tokens.b.group).not.toBe(g1)
    expect(s.tokens.a.group).toBeNull() // its group of one ended
    expect(run(s, master, { type: 'token/group', ids: ['a', 'a'] })).toEqual({ ok: false, reason: 'Selecione 2 ou mais itens' })
    expect(run(s, master, { type: 'token/group', ids: ['a', 'zz'] })).toEqual({ ok: false, reason: 'Token não existe' })
  })

  it('BRD-16 grouping an item the actor may not move, or cannot see, is refused with "Sem permissão" and changes nothing', () => {
    const s = base(item('mine', { owner: 'Ana' }), item('door', { kind: 'object', movement: 'master' }), item('lock', { movement: 'locked' }), item('ghost', { hidden: true }))
    for (const other of ['door', 'lock', 'ghost']) expect(run(s, ana, { type: 'token/group', ids: ['mine', other] }), other).toEqual({ ok: false, reason: 'Sem permissão' })
    expect(run(s, master, { type: 'token/group', ids: ['mine', 'lock'] })).toEqual({ ok: false, reason: 'Sem permissão' }) // locked: nobody moves it
    expect(ok(run(s, master, { type: 'token/group', ids: ['mine', 'door'] })).tokens.door.group).toBeTruthy()
  })

  it('BRD-19 ungroup needs every member movable by the actor', () => {
    const s = ok(run(base(item('horse'), item('door', { movement: 'master' })), master, { type: 'token/group', ids: ['horse', 'door'] }))
    const g = s.tokens.horse.group!
    expect(run(s, ana, { type: 'token/ungroup', group: g })).toEqual({ ok: false, reason: 'Sem permissão' })
    const u = ok(run(s, master, { type: 'token/ungroup', group: g }))
    expect([u.tokens.horse.group, u.tokens.door.group]).toEqual([null, null])
    expect(run(u, master, { type: 'token/ungroup', group: g })).toEqual({ ok: false, reason: 'Grupo não existe' })
  })

  it('BRD-10, BRD-18 moveMany moves every item or none: a forbidden item or one outside the map refuses all', () => {
    const s = base(item('a', { x: 150, y: 150 }), item('b', { x: 250, y: 150 }), item('door', { movement: 'master', x: 350, y: 150 }))
    const moved = ok(run(s, ana, { type: 'token/moveMany', moves: [{ id: 'a', x: 150, y: 350 }, { id: 'b', x: 250, y: 350 }] }))
    expect([moved.tokens.a.y, moved.tokens.b.y]).toEqual([350, 350])
    expect(run(s, ana, { type: 'token/moveMany', moves: [{ id: 'a', x: 150, y: 350 }, { id: 'door', x: 350, y: 350 }] })).toEqual({ ok: false, reason: 'Sem permissão' })
    expect(run(s, master, { type: 'token/moveMany', moves: [{ id: 'a', x: 150, y: 350 }, { id: 'b', x: 250, y: 650 }] })).toEqual({ ok: false, reason: 'Fora do mapa' })
  })

  it('[C21] BRD-21 removing an item keeps the rest of its group, and a group left with one item ends', () => {
    let s = ok(run(base(item('a'), item('b'), item('c'), item('d'), item('e')), master, { type: 'token/group', ids: ['a', 'b', 'c'] }))
    s = ok(run(s, master, { type: 'token/group', ids: ['d', 'e'] }))
    const abc = s.tokens.a.group
    s = ok(run(s, master, { type: 'token/remove', id: 'a' }))
    expect([s.tokens.b.group, s.tokens.c.group]).toEqual([abc, abc]) // two left: still a group
    s = ok(run(s, master, { type: 'token/remove', id: 'd' }))
    expect(s.tokens.e.group).toBeNull() // one left: the group ends
  })
})
