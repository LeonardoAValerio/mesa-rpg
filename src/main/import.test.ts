import { mkdtempSync, truncateSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { imageInfo } from '../core/image-info'
import { readImageFile } from './import'

const dir = mkdtempSync(join(tmpdir(), 'mesa-import-'))

function pngBytes(w: number, h: number): Buffer {
  const p = new PNG({ width: w, height: h })
  p.data.fill(200)
  return PNG.sync.write(p)
}

describe('readImageFile', () => {
  it('[C25] MAP-09 refuses a .txt renamed to .png and a file over 50 MB with "Imagem inválida"', async () => {
    const fake = join(dir, 'mapa.png')
    writeFileSync(fake, 'isto é um texto, não uma imagem')
    expect(await readImageFile(fake)).toEqual({ ok: false, error: 'Imagem inválida' })

    const huge = join(dir, 'enorme.png')
    writeFileSync(huge, pngBytes(4, 4))
    truncateSync(huge, 50 * 1024 * 1024 + 1)
    expect(await readImageFile(huge)).toEqual({ ok: false, error: 'Imagem inválida' })

    expect(await readImageFile(join(dir, 'nao-existe.png'))).toEqual({ ok: false, error: 'Imagem inválida' })
  })

  it('accepts a real PNG and reports its size', async () => {
    const ok = join(dir, 'ok.png')
    writeFileSync(ok, pngBytes(2000, 1500))
    const r = await readImageFile(ok)
    expect(r.ok && r.info).toEqual({ type: 'png', width: 2000, height: 1500 })
  })

  it('accepts a file of exactly 50 MB when it is an image', async () => {
    const edge = join(dir, 'limite.png')
    writeFileSync(edge, pngBytes(4, 4))
    truncateSync(edge, 50 * 1024 * 1024)
    expect((await readImageFile(edge)).ok).toBe(true)
  })
})

describe('imageInfo', () => {
  it('reads JPEG and WebP headers', () => {
    // SOI, APP0 (len 16), SOF0 with height 1500 and width 2000
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0), 0xff, 0xc0, 0x00, 0x11, 0x08, 0x05, 0xdc, 0x07, 0xd0, 0x03])
    expect(imageInfo(jpg)).toEqual({ type: 'jpeg', width: 2000, height: 1500 })
    const vp8x = new Uint8Array(30)
    vp8x.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
    vp8x.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8)
    vp8x.set([0xff, 0x01, 0x00, 0x7f, 0x01, 0x00], 24) // 511+1 x 383+1
    expect(imageInfo(vp8x)).toEqual({ type: 'webp', width: 512, height: 384 })
    expect(imageInfo(new Uint8Array([1, 2, 3]))).toBeNull()
  })
})
