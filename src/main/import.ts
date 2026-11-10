import { audioInfo, MAX_AUDIO_BYTES, type AudioType } from '../core/sound'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { imageInfo, INVALID_IMAGE, MAX_IMAGE_BYTES, type ImageInfo } from '../core/image-info'
import { baseName, parseManifest, type TokenMeta } from '../core/manifest'

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

/** SOM-03: an MP3, OGG, WAV or M4A file of at most 100 MB, by its own header. */
export async function readAudioFile(path: string): Promise<{ ok: true; bytes: Uint8Array; type: AudioType } | { ok: false }> {
  try {
    const st = await stat(path)
    if (!st.isFile() || st.size > MAX_AUDIO_BYTES) return { ok: false }
    const bytes = new Uint8Array(await readFile(path))
    const type = audioInfo(bytes)
    return type ? { ok: true, bytes, type } : { ok: false }
  } catch {
    return { ok: false }
  }
}

export interface ImportedToken extends TokenMeta {
  bytes: Uint8Array
}

/** TOK-01: every PNG in the folder becomes a token; its name comes from the file (or the manifest). */
export async function importTokenFolder(dir: string): Promise<{ tokens: ImportedToken[]; skipped: string[] }> {
  const files = (await readdir(dir)).filter((f) => /\.png$/i.test(f)).sort((a, b) => a.localeCompare(b))
  const tokens: ImportedToken[] = []
  const skipped: string[] = []
  for (const file of files) {
    const img = await readImageFile(join(dir, file))
    if (!img.ok) {
      skipped.push(file)
      continue
    }
    const manifest = await readFile(join(dir, `${baseName(file)}.json`), 'utf8').catch(() => null)
    tokens.push({ ...parseManifest(manifest, file), bytes: img.bytes })
  }
  return { tokens, skipped }
}
