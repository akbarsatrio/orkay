import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Root repo = dua level di atas scripts/lib/
export const ROOT = join(__dirname, '..', '..')
export const INSTANCES_DIR = join(ROOT, 'instances')
export const SERVER_DIR = join(ROOT, 'server')
export const CLIENT_DIR = join(ROOT, 'client')
export const MCP_DIR = join(ROOT, 'mcp')
export const BRAIN_DIR = join(ROOT, 'brain')
export const DEPLOY_OUT_DIR = join(ROOT, 'deploy')

export function instanceFile(name) {
  return join(INSTANCES_DIR, `${name}.json`)
}
