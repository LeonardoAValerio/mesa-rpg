// Types shared by preload and renderer; no runtime code.
import type { UpdateState } from '../core/update-state'

export interface LanAddress {
  ip: string
  label: 'Hamachi' | 'Radmin' | 'Rede'
}

export type HostResult = { ok: true; port: number; hostToken: string } | { ok: false; error: string }

export type ImportedImage =
  | { ok: true; hash: string; width: number; height: number; bytes: Uint8Array }
  | { ok: false; error: string }
  | { ok: false; canceled: true }

export type ImportTokensResult = { ok: true; count: number; skipped: string[] } | { ok: false; canceled: true }
export type PaletteResult = { ok: true; palette: Record<'grupo' | 'inimigo' | 'npc' | 'neutro', string> } | { ok: false; canceled: true }

export type SceneFileResult = { ok: true } | { ok: false; canceled: true } | { ok: false; error: string }

export interface MesaApi {
  /** True only in automated tests (MESA_TEST=1): enables window.__mesaTest. */
  isTest: boolean
  /** The app version, sent on join and shown on the start screen (VER-01, UPD-14). */
  version: string
  host(portText: string): Promise<HostResult>
  stopHost(): Promise<void>
  addresses(): Promise<LanAddress[]>
  copy(text: string): Promise<void>
  importMap(): Promise<ImportedImage>
  importTokens(): Promise<ImportTokensResult>
  loadPalette(): Promise<PaletteResult>
  saveScene(): Promise<SceneFileResult>
  loadScene(): Promise<SceneFileResult>
  cacheGet(hash: string): Promise<Uint8Array | null>
  cachePut(hash: string, bytes: Uint8Array): Promise<boolean>
  /** The update's current state, for a window that loads after the updater spoke (UPD-04, UPD-05). */
  updateState(): Promise<UpdateState>
  /** Calls `fn` on every later update state; returns the unsubscribe. */
  onUpdateState(fn: (state: UpdateState) => void): () => void
  /** UPD-06: ends the hosted table, if any, then quits, installs and reopens. */
  installUpdate(): Promise<void>
}
