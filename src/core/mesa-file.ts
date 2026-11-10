import { z } from 'zod'
import { fromBase64, toBase64 } from './base64'
import { fromCellFog } from './fog'
import { clampGrid } from './grid'
import { clampWidth, fromOldToken, normalizeRotation, type Item } from './items'
import { fogShapeSchema } from './protocol'
import type { Scene } from './types'

export const INVALID_MESA = 'Arquivo .mesa inválido'
/**
 * Version 3 keeps items (AD-007); version 2 has the fog as shapes and cell tokens; version 1 the cell fog too.
 * Older files still load (FOGS-10, ITEM-20).
 */
export const MESA_VERSION = 3

const hash = z.string().regex(/^[0-9a-f]{64}$/)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const faction = z.enum(['grupo', 'inimigo', 'npc', 'neutro'])
const int = z.number().int()

const cellFog = z.object({ colStart: int, rowStart: int, cols: int.nonnegative(), rows: int.nonnegative(), covered: z.string() })
const shapeFog = z.object({ base: z.enum(['revealed', 'covered']), shapes: z.array(fogShapeSchema) })

const oldToken = z.object({
  id: z.string(),
  name: z.string().max(100),
  hash,
  faction,
  size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  col: int,
  row: int,
  owner: z.string().max(100).nullable(),
  hidden: z.boolean()
})
const item = z.object({
  id: z.string(),
  name: z.string().max(100),
  hash,
  kind: z.enum(['character', 'object']),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  rotation: z.number().finite(),
  ring: faction.nullable(),
  owner: z.string().max(100).nullable(),
  hidden: z.boolean(),
  movement: z.enum(['free', 'master', 'locked'])
})

const sceneFields = {
  map: z.object({ hash, width: int.positive(), height: int.positive() }).nullable(),
  grid: z.object({ cell: z.number(), offsetX: z.number(), offsetY: z.number(), color, opacity: z.number() }),
  palette: z.record(faction, color).nullable().default(null)
}
const file = <V extends number, S extends z.ZodRawShape>(version: V, scene: S) =>
  z.object({ format: z.literal('mesa'), version: z.literal(version), scene: z.object({ ...sceneFields, ...scene }), assets: z.record(hash, z.string()) })

/** A version 3 scene (items, fog shapes), also used by campaign scenes (`.cena`). */
export const sceneSchemaV3 = z.object({ ...sceneFields, fog: shapeFog.nullable(), tokens: z.record(z.string(), item) })

const fileSchema = z.discriminatedUnion('version', [
  file(1, { fog: cellFog.nullable(), tokens: z.record(z.string(), oldToken) }),
  file(2, { fog: shapeFog.nullable(), tokens: z.record(z.string(), oldToken) }),
  file(3, { fog: shapeFog.nullable(), tokens: z.record(z.string(), item) })
])

/** Every image the scene uses. */
export function sceneHashes(scene: Scene): string[] {
  return [...new Set([...(scene.map ? [scene.map.hash] : []), ...Object.values(scene.tokens).map((t) => t.hash)])]
}

/** SAVE-01: the scene and every image it uses, embedded as base64, in one JSON file. */
export function encodeMesa(scene: Scene, assets: Map<string, Uint8Array>): string {
  const embedded: Record<string, string> = {}
  for (const h of sceneHashes(scene)) {
    const bytes = assets.get(h)
    if (!bytes) throw new Error(`missing image ${h}`)
    embedded[h] = toBase64(bytes)
  }
  return JSON.stringify({ format: 'mesa', version: MESA_VERSION, scene, assets: embedded })
}

/** SAVE-03, SAVE-04: the scene back from a file, or "Arquivo .mesa inválido" for anything malformed or tampered with. */
export function decodeMesa(
  text: string,
  sha256: (bytes: Uint8Array) => string
): { scene: Scene; assets: Map<string, Uint8Array> } | { error: typeof INVALID_MESA } {
  const fail = { error: INVALID_MESA } as const
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail
  }
  const parsed = fileSchema.safeParse(data)
  if (!parsed.success) return fail
  const grid = clampGrid(parsed.data.scene.grid)
  const raw = parsed.data
  const fog = raw.version === 1 ? (raw.scene.fog ? fromCellFog(raw.scene.fog, grid) : null) : raw.scene.fog
  const tokens: Record<string, Item> = {}
  for (const [id, t] of Object.entries(raw.scene.tokens)) {
    // ITEM-20: older tokens become characters; a version 3 item is kept within its bounds
    tokens[id] = 'col' in t ? fromOldToken(t, grid) : { ...t, width: clampWidth(t.width), rotation: normalizeRotation(t.rotation), ring: t.kind === 'object' ? null : t.ring, owner: t.kind === 'object' ? null : t.owner }
  }
  const scene: Scene = { map: raw.scene.map, palette: raw.scene.palette, grid, fog, tokens }
  for (const [id, t] of Object.entries(scene.tokens)) if (t.id !== id) return fail
  const assets = new Map<string, Uint8Array>()
  for (const h of sceneHashes(scene)) {
    const b64 = parsed.data.assets[h]
    const bytes = b64 === undefined ? null : fromBase64(b64)
    if (!bytes || sha256(bytes) !== h) return fail
    assets.set(h, bytes)
  }
  return { scene, assets }
}
