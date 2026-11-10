import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface Settings {
  lastCampaign?: string
}

/** The app's own small settings (the last campaign, CAMP-06), in a JSON file under userData. */
export async function readSettings(file: string): Promise<Settings> {
  try {
    const data = JSON.parse(await readFile(file, 'utf8')) as unknown
    return data && typeof data === 'object' ? (data as Settings) : {}
  } catch {
    return {}
  }
}

export async function writeSettings(file: string, patch: Settings): Promise<void> {
  const next = { ...(await readSettings(file)), ...patch }
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(next))
}
