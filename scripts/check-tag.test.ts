import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }

/** Runs the script as the Action does, with GITHUB_REF_NAME set to `tag`. */
function checkTag(tag: string): { status: number | null; stderr: string } {
  const env = { ...process.env, GITHUB_REF_NAME: tag }
  const r = spawnSync(process.execPath, [join(root, 'scripts', 'check-tag.mjs')], { env, encoding: 'utf8' })
  return { status: r.status, stderr: r.stderr }
}

const bump = (v: string): string => v.replace(/\d+$/, (n) => String(Number(n) + 1))

describe('check-tag', () => {
  it('[C21] REL-02 a tag different from "v" + the package.json version fails with the message', () => {
    const other = `v${bump(version)}`
    expect(checkTag(other)).toEqual({ status: 1, stderr: `Tag ${other} não corresponde à versão v${version} do package.json\n` })
    expect(checkTag(version)).toEqual({ status: 1, stderr: `Tag ${version} não corresponde à versão v${version} do package.json\n` })
  })

  it('REL-02 the tag "v" + the package.json version passes', () => {
    expect(checkTag(`v${version}`)).toMatchObject({ status: 0, stderr: '' })
  })
})
