export const MAX_TRIES = 3
export const DOWNLOAD_FAILED = 'Falha ao baixar arquivo'
export const downloading = (n: number, total: number): string => `Baixando arquivos ${n}/${total}`

export interface AssetCachePort {
  get(hash: string): Promise<Uint8Array | null>
  put(hash: string, bytes: Uint8Array): Promise<unknown>
}

export interface AssetLoaderDeps {
  baseUrl: string // http://ip:port
  fetch: typeof fetch
  cache: AssetCachePort
  sha256(bytes: Uint8Array): Promise<string>
}

/** SHA-256 with WebCrypto, as the renderer has it. */
export async function webSha256(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** ASSET-02..05: gets images by hash, from the cache when present, otherwise from the master. */
export class AssetLoader {
  status: string | null = null
  private listeners = new Set<(s: string | null) => void>()
  private done = new Map<string, Uint8Array>()
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly deps: AssetLoaderDeps) {}

  onStatus(fn: (s: string | null) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private setStatus(s: string | null): void {
    this.status = s
    for (const fn of this.listeners) fn(s)
  }

  /** Resolves with the bytes of every hash it could get; batches run one after another. */
  ensure(hashes: string[]): Promise<Map<string, Uint8Array>> {
    const run = this.queue.then(() => this.load(hashes))
    this.queue = run.catch(() => {})
    return run
  }

  private async load(hashes: string[]): Promise<Map<string, Uint8Array>> {
    const out = new Map<string, Uint8Array>()
    const missing: string[] = []
    for (const h of [...new Set(hashes)]) {
      const known = this.done.get(h) ?? (await this.deps.cache.get(h))
      if (known) {
        this.done.set(h, known)
        out.set(h, known)
      } else missing.push(h)
    }
    let failed = false
    for (let i = 0; i < missing.length; i++) {
      this.setStatus(downloading(i + 1, missing.length))
      const bytes = await this.download(missing[i])
      if (!bytes) {
        failed = true
        continue
      }
      await this.deps.cache.put(missing[i], bytes)
      this.done.set(missing[i], bytes)
      out.set(missing[i], bytes)
    }
    if (missing.length) this.setStatus(failed ? DOWNLOAD_FAILED : null)
    return out
  }

  private async download(hash: string): Promise<Uint8Array | null> {
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        const res = await this.deps.fetch(`${this.deps.baseUrl}/asset/${hash}`)
        if (!res.ok) continue
        const bytes = new Uint8Array(await res.arrayBuffer())
        if ((await this.deps.sha256(bytes)) === hash) return bytes
      } catch {
        /* network error: try again */
      }
    }
    return null
  }
}
