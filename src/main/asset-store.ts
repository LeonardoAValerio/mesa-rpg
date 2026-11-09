import { createHash } from 'node:crypto'

export const HASH_RE = /^[0-9a-f]{64}$/

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** ASSET-01: images kept in memory on the master's PC, addressed by the SHA-256 of their content. */
export class AssetStore {
  private items = new Map<string, Uint8Array>()

  put(bytes: Uint8Array): string {
    const hash = sha256(bytes)
    if (!this.items.has(hash)) this.items.set(hash, bytes)
    return hash
  }

  get(hash: string): Uint8Array | null {
    return this.items.get(hash) ?? null
  }

  has(hash: string): boolean {
    return this.items.has(hash)
  }
}
