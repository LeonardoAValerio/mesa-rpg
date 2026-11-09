import { readFile, stat } from 'node:fs/promises'
import { imageInfo, INVALID_IMAGE, MAX_IMAGE_BYTES, type ImageInfo } from '../core/image-info'

export type ImageFile = { ok: true; bytes: Uint8Array; info: ImageInfo } | { ok: false; error: typeof INVALID_IMAGE }

/** MAP-09: reads an image chosen by the master; anything that is not a PNG/JPEG/WebP up to 50 MB is refused. */
export async function readImageFile(path: string): Promise<ImageFile> {
  try {
    const st = await stat(path)
    if (!st.isFile() || st.size > MAX_IMAGE_BYTES) return { ok: false, error: INVALID_IMAGE }
    const bytes = new Uint8Array(await readFile(path))
    const info = imageInfo(bytes)
    return info ? { ok: true, bytes, info } : { ok: false, error: INVALID_IMAGE }
  } catch {
    return { ok: false, error: INVALID_IMAGE }
  }
}
