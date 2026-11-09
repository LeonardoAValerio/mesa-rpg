import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = join(__dirname, '..')
const CREATE = 'gh release create "$GITHUB_REF_NAME" --draft --verify-tag --title "$GITHUB_REF_NAME" --generate-notes'
const RELEASE = 'npm run release'
const PUBLISH = 'gh release edit "$GITHUB_REF_NAME" --draft=false'

interface Step {
  name?: string
  uses?: string
  run?: string
  shell?: string
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

/**
 * The release electron-builder's own GitHub publisher uploads into, when the releases listed for the repository
 * are `existing`; `created` tells whether it would create another one.
 */
async function releaseUsedByElectronBuilder(existing: object[]): Promise<{ release: unknown; created: boolean }> {
  const load = createRequire(__filename) // electron-publish has no typings for these internals
  const { GitHubPublisher } = load('electron-publish')
  const { CancellationToken } = load('builder-util-runtime')
  const token = process.env.GH_TOKEN
  process.env.GH_TOKEN = 'test-token'
  try {
    const info = { provider: 'github', owner: 'LeonardoAValerio', repo: 'mesa-rpg', releaseType: 'release' }
    const publisher = new GitHubPublisher({ cancellationToken: new CancellationToken(), progress: null }, info, '0.3.0', { publish: 'always' })
    let created = false
    publisher.githubRequest = async () => existing
    publisher.createRelease = async () => ((created = true), { id: 'new' })
    return { release: await publisher._release.value, created }
  } finally {
    if (token === undefined) delete process.env.GH_TOKEN
    else process.env.GH_TOKEN = token
  }
}

/** Index of the single step whose `run` is exactly `cmd`; fails when absent or repeated. */
function stepIndex(steps: Step[], cmd: string): number {
  const found = steps.flatMap((s, i) => (s.run?.trim() === cmd ? [i] : []))
  expect(found, `one step runs "${cmd}"`).toHaveLength(1)
  return found[0]
}

/** REL-03: each gate runs before the first step that touches the release; `steps` is the job's list in order. */
function gatesBeforePublish(steps: Step[]): void {
  const publish = Math.min(stepIndex(steps, CREATE), stepIndex(steps, RELEASE), stepIndex(steps, PUBLISH))
  for (const gate of ['node scripts/check-tag.mjs', 'npm run typecheck', 'npx vitest run']) {
    expect(stepIndex(steps, gate), `${gate} runs before the release`).toBeLessThan(publish)
  }
  expect(stepIndex(steps, 'npm ci')).toBeLessThan(stepIndex(steps, 'node scripts/check-tag.mjs'))
}

describe('release workflow', () => {
  it('[C20] REL-01 runs on v* tags, on windows-latest, and publishes one public release named v<versão> with npm run release', async () => {
    expect(workflow.on).toEqual({ push: { tags: ['v*'] } })
    expect(workflow.permissions).toEqual({ contents: 'write' })
    expect(jobs).toHaveLength(1)
    const [job] = jobs
    expect(job['runs-on']).toBe('windows-latest')
    const setup = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'))
    expect(setup?.with).toMatchObject({ 'node-version-file': '.nvmrc', cache: 'npm' })
    expect(job.steps[0].uses).toMatch(/^actions\/checkout@/)
    expect(pkg.scripts.release).toBe('electron-vite build && electron-builder --win nsis --x64 --publish always')
    // A draft named after the tag, then the upload, then the draft goes public: in that order.
    const create = stepIndex(job.steps, CREATE)
    const release = stepIndex(job.steps, RELEASE)
    const publish = stepIndex(job.steps, PUBLISH)
    expect(create).toBeLessThan(release)
    expect(release).toBeLessThan(publish)
    for (const i of [create, release, publish]) expect(job.steps[i].env).toEqual({ GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' })
    // The runner's default shell is PowerShell, where $GITHUB_REF_NAME is not the tag and `--` is swallowed.
    for (const step of job.steps.filter((s) => s.run?.includes('$GITHUB_REF_NAME') || s.run?.includes(' -- '))) {
      expect(step.shell, `"${step.run}" runs in bash`).toBe('bash')
    }
    // electron-builder uploads into that draft instead of creating releases of its own (v0.2.0 got two).
    const draft = { id: 7, tag_name: 'v0.3.0', draft: true, upload_url: 'https://uploads/x{?name}' }
    expect(await releaseUsedByElectronBuilder([draft])).toEqual({ release: draft, created: false })
    expect((await releaseUsedByElectronBuilder([])).created).toBe(true)
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
