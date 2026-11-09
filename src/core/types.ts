import type { Item, ItemKind } from './items'

export type Faction = 'grupo' | 'inimigo' | 'npc' | 'neutro'
export const FACTIONS: readonly Faction[] = ['grupo', 'inimigo', 'npc', 'neutro']

export interface Grid {
  cell: number // 10..500 px
  offsetX: number // 0..cell
  offsetY: number // 0..cell
  color: string // #rrggbb
  opacity: number // 0..1
}

export interface MapRef {
  hash: string
  width: number
  height: number
}

/** A token or object on the table (AD-007); see `src/core/items.ts`. */
export type Token = Item

export type FogMode = 'reveal' | 'cover'

/** One fog shape in map pixels (AD-006). A stroke holds the points within `radius` of its polyline. */
export type FogShape =
  | { kind: 'stroke'; mode: FogMode; radius: number; points: number[] }
  | { kind: 'rect'; mode: FogMode; x: number; y: number; w: number; h: number }
  | { kind: 'poly'; mode: FogMode; points: number[] }

/** The fog: a base state and shapes in order; at a point the last shape containing it decides (FOGS-04). */
export interface Fog {
  base: 'revealed' | 'covered'
  shapes: FogShape[]
}

export interface Scene {
  map: MapRef | null
  grid: Grid
  tokens: Record<string, Token>
  fog: Fog | null
  palette: FactionColors | null
}

export type Role = 'master' | 'player'

export interface Actor {
  role: Role
  name: string
}

export interface RollTerm {
  kind: 'dice' | 'const'
  sign: 1 | -1
  count?: number
  sides?: number
  keep?: { mode: 'kh' | 'kl'; n: number }
  rolls?: number[]
  kept?: boolean[]
  value: number
}

export interface RollResult {
  expr: string
  terms: RollTerm[]
  total: number
}

export interface LogEntry {
  id: string
  at: number
  author: string
  kind: 'chat' | 'roll'
  text: string
  roll?: RollResult
}

export interface View {
  role: Role
  map: MapRef | null
  grid: Grid
  tokens: Record<string, Token>
  fog: Fog | null
  palette: FactionColors | null
  players: string[]
}

export interface LibraryItem {
  hash: string
  name: string
  kind: ItemKind
  width: number
  ring: Faction | null
}

export type PatchOp =
  | { op: 'token/upsert'; token: Token }
  | { op: 'token/remove'; id: string }
  | { op: 'map'; map: MapRef | null }
  | { op: 'grid'; grid: Grid }
  | { op: 'fog'; fog: Fog | null }
  | { op: 'players'; players: string[] }
  | { op: 'palette'; palette: FactionColors | null }

export const DEFAULT_GRID: Grid = { cell: 70, offsetX: 0, offsetY: 0, color: '#000000', opacity: 0.5 }

export function emptyScene(): Scene {
  return { map: null, grid: { ...DEFAULT_GRID }, tokens: {}, fog: null, palette: null }
}

export type FactionColors = Record<Faction, string>
/** TOK-09: ring colours when the master has not loaded a palette. */
export const DEFAULT_FACTION_COLORS: FactionColors = { grupo: '#3b82f6', inimigo: '#ef4444', npc: '#eab308', neutro: '#9ca3af' }
