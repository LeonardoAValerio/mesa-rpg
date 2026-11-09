// REL-02: the release tag must be "v" + the package.json version, or nothing is published.
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const tag = process.env.GITHUB_REF_NAME ?? ''
if (tag !== `v${version}`) {
  console.error(`Tag ${tag} não corresponde à versão v${version} do package.json`)
  process.exit(1)
}
console.log(`Tag ${tag} corresponde ao package.json`)
