export const MAX_IMAGE_BYTES = 50 * 1024 * 1024
export const INVALID_IMAGE = 'Imagem inválida'

export interface ImageInfo {
  type: 'png' | 'jpeg' | 'webp'
  width: number
  height: number
}

const u16be = (b: Uint8Array, i: number): number => (b[i] << 8) | b[i + 1]
const u32be = (b: Uint8Array, i: number): number => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]
const u16le = (b: Uint8Array, i: number): number => b[i] | (b[i + 1] << 8)
const u24le = (b: Uint8Array, i: number): number => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const ascii = (b: Uint8Array, i: number, n: number): string => String.fromCharCode(...b.subarray(i, i + n))

function png(b: Uint8Array): ImageInfo | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (b.length < 24 || sig.some((v, i) => b[i] !== v) || ascii(b, 12, 4) !== 'IHDR') return null
  return { type: 'png', width: u32be(b, 16), height: u32be(b, 20) }
}

function jpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return null
  let i = 2
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1]
    if (marker === 0xff) {
      i++
      continue
    }
    const len = u16be(b, i + 2)
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) return { type: 'jpeg', height: u16be(b, i + 5), width: u16be(b, i + 7) }
    i += 2 + len
  }
  return null
}

function webp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') return null
  const chunk = ascii(b, 12, 4)
  if (chunk === 'VP8 ') return { type: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff }
  if (chunk === 'VP8L') {
    if (b[20] !== 0x2f) return null
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
    return { type: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { type: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 }
  return null
}

/** MAP-09: type and size of a PNG, JPEG or WebP from its header; null for anything else. */
export function imageInfo(bytes: Uint8Array): ImageInfo | null {
  const info = png(bytes) ?? jpeg(bytes) ?? webp(bytes)
  if (!info || info.width < 1 || info.height < 1) return null
  return info
}
