// Types shared by preload and renderer; no runtime code.
export interface LanAddress {
  ip: string
  label: 'Hamachi' | 'Radmin' | 'Rede'
}

export type HostResult = { ok: true; port: number; hostToken: string } | { ok: false; error: string }

export type ImportedImage =
  | { ok: true; hash: string; width: number; height: number; bytes: Uint8Array }
  | { ok: false; error: string }
  | { ok: false; canceled: true }

export interface MesaApi {
  /** True only in automated tests (MESA_TEST=1): enables window.__mesaTest. */
  isTest: boolean
  host(portText: string): Promise<HostResult>
  stopHost(): Promise<void>
  addresses(): Promise<LanAddress[]>
  copy(text: string): Promise<void>
  importMap(): Promise<ImportedImage>
  cacheGet(hash: string): Promise<Uint8Array | null>
  cachePut(hash: string, bytes: Uint8Array): Promise<boolean>
}
