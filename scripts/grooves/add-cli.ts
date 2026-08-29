import { resolve } from 'node:path'
import { addGrooves, type AddOptions } from './add.ts'

/**
 * `npm run grooves:add <n>` — mint n new grooves into the catalogue.
 *
 * It writes into the working tree and never touches git: reviewing and
 * committing the new audio, catalogue entries, manifest and lock is the
 * operator's job.
 */

const USAGE = 'usage: npm run grooves:add <n>   — mint n new grooves (n a positive integer)'

/** Runs a mint and resolves to the process exit code: 0 minted, 1 refused. */
export async function main(
  argv: readonly string[] = [],
  options: AddOptions = {},
): Promise<number> {
  const out = options.log ?? ((line: string) => console.log(line))
  // Failures go to stderr by default, so a broken run is visible in a build log.
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
    // R8: nothing was written, so the tree is exactly as it was.
    fail(`grooves:add — ${error instanceof Error ? error.message : String(error)}`)
    fail('  nothing was written; the catalogue is unchanged.')
    return 1
  }
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  process.exitCode = await main(process.argv.slice(2))
}
