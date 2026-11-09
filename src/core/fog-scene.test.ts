import { beforeEach, describe, expect, it } from 'vitest'
import { coveredCells, isCovered } from './fog'
import type { Action } from './protocol'
import { applyAction, type ReducerCtx } from './reducer'
import { emptyScene, type Actor, type Scene } from './types'
import { diffViews, viewFor } from './view'

const H = 'c'.repeat(64)
const master: Actor = { role: 'master', name: 'Mestre' }
const ana: Actor = { role: 'player', name: 'Ana' }
const bia: Actor = { role: 'player', name: 'Bia' }

let n = 0
beforeEach(() => {
  n = 0
})
function run(scene: Scene, ...actions: Action[]): Scene {
  const ctx: ReducerCtx = { rng: () => 1, now: () => 0, newId: () => `t${++n}` }
  for (const a of actions) {
    const r = applyAction(scene, master, a, ctx)
    if (!r.ok) throw new Error(`${a.type}: ${r.reason}`)
    scene = r.scene
  }
  return scene
}
const withMap = (): Scene => run(emptyScene(), { type: 'map/set', hash: H, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
const revealAll: Action = { type: 'fog/rect', x0: 0, y0: 0, x1: 800, y1: 600, mode: 'reveal' }

describe('fog in the scene', () => {
  it('[C64] FOG-01 importing a map covers every fog cell', () => {
    const s = withMap()
    expect(s.fog).toMatchObject({ colStart: 0, rowStart: 0, cols: 8, rows: 6 })
    expect(coveredCells(s.fog!)).toHaveLength(48)
    const opened = run(s, revealAll)
    expect(coveredCells(opened.fog!)).toHaveLength(0)
    const next = run(opened, { type: 'map/set', hash: H, width: 400, height: 300 })
    expect(coveredCells(next.fog!)).toHaveLength(next.fog!.cols * next.fog!.rows)
  })

  it('[C69] FOG-06 a token under the fog is not in the view of who does not own it and is in its owner view', () => {
    let s = run(withMap(), { type: 'token/place', hash: H, name: 'Guerreira', faction: 'grupo', size: 1, col: 2, row: 2 })
    s = run(s, { type: 'token/owner', id: 't1', owner: 'Ana' })
    s = run(s, { type: 'token/place', hash: H, name: 'Goblin', faction: 'inimigo', size: 2, col: 5, row: 3 })
    expect(Object.keys(viewFor(s, ana, []).tokens)).toEqual(['t1'])
    expect(Object.keys(viewFor(s, bia, []).tokens)).toEqual([])
    expect(Object.keys(viewFor(s, master, []).tokens).sort()).toEqual(['t1', 't2'])
    // a 2x2 token with one cell still covered stays hidden
    const partly = run(s, { type: 'fog/rect', x0: 500, y0: 300, x1: 690, y1: 390, mode: 'reveal' }) // reveals its top row only
    expect(isCovered(partly.fog!, 6, 4)).toBe(true)
    expect(viewFor(partly, bia, []).tokens.t2).toBeUndefined()
  })

  it('[C70] FOG-07 revealing the token cell sends `token/upsert` to the player', () => {
    const s = run(withMap(), { type: 'token/place', hash: H, name: 'Goblin', faction: 'inimigo', size: 1, col: 3, row: 2 })
    const before = viewFor(s, ana, [])
    const after = run(s, { type: 'fog/brush', x: 350, y: 250, radius: 1, mode: 'reveal' })
    const ops = diffViews(before, viewFor(after, ana, []))
    expect(ops.filter((o) => o.op === 'token/upsert')).toEqual([{ op: 'token/upsert', token: after.tokens.t1 }])
    expect(ops.some((o) => o.op === 'fog')).toBe(true)
    // covering it again removes it
    const again = run(after, { type: 'fog/coverAll' })
    expect(diffViews(viewFor(after, ana, []), viewFor(again, ana, [])).filter((o) => o.op === 'token/remove')).toEqual([{ op: 'token/remove', id: 't1' }])
  })

  it('[C71] FOG-08 changing the cell size or the offset covers every cell again', () => {
    const open = run(withMap(), revealAll)
    for (const grid of [{ cell: 80 }, { offsetX: 20 }, { offsetY: 30 }]) {
      const s = run(open, { type: 'grid/set', grid })
      expect(coveredCells(s.fog!)).toHaveLength(s.fog!.cols * s.fog!.rows)
    }
    const s = run(open, { type: 'grid/set', grid: { color: '#ffffff', opacity: 0.2 } })
    expect(coveredCells(s.fog!)).toHaveLength(0) // colour and opacity do not touch the fog
  })
})
