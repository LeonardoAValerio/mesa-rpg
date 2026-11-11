import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Every temporary folder a test run makes (campaigns, caches, Electron profiles, fixture images) goes under one folder
 * of its own, removed when the run ends: TMPDIR is read by os.tmpdir() in the workers and the Electron apps they start.
 */
export default function setup(): () => void {
  const root = mkdtempSync(join(tmpdir(), 'mesa-run-'))
  process.env.TMPDIR = root
  return () => rmSync(root, { recursive: true, force: true })
}
