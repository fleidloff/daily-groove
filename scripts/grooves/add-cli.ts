import { resolve } from 'node:path'
import { addGrooves, type AddOptions } from './add.ts'

const USAGE = 'usage: npm run grooves:add <n>   — mint n new grooves (n a positive integer)'

export async function main(
  argv: readonly string[] = [],
  options: AddOptions = {},
): Promise<number> {
  const out = options.log ?? ((line: string) => console.log(line))
  const fail = options.log ?? ((line: string) => console.error(line))

  const raw = argv[0]
  if (raw === undefined) {
    fail(`grooves:add — how many grooves? ${USAGE}`)
    return 1
  }

  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    fail(`grooves:add — "${raw}" is not a positive integer. ${USAGE}`)
    return 1
  }

  try {
    const minted = await addGrooves(n, { ...options, log: out })
    out(`grooves:add — minted ${minted.length} groove(s):`)
    for (const spec of minted) {
      out(`  ${spec.id}  ${spec.template.padEnd(16)} seed ${spec.seed}`)
    }
    out('  review them, then commit the audio, catalogue, manifest and lock together.')
    return 0
  } catch (error) {
    fail(`grooves:add — ${error instanceof Error ? error.message : String(error)}`)
    fail('  nothing was written; the catalogue is unchanged.')
    return 1
  }
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  process.exitCode = await main(process.argv.slice(2))
}
