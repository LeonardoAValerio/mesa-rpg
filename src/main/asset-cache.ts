import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { HASH_RE, sha256 } from './asset-store'

/** ASSET-02/03: a player's downloaded images, one file per SHA-256 under userData/cache. */
export class AssetCache {
  constructor(private readonly dir: string) {}

  async get(hash: string): Promise<Uint8Array | null> {
    if (!HASH_RE.test(hash)) return null
    try {
      const bytes = new Uint8Array(await readFile(join(this.dir, hash)))
      return sha256(bytes) === hash ? bytes : null
    } catch {
      return null
    }
  }

  /** Stores bytes only when they really have that hash. */
  async put(hash: string, bytes: Uint8Array): Promise<boolean> {
    if (!HASH_RE.test(hash) || sha256(bytes) !== hash) return false
    await mkdir(this.dir, { recursive: true })
    const tmp = join(this.dir, `${hash}.part`)
    await writeFile(tmp, bytes)
    await rename(tmp, join(this.dir, hash))
    return true
  }
}
