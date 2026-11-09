export const DEFAULT_PORT = 47800
export const MAX_PLAYERS = 8
export const MAX_NAME = 24

export type PortCheck = { ok: true; port: number } | { ok: false; error: 'Porta inválida' }

/** NET-04: a port is an integer from 1024 to 65535, written with digits only. */
export function validatePort(text: string): PortCheck {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return { ok: false, error: 'Porta inválida' }
  const port = Number(t)
  if (port < 1024 || port > 65535) return { ok: false, error: 'Porta inválida' }
  return { ok: true, port }
}

export type JoinError = 'Nome inválido' | 'Nome já em uso' | 'Mesa cheia'

export function normalizeName(name: string): string {
  return name.trim()
}

/** NET-07, NET-09: the reason a player cannot join, or null when they can. */
export function validateJoin(name: string, connectedNames: readonly string[], playerCount: number): JoinError | null {
  const n = normalizeName(name)
  const chars = [...n].length // characters, not UTF-16 units: an emoji counts as one
  if (chars < 1 || chars > MAX_NAME) return 'Nome inválido'
  if (connectedNames.some((c) => c.toLocaleLowerCase() === n.toLocaleLowerCase())) return 'Nome já em uso'
  if (playerCount >= MAX_PLAYERS) return 'Mesa cheia'
  return null
}
