import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = join(__dirname, '..')
interface Target {
  target: string
  arch?: string[]
}
const config = parse(readFileSync(join(root, 'electron-builder.yml'), 'utf8')) as {
  win: { target: Array<Target | string>; signAndEditExecutable?: boolean }
  nsis?: Record<string, unknown>
  portable?: unknown
  publish: Record<string, unknown>
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const targetName = (t: Target | string): string => (typeof t === 'string' ? t : t.target)

describe('electron-builder config', () => {
  it('[C1] UPD-01 the Windows build is a one-click NSIS installer per user, named MesaRPG-Setup-<versão>', () => {
    expect(config.win.target.map(targetName)).toEqual(['nsis'])
    expect(config.win.target[0]).toMatchObject({ target: 'nsis', arch: ['x64'] })
    expect(config.nsis).toMatchObject({
      oneClick: true,
      perMachine: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      artifactName: 'MesaRPG-Setup-${version}.${ext}'
    })
    // `npm run dist` packages in electron-builder's Wine image (NSIS needs Wine on Linux), never publishing.
    expect(pkg.scripts.dist).toBe('scripts/dist-docker.sh')
    const dist = readFileSync(join(root, 'scripts', 'dist-docker.sh'), 'utf8')
    expect(dist).toContain('npx electron-builder --win nsis --x64 --publish never')
    expect(dist).toMatch(/^IMAGE=electronuserland\/builder:\d+-wine-\d+\.\d+$/m) // an exact tag, never latest
  })

  it('[C2] UPD-02 the build has no portable target', () => {
    expect(config.win.target.map(targetName)).not.toContain('portable')
    expect(config.portable).toBeUndefined()
    for (const script of [pkg.scripts.dist, pkg.scripts.release]) expect(script).not.toMatch(/portable/)
  })

  it('[C23] REL-04 updates and releases point at the GitHub repository LeonardoAValerio/mesa-rpg as public releases', () => {
    expect(config.publish).toEqual({ provider: 'github', owner: 'LeonardoAValerio', repo: 'mesa-rpg', releaseType: 'release' })
    expect(pkg.scripts.release).toBe('electron-vite build && electron-builder --win nsis --x64 --publish always')
  })
})
