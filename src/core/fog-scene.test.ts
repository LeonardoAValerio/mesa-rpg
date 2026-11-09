import { beforeEach, describe, expect, it } from 'vitest'
import { fogAt, MAX_SHAPES, TOO_MANY_SHAPES } from './fog'
import { parseClientMsg, type Action } from './protocol'
import { applyAction, type ReducerCtx } from './reducer'
import { emptyScene, type Actor, type FogShape, type Scene } from './types'
import { diffViews, viewFor } from './view'

const H = 'c'.repeat(64)
const master: Actor = { role: 'master', name: 'Mestre' }
const ana: Actor = { role: 'player', name: 'Ana' }
const bia: Actor = { role: 'player', name: 'Bia' }

let n = 0
beforeEach(() => {
  n = 0
})
const ctx = (): ReducerCtx => ({ rng: () => 1, now: () => 0, newId: () => `t${++n}` })
function run(scene: Scene, ...actions: Action[]): Scene {
  for (const a of actions) {
    const r = applyAction(scene, master, a, ctx())
    if (!r.ok) throw new Error(`${a.type}: ${r.reason}`)
    scene = r.scene
  }
  return scene
}
const withMap = (): Scene => run(emptyScene(), { type: 'map/set', hash: H, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
/** A map with every point covered, as after "Cobrir tudo". */
const foggedMap = (): Scene => run(withMap(), { type: 'fog/coverAll' })
const shape = (s: FogShape): Action => ({ type: 'fog/shape', shape: s })
const rect = (mode: 'cover' | 'reveal', x: number, y: number, w: number, h: number): Action => shape({ kind: 'rect', mode, x, y, w, h })
const covered = (s: Scene, x: number, y: number): boolean => fogAt(s.fog!, x, y)

describe('fog in the scene', () => {
  it('[C1] FOGD-01 importing a map leaves it with no fog, also over a fogged map', () => {
    const s = withMap()
    expect(s.fog).toEqual({ base: 'revealed', shapes: [] })
    const fogged = run(s, { type: 'fog/coverAll' }, rect('reveal', 0, 0, 100, 100))
    expect(covered(fogged, 400, 300)).toBe(true)
    const next = run(fogged, { type: 'map/set', hash: H, width: 400, height: 300 })
    expect(next.fog).toEqual({ base: 'revealed', shapes: [] })
  })

  it('[C3] FOGD-03 a player\'s "Revelar tudo" is refused with "Sem permissão" and changes nothing; with no map it is refused like "Cobrir tudo"', () => {
    const s = foggedMap()
    expect(applyAction(s, ana, { type: 'fog/revealAll' }, ctx())).toEqual({ ok: false, reason: 'Sem permissão' })
    expect(covered(s, 10, 10)).toBe(true)
    const open = applyAction(s, master, { type: 'fog/revealAll' }, ctx())
    expect(open.ok && open.scene.fog).toEqual({ base: 'revealed', shapes: [] })
    const none = applyAction(emptyScene(), master, { type: 'fog/revealAll' }, ctx())
    expect(none).toEqual(applyAction(emptyScene(), master, { type: 'fog/coverAll' }, ctx()))
    expect(none).toEqual({ ok: false, reason: 'Nenhum mapa carregado' })
  })

  it('[C7] FOGS-07 a player\'s fog action is refused with "Sem permissão" and changes nothing', () => {
    const s = foggedMap()
    const before = JSON.stringify(s)
    for (const a of [rect('reveal', 0, 0, 800, 600), shape({ kind: 'stroke', mode: 'reveal', radius: 50, points: [10, 10] }), { type: 'fog/coverAll' } as Action, { type: 'fog/revealAll' } as Action]) {
      expect(applyAction(s, ana, a, ctx()), JSON.stringify(a)).toEqual({ ok: false, reason: 'Sem permissão' })
    }
    expect(JSON.stringify(s)).toBe(before)
  })

  it('[C8] FOGS-08 the 2001st shape and a 2001-point stroke are refused with the limit message and change nothing', () => {
    let s = withMap()
    for (let i = 0; i < MAX_SHAPES; i++) s = run(s, rect('cover', i % 800, 0, 1, 1))
    expect(s.fog!.shapes).toHaveLength(2000)
    expect(applyAction(s, master, rect('cover', 0, 0, 10, 10), ctx())).toEqual({ ok: false, reason: TOO_MANY_SHAPES })
    expect(TOO_MANY_SHAPES).toBe('Névoa com formas demais: use Cobrir tudo ou Revelar tudo')
    // what a client sends over the wire: a 2001- and a 3000-point stroke and polygon parse, and are refused with the message
    for (const n of [2001, 3000]) {
      for (const kind of ['stroke', 'poly'] as const) {
        const points = Array.from({ length: n * 2 }, (_, i) => (i * 7) % 800)
        const sent: FogShape = kind === 'stroke' ? { kind, mode: 'cover', radius: 5, points } : { kind, mode: 'cover', points }
        const msg = parseClientMsg(JSON.stringify({ t: 'action', id: 'a', action: shape(sent) }))
        expect(msg, `${kind} of ${n} points parses`).not.toBeNull()
        if (msg?.t !== 'action') throw new Error('not an action')
        expect(applyAction(withMap(), master, msg.action, ctx()), `${kind} of ${n}`).toEqual({ ok: false, reason: TOO_MANY_SHAPES })
      }
    }
    // 2000 points is fine
    const ok = parseClientMsg(JSON.stringify({ t: 'action', id: 'a', action: shape({ kind: 'stroke', mode: 'cover', radius: 5, points: Array.from({ length: 4000 }, (_, i) => i % 800) }) }))
    expect(ok?.t === 'action' && applyAction(withMap(), master, ok.action, ctx()).ok).toBe(true)
    // "Cobrir tudo" starts over, so drawing works again
    const again = run(s, { type: 'fog/coverAll' }, rect('reveal', 0, 0, 10, 10))
    expect(again.fog!.shapes).toHaveLength(1)
  })

  it('[C9] FOGS-09 changing the cell size or the offset leaves the fog exactly as it was', () => {
    const s = run(foggedMap(), rect('reveal', 100, 100, 250, 130), shape({ kind: 'poly', mode: 'cover', points: [150, 150, 300, 150, 200, 220] }))
    for (const grid of [{ cell: 80 }, { offsetX: 20 }, { offsetY: 30 }, { color: '#ffffff', opacity: 0.2 }]) {
      expect(run(s, { type: 'grid/set', grid }).fog, JSON.stringify(grid)).toEqual(s.fog)
    }
  })

  it('[C6] FOGS-06 a token whose centre is under the fog is withheld from non-owners and sent once its centre is revealed', () => {
    let s = run(foggedMap(), { type: 'token/place', hash: H, name: 'Guerreira', faction: 'grupo', size: 1, col: 2, row: 2 })
    s = run(s, { type: 'token/owner', id: 't1', owner: 'Ana' })
    s = run(s, { type: 'token/place', hash: H, name: 'Goblin', faction: 'inimigo', size: 2, col: 5, row: 3 }) // centre (600, 400)
    expect(Object.keys(viewFor(s, ana, []).tokens)).toEqual(['t1']) // the owner always sees hers
    expect(Object.keys(viewFor(s, bia, []).tokens)).toEqual([])
    expect(Object.keys(viewFor(s, master, []).tokens).sort()).toEqual(['t1', 't2'])
    // revealing three of its four cells but not its centre keeps it hidden
    const corners = run(s, rect('reveal', 500, 300, 90, 190), rect('reveal', 590, 300, 110, 90))
    expect(viewFor(corners, bia, []).tokens.t2).toBeUndefined()
    // a small hole on the centre sends it
    const before = viewFor(corners, bia, [])
    const open = run(corners, shape({ kind: 'stroke', mode: 'reveal', radius: 15, points: [600, 400] }))
    const ops = diffViews(before, viewFor(open, bia, []))
    expect(ops.filter((o) => o.op === 'token/upsert')).toEqual([{ op: 'token/upsert', token: open.tokens.t2 }])
    // covering the centre again takes it away
    const again = run(open, shape({ kind: 'stroke', mode: 'cover', radius: 5, points: [600, 400] }))
    expect(diffViews(viewFor(open, bia, []), viewFor(again, bia, [])).filter((o) => o.op === 'token/remove')).toEqual([{ op: 'token/remove', id: 't2' }])
  })
})
