import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

let rl = null
function getRl() {
  if (!rl) rl = createInterface({ input: stdin, output: stdout })
  return rl
}

export function closePrompt() {
  if (rl) {
    rl.close()
    rl = null
  }
}

export async function ask(question, def = '') {
  const suffix = def ? ` [${def}]` : ''
  const answer = (await getRl().question(`${question}${suffix}: `)).trim()
  return answer || def
}

export async function askSecret(question, def = '') {
  // Tanpa masking penuh (Node readline tak native support), tapi kasih peringatan.
  const suffix = def ? ' [enter=pakai default]' : ''
  const answer = (await getRl().question(`${question}${suffix}: `)).trim()
  return answer || def
}

export async function confirm(question, def = true) {
  const hint = def ? 'Y/n' : 'y/N'
  const answer = (await getRl().question(`${question} (${hint}): `)).trim().toLowerCase()
  if (!answer) return def
  return answer === 'y' || answer === 'yes' || answer === 'ya'
}

export async function choose(question, options, def = 0) {
  stdout.write(`${question}\n`)
  options.forEach((opt, i) => stdout.write(`  ${i + 1}) ${opt}\n`))
  const answer = (await getRl().question(`Pilih [${def + 1}]: `)).trim()
  const idx = answer ? Number(answer) - 1 : def
  if (Number.isNaN(idx) || idx < 0 || idx >= options.length) return def
  return idx
}

// Parse argv gaya --key=value dan --flag. Return { _: [...positional], key: value }.
export function parseArgs(argv) {
  const out = { _: [] }
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const body = arg.slice(2)
      const eq = body.indexOf('=')
      if (eq === -1) {
        out[body] = true
      } else {
        out[body.slice(0, eq)] = body.slice(eq + 1)
      }
    } else {
      out._.push(arg)
    }
  }
  return out
}
