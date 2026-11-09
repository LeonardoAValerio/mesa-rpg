import { Texture } from 'pixi.js'
import type { TextureProvider } from '../board/board'

/** Textures by content hash, for the board. Images decoded in this window are added here. */
export class TextureStore implements TextureProvider {
  private textures = new Map<string, Texture>()
  private listeners = new Set<() => void>()

  get(hash: string): Texture | null {
    return this.textures.get(hash) ?? null
  }

  has(hash: string): boolean {
    return this.textures.has(hash)
  }

  add(hash: string, bitmap: ImageBitmap): void {
    if (this.textures.has(hash)) return
    this.textures.set(hash, Texture.from(bitmap))
    for (const fn of this.listeners) fn()
  }

  onLoad(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}

/** Decodes image bytes; null when the browser cannot decode them (MAP-09). */
export async function decodeImage(bytes: Uint8Array): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(new Blob([bytes as BlobPart]))
  } catch {
    return null
  }
}

/** RGBA pixels of a bitmap, for grid detection. */
export function pixelsOf(bitmap: ImageBitmap): Uint8ClampedArray {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data
}
