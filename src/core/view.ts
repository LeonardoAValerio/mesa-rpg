import { tokenCovered } from './fog'
import type { Actor, PatchOp, Scene, Token, View } from './types'

/** Whether a viewer may see a token: players never see hidden tokens (PERM-05) nor others' tokens whose centre is under the fog (FOGS-06). */
export function canSee(scene: Scene, viewer: Actor, token: Token): boolean {
  if (viewer.role === 'master') return true
  if (token.hidden) return false
  if (scene.fog && token.owner !== viewer.name && tokenCovered(scene.fog, scene.grid, token)) return false
  return true
}

/** The part of the scene one viewer is allowed to see. Anything left out never leaves the server. */
export function viewFor(scene: Scene, viewer: Actor, players: string[]): View {
  const tokens: Record<string, Token> = {}
  for (const t of Object.values(scene.tokens)) if (canSee(scene, viewer, t)) tokens[t.id] = t
  return { role: viewer.role, map: scene.map, grid: scene.grid, tokens, fog: scene.fog, palette: scene.palette, players }
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Patch that turns `prev` into `next`; empty when nothing this viewer sees changed. */
export function diffViews(prev: View, next: View): PatchOp[] {
  const ops: PatchOp[] = []
  if (!same(prev.map, next.map)) ops.push({ op: 'map', map: next.map })
  if (!same(prev.grid, next.grid)) ops.push({ op: 'grid', grid: next.grid })
  if (!same(prev.fog, next.fog)) ops.push({ op: 'fog', fog: next.fog })
  if (!same(prev.players, next.players)) ops.push({ op: 'players', players: next.players })
  if (!same(prev.palette, next.palette)) ops.push({ op: 'palette', palette: next.palette })
  for (const id of Object.keys(prev.tokens)) if (!next.tokens[id]) ops.push({ op: 'token/remove', id })
  for (const t of Object.values(next.tokens)) if (!same(prev.tokens[t.id], t)) ops.push({ op: 'token/upsert', token: t })
  return ops
}
