import { z } from 'zod'
import type { LibraryItem, LogEntry, PatchOp, Role, View } from './types'

const num = z.number().finite()
const int = z.number().int()
const hash = z.string().regex(/^[0-9a-f]{64}$/)
const faction = z.enum(['grupo', 'inimigo', 'npc', 'neutro'])
const size = z.union([z.literal(1), z.literal(2), z.literal(3)])
const fogMode = z.enum(['reveal', 'cover'])
const point = z.object({ x: num, y: num })

const gridPatch = z
  .object({
    cell: num,
    offsetX: num,
    offsetY: num,
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    opacity: num
  })
  .partial()

export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('token/place'), hash, name: z.string().max(100), faction, size, col: int, row: int }),
  z.object({ type: z.literal('token/move'), id: z.string(), col: int, row: int }),
  z.object({
    type: z.literal('token/update'),
    id: z.string(),
    name: z.string().max(100).optional(),
    faction: faction.optional(),
    size: size.optional()
  }),
  z.object({ type: z.literal('token/remove'), id: z.string() }),
  z.object({ type: z.literal('token/hide'), id: z.string() }),
  z.object({ type: z.literal('token/show'), id: z.string() }),
  z.object({ type: z.literal('token/owner'), id: z.string(), owner: z.string().max(100).nullable() }),
  z.object({ type: z.literal('grid/set'), grid: gridPatch }),
  z.object({ type: z.literal('map/set'), hash, width: int.positive(), height: int.positive(), grid: gridPatch.optional() }),
  z.object({ type: z.literal('fog/brush'), x: num, y: num, radius: int, mode: fogMode }),
  z.object({ type: z.literal('fog/rect'), x0: num, y0: num, x1: num, y1: num, mode: fogMode }),
  z.object({ type: z.literal('fog/coverAll') }),
  z.object({ type: z.literal('palette/set'), palette: z.record(faction, z.string().regex(/^#[0-9a-fA-F]{6}$/)) }),
  z.object({ type: z.literal('roll'), expr: z.string().max(200) }),
  z.object({ type: z.literal('chat'), text: z.string().max(2000) })
])
export type Action = z.infer<typeof actionSchema>

export const ephemeralSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ruler'), from: point, to: point }),
  z.object({ type: z.literal('ruler/end') }),
  z.object({ type: z.literal('ping'), x: num, y: num }),
  z.object({ type: z.literal('stroke'), strokeId: z.string().max(64), points: z.array(point).max(2000), done: z.boolean() })
])
export type Ephemeral = z.infer<typeof ephemeralSchema>

const clientMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('join'), name: z.string().max(200), hostToken: z.string().max(200).optional() }),
  z.object({ t: z.literal('action'), id: z.string().max(64), action: actionSchema }),
  z.object({ t: z.literal('ephemeral'), e: ephemeralSchema })
])
export type ClientMsg = z.infer<typeof clientMsgSchema>

export type ServerMsg =
  | { t: 'welcome'; you: { role: Role; name: string }; view: View; log: LogEntry[] }
  | { t: 'join-error'; reason: string }
  | { t: 'patch'; ops: PatchOp[] }
  | { t: 'ack'; id: string }
  | { t: 'reject'; id: string; reason: string }
  | { t: 'log'; entry: LogEntry }
  | { t: 'ephemeral'; from: string; e: Ephemeral }
  | { t: 'library'; items: LibraryItem[] }
  | { t: 'closed' }

/** Parses one message from a client; anything that is not a known, well-formed message is null. */
export function parseClientMsg(raw: string): ClientMsg | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = clientMsgSchema.safeParse(data)
  return parsed.success ? parsed.data : null
}
