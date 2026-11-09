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
/** A map with every cell covered, as after "Cobrir tudo". */
const foggedMap = (): Scene => run(withMap(), { type: 'fog/coverAll' })

describe('fog in the scene', () => {
  it('[C1] FOGD-01 importing a map leaves every fog cell revealed, also over a fogged map', () => {
    const s = withMap()
    expect(s.fog).toMatchObject({ colStart: 0, rowStart: 0, cols: 8, rows: 6 })
    expect(coveredCells(s.fog!)).toHaveLength(0)
    const fogged = run(s, { type: 'fog/coverAll' })
    expect(coveredCells(fogged.fog!)).toHaveLength(48)
    const next = run(fogged, { type: 'map/set', hash: H, width: 400, height: 300 })
    expect(next.fog).toMatchObject({ cols: 4, rows: 3 })
    expect(coveredCells(next.fog!)).toHaveLength(0)
  })

  it('[C3] FOGD-03 a player\'s "Revelar tudo" is refused with "Sem permissão" and changes nothing; with no map it is refused like "Cobrir tudo"', () => {
    const s = foggedMap()
    const ctx: ReducerCtx = { rng: () => 1, now: () => 0, newId: () => 'x' }
    expect(applyAction(s, ana, { type: 'fog/revealAll' }, ctx)).toEqual({ ok: false, reason: 'Sem permissão' })
    expect(coveredCells(s.fog!)).toHaveLength(48)
    const open = applyAction(s, master, { type: 'fog/revealAll' }, ctx)
    expect(open.ok && coveredCells(open.scene.fog!)).toHaveLength(0)
    const none = applyAction(emptyScene(), master, { type: 'fog/revealAll' }, ctx)
    expect(none).toEqual(applyAction(emptyScene(), master, { type: 'fog/coverAll' }, ctx))
    expect(none).toEqual({ ok: false, reason: 'Nenhum mapa carregado' })
  })

  it('[C69] FOG-06 a token under the fog is not in the view of who does not own it and is in its owner view', () => {
    let s = run(foggedMap(), { type: 'token/place', hash: H, name: 'Guerreira', faction: 'grupo', size: 1, col: 2, row: 2 })
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
    const s = run(foggedMap(), { type: 'token/place', hash: H, name: 'Goblin', faction: 'inimigo', size: 1, col: 3, row: 2 })
    const before = viewFor(s, ana, [])
    const after = run(s, { type: 'fog/brush', x: 350, y: 250, radius: 1, mode: 'reveal' })
    const ops = diffViews(before, viewFor(after, ana, []))
    expect(ops.filter((o) => o.op === 'token/upsert')).toEqual([{ op: 'token/upsert', token: after.tokens.t1 }])
    expect(ops.some((o) => o.op === 'fog')).toBe(true)
    // covering it again removes it
    const again = run(after, { type: 'fog/coverAll' })
    expect(diffViews(viewFor(after, ana, []), viewFor(again, ana, [])).filter((o) => o.op === 'token/remove')).toEqual([{ op: 'token/remove', id: 't1' }])
  })

  it('[C4] FOGD-04 with no covered cell, changing the cell size or the offset keeps every cell revealed', () => {
    for (const start of [withMap(), run(foggedMap(), revealAll)]) {
      for (const grid of [{ cell: 80 }, { offsetX: 20 }, { offsetY: 30 }]) {
        const s = run(start, { type: 'grid/set', grid })
        expect(s.fog).toMatchObject(s.grid.cell === 80 ? { cols: 10, rows: 8 } : {})
        expect(coveredCells(s.fog!)).toHaveLength(0)
      }
    }
  })

  it('[C5] FOGD-05 with one covered cell, wherever it is, changing the cell size or the offset covers every cell', () => {
    // one covered cell at a time: the first, one in the middle and the last
    for (const [col, row] of [[0, 0], [3, 2], [7, 5]]) {
      const x = col * 100 + 50
      const y = row * 100 + 50
      const one = run(withMap(), { type: 'fog/rect', x0: x - 10, y0: y - 10, x1: x + 10, y1: y + 10, mode: 'cover' })
      expect(coveredCells(one.fog!)).toEqual([[col, row]])
      for (const grid of [{ cell: 80 }, { offsetX: 20 }, { offsetY: 30 }]) {
        const s = run(one, { type: 'grid/set', grid })
        expect(coveredCells(s.fog!), `cell ${col},${row} then ${JSON.stringify(grid)}`).toHaveLength(s.fog!.cols * s.fog!.rows)
      }
      const s = run(one, { type: 'grid/set', grid: { color: '#ffffff', opacity: 0.2 } })
      expect(coveredCells(s.fog!)).toEqual([[col, row]]) // colour and opacity do not touch the fog
    }
  })


})
