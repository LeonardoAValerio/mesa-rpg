import { validChat } from './chat'
import { parseDice, rollDice } from './dice'
import { addShape, coverAll, revealAll } from './fog'
import { clampGrid, insideMap } from './grid'
import { parsePalette } from './palette'
import type { Action } from './protocol'
import type { Actor, LogEntry, Scene, Token } from './types'

export const NO_PERMISSION = 'Sem permissão'
export const OUTSIDE_MAP = 'Fora do mapa'
export const NO_MAP = 'Nenhum mapa carregado'
export const NO_TOKEN = 'Token não existe'
export const BAD_NAME = 'Nome inválido'

export interface ReducerCtx {
  rng: (max: number) => number
  now: () => number
  newId: () => string
}

export type ApplyResult = { ok: true; scene: Scene; log?: LogEntry } | { ok: false; reason: string }

const MASTER_ONLY = new Set<Action['type']>([
  'token/place',
  'token/update',
  'token/remove',
  'token/hide',
  'token/show',
  'token/owner',
  'grid/set',
  'map/set',
  'fog/shape',
  'fog/coverAll',
  'fog/revealAll',
  'palette/set'
])

const refuse = (reason: string): ApplyResult => ({ ok: false, reason })
const withToken = (scene: Scene, token: Token): Scene => ({ ...scene, tokens: { ...scene.tokens, [token.id]: token } })

/** NET-14: the only way the scene changes. Every action is checked against the actor first (PERM-02..04). */
export function applyAction(scene: Scene, actor: Actor, action: Action, ctx: ReducerCtx): ApplyResult {
  if (actor.role !== 'master' && MASTER_ONLY.has(action.type)) return refuse(NO_PERMISSION)

  switch (action.type) {
    case 'map/set': {
      const grid = clampGrid(action.grid ?? {}, scene.grid)
      const map = { hash: action.hash, width: action.width, height: action.height }
      return { ok: true, scene: { ...scene, map, grid, fog: revealAll() } } // FOGD-01: a new map has no fog
    }
    case 'palette/set':
      return { ok: true, scene: { ...scene, palette: parsePalette(JSON.stringify(action.palette)) } }
    case 'grid/set': {
      // FOGS-09: the fog is in map pixels, so the grid leaves it as it is
      return { ok: true, scene: { ...scene, grid: clampGrid(action.grid, scene.grid) } }
    }
    case 'fog/coverAll':
    case 'fog/revealAll':
      if (!scene.map || !scene.fog) return refuse(NO_MAP)
      return { ok: true, scene: { ...scene, fog: action.type === 'fog/coverAll' ? coverAll() : revealAll() } } // FOGS-05
    case 'fog/shape': {
      if (!scene.map || !scene.fog) return refuse(NO_MAP)
      const r = addShape(scene.fog, action.shape) // FOGS-01..04, FOGS-08
      return r.ok ? { ok: true, scene: { ...scene, fog: r.fog } } : refuse(r.reason)
    }

    case 'token/place': {
      if (!scene.map) return refuse(NO_MAP)
      if (!insideMap(scene.grid, scene.map, action.col, action.row, action.size)) return refuse(OUTSIDE_MAP)
      const name = action.name.trim()
      if (!name) return refuse(BAD_NAME)
      const token: Token = {
        id: ctx.newId(),
        name,
        hash: action.hash,
        faction: action.faction,
        size: action.size,
        col: action.col,
        row: action.row,
        owner: null,
        hidden: false
      }
      return { ok: true, scene: withToken(scene, token) }
    }
    case 'token/move': {
      const t = scene.tokens[action.id]
      if (!t) return refuse(NO_TOKEN)
      if (actor.role !== 'master' && (t.owner !== actor.name || t.hidden)) return refuse(NO_PERMISSION)
      if (!scene.map || !insideMap(scene.grid, scene.map, action.col, action.row, t.size)) return refuse(OUTSIDE_MAP)
      return { ok: true, scene: withToken(scene, { ...t, col: action.col, row: action.row }) }
    }
    case 'token/update': {
      const t = scene.tokens[action.id]
      if (!t) return refuse(NO_TOKEN)
      const name = action.name === undefined ? t.name : action.name.trim()
      if (!name) return refuse(BAD_NAME)
      return {
        ok: true,
        scene: withToken(scene, { ...t, name, faction: action.faction ?? t.faction, size: action.size ?? t.size })
      }
    }
    case 'token/remove': {
      if (!scene.tokens[action.id]) return refuse(NO_TOKEN)
      const tokens = { ...scene.tokens }
      delete tokens[action.id]
      return { ok: true, scene: { ...scene, tokens } }
    }
    case 'token/hide':
    case 'token/show': {
      const t = scene.tokens[action.id]
      if (!t) return refuse(NO_TOKEN)
      return { ok: true, scene: withToken(scene, { ...t, hidden: action.type === 'token/hide' }) }
    }
    case 'token/owner': {
      const t = scene.tokens[action.id]
      if (!t) return refuse(NO_TOKEN)
      const owner = action.owner === null ? null : action.owner.trim() || null
      return { ok: true, scene: withToken(scene, { ...t, owner }) }
    }
    case 'roll': {
      const expr = parseDice(action.expr)
      if ('error' in expr) return refuse(expr.error) // DICE-04: nothing reaches the log
      const roll = rollDice(expr, ctx.rng)
      return { ok: true, scene, log: { id: ctx.newId(), at: ctx.now(), author: actor.name, kind: 'roll', text: expr.text, roll } }
    }
    case 'chat': {
      if (!validChat(action.text)) return refuse('Mensagem inválida')
      return { ok: true, scene, log: { id: ctx.newId(), at: ctx.now(), author: actor.name, kind: 'chat', text: action.text.trim() } }
    }
    default:
      return refuse('Ação não suportada')
  }
}
