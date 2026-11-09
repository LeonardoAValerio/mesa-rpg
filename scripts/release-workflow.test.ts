import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = join(__dirname, '..')
const RELEASE = 'npm run release -- -c.releaseInfo.releaseName=${{ github.ref_name }}'

interface Step {
  name?: string
  uses?: string
  run?: string
  with?: Record<string, unknown>
  env?: Record<string, string>
}
interface Workflow {
  on: { push: { tags: string[]; branches?: unknown } }
  permissions: Record<string, string>
  jobs: Record<string, { 'runs-on': string; steps: Step[] }>
}

const workflow = parse(readFileSync(join(root, '.github', 'workflows', 'release.yml'), 'utf8')) as Workflow
const jobs = Object.values(workflow.jobs)
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }

/** The config electron-builder's CLI builds from these arguments (the same parser `electron-builder` runs). */
function electronBuilderConfig(args: string[]): unknown {
  const load = createRequire(__filename) // electron-builder's CLI internals have no typings to import
  const yargs = load('yargs')(['--win', 'nsis', ...args])
  const builder = load('electron-builder/out/builder')
  builder.configureBuildCommand(yargs)
  return builder.normalizeOptions(yargs.parse()).config
}

/** Index of the single step whose `run` is exactly `cmd`; fails when absent or repeated. */
function stepIndex(steps: Step[], cmd: string): number {
  const found = steps.flatMap((s, i) => (s.run?.trim() === cmd ? [i] : []))
  expect(found, `one step runs "${cmd}"`).toHaveLength(1)
  return found[0]
}

/** REL-03: each gate runs before the step that publishes; `steps` is the job's list in order. */
function gatesBeforePublish(steps: Step[]): void {
  const publish = stepIndex(steps, RELEASE)
  for (const gate of ['node scripts/check-tag.mjs', 'npm run typecheck', 'npx vitest run']) {
    expect(stepIndex(steps, gate), `${gate} runs before the release`).toBeLessThan(publish)
  }
  expect(stepIndex(steps, 'npm ci')).toBeLessThan(stepIndex(steps, 'node scripts/check-tag.mjs'))
}

describe('release workflow', () => {
  it('[C20] REL-01 runs on v* tags, on windows-latest, and publishes with npm run release as a public release', () => {
    expect(workflow.on).toEqual({ push: { tags: ['v*'] } })
    expect(workflow.permissions).toEqual({ contents: 'write' })
    expect(jobs).toHaveLength(1)
    const [job] = jobs
    expect(job['runs-on']).toBe('windows-latest')
    const release = job.steps[stepIndex(job.steps, RELEASE)]
    expect(release.env).toEqual({ GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' })
    expect(pkg.scripts.release).toBe('electron-vite build && electron-builder --win nsis --x64 --publish always')
    const setup = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'))
    expect(setup?.with).toMatchObject({ 'node-version-file': '.nvmrc', cache: 'npm' })
    expect(job.steps[0].uses).toMatch(/^actions\/checkout@/)
    // The release is named after the tag: electron-builder's own CLI turns the extra args into releaseInfo.releaseName.
    const extra = release.run!.split(' -- ')[1].replace('${{ github.ref_name }}', 'v0.2.0').split(' ')
    expect(electronBuilderConfig(extra)).toEqual({ releaseInfo: { releaseName: 'v0.2.0' } })
    // releaseType: release (not draft) comes from electron-builder.yml, which C23 checks.
    expect(readFileSync(join(root, 'electron-builder.yml'), 'utf8')).toMatch(/^ {2}releaseType: release$/m)
  })

  it('[C22] REL-03 the tag check, typecheck and unit tests run before the publish step', () => {
    gatesBeforePublish(jobs[0].steps)
  })

  it('REL-03 the order check fails when the publish step is moved before the tests', () => {
    const steps = [...jobs[0].steps]
    const publish = steps.splice(stepIndex(steps, RELEASE), 1)[0]
    steps.splice(stepIndex(steps, 'npx vitest run'), 0, publish)
    expect(() => gatesBeforePublish(steps)).toThrow()
  })
})
