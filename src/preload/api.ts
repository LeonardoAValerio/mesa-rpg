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

/** One image of the campaign (CAMP-08, CAMP-09). */
export interface CampaignEntry {
  section: 'mapas' | 'tokens' | 'objetos'
  path: string
  group: string
  name: string
  hash: string
  kind: 'character' | 'object'
  width: number
  ring: 'grupo' | 'inimigo' | 'npc' | 'neutro' | null
  w: number
  h: number
}
/** One audio file of `musicas/` or `efeitos/` (SOM-01). */
export interface SoundEntry {
  section: 'musicas' | 'efeitos'
  path: string
  group: string
  name: string
  hash: string
  type: 'mp3' | 'ogg' | 'wav' | 'm4a'
}
export interface CampaignInfo {
  name: string
  entries: CampaignEntry[]
  sounds: SoundEntry[]
  scenes: string[]
}
export type CampaignsResult = { list: string[]; last: string | null }
export type CenaSaveResult = { ok: true } | { ok: false; exists: true } | { ok: false; error: string }
export type PaletteResult = { ok: true; palette: Record<'grupo' | 'inimigo' | 'npc' | 'neutro', string> } | { ok: false; canceled: true }

export type SceneFileResult = { ok: true } | { ok: false; canceled: true } | { ok: false; error: string }

export interface MesaApi {
  /** True only in automated tests (MESA_TEST=1): enables window.__mesaTest. */
  isTest: boolean
  /** The app version, sent on join and shown on the start screen (VER-01, UPD-14). */
  version: string
  /** CAMP-01, CAMP-06 */
  campaigns(): Promise<CampaignsResult>
  /** CAMP-02, CAMP-03 */
  createCampaign(name: string): Promise<{ ok: true } | { ok: false; error: string }>
  host(portText: string, campaign: string): Promise<HostResult>
  /** The open campaign, and later every change to it (CAMP-11). */
  campaign(): Promise<CampaignInfo | null>
  onCampaign(fn: (info: CampaignInfo | null) => void): () => void
  openFolder(): Promise<void>
  addFiles(section: 'mapas' | 'tokens' | 'objetos' | 'musicas' | 'efeitos'): Promise<{ ok: true; added: string[] } | { ok: false; canceled: true }>
  assetBytes(hash: string): Promise<Uint8Array | null>
  saveCena(name: string, replace: boolean): Promise<CenaSaveResult>
  loadCena(name: string): Promise<SceneFileResult>
  stopHost(): Promise<void>
  addresses(): Promise<LanAddress[]>
  copy(text: string): Promise<void>
  importMap(): Promise<ImportedImage>
  loadPalette(): Promise<PaletteResult>
  exportMesa(): Promise<SceneFileResult>
  importMesa(): Promise<SceneFileResult>
  cacheGet(hash: string): Promise<Uint8Array | null>
  cachePut(hash: string, bytes: Uint8Array): Promise<boolean>
  /** The update's current state, for a window that loads after the updater spoke (UPD-04, UPD-05). */
  updateState(): Promise<UpdateState>
  /** Calls `fn` on every later update state; returns the unsubscribe. */
  onUpdateState(fn: (state: UpdateState) => void): () => void
  /** UPD-06: ends the hosted table, if any, then quits, installs and reopens. */
  installUpdate(): Promise<void>
}
