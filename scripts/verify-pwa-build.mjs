import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'

const expectedBase = process.argv[2] ?? '/'
const outputDirectory = new URL('../dist/', import.meta.url)

await Promise.all([
  access(new URL('sw.js', outputDirectory), constants.R_OK),
  access(new URL('manifest.webmanifest', outputDirectory), constants.R_OK),
])

const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', outputDirectory), 'utf8'))
if (manifest.start_url !== expectedBase || manifest.scope !== expectedBase) {
  throw new Error(`Expected manifest start_url and scope to be ${expectedBase}`)
}

if (!Array.isArray(manifest.icons) || !manifest.icons.some(({ purpose }) => purpose === 'maskable')) {
  throw new Error('Expected the production manifest to include a maskable icon')
}
