// Types shared by preload and renderer; no runtime code.
export interface LanAddress {
  ip: string
  label: 'Hamachi' | 'Radmin' | 'Rede'
}

export type HostResult = { ok: true; port: number; hostToken: string } | { ok: false; error: string }

export interface MesaApi {
  /** True only in automated tests (MESA_TEST=1): enables window.__mesaTest. */
  isTest: boolean
  host(portText: string): Promise<HostResult>
  stopHost(): Promise<void>
  addresses(): Promise<LanAddress[]>
  copy(text: string): Promise<void>
}
