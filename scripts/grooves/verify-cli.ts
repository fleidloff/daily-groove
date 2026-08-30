import { join, resolve } from 'node:path'
import { readLock, verifyLock, type Lock } from './lock.ts'

/**
 * `npm run grooves:verify` — the build guard, wired as `prebuild`.
 *
 * It reads the committed lock and compares it against the committed audio, the
 * generated manifest and the catalogue. It renders nothing, so it needs no
 * ffmpeg and no sample pack (R13): its only imports are `path` and `lock.ts`,
 * and lock.test.ts asserts that by reading this file.
 */

const HERE = import.meta.dirname

export const DEFAULT_LOCK_PATH = join(HERE, 'grooves.lock.json')
export const DEFAULT_CATALOGUE_PATH = join(HERE, 'catalogue.json')
export const DEFAULT_GROOVE_DIR = join(HERE, '../../public/grooves')
export const DEFAULT_MANIFEST_PATH = join(
  HERE,
  '../../src/features/daily-groove/data/grooves.generated.ts',
)

export type VerifyOptions = {
  lockPath?: string
  grooveDir?: string
  cataloguePath?: string
  manifestPath?: string
  /** Where messages go. Injected by tests; defaults to stderr. */
  log?: (line: string) => void
}

/** Runs the guard and resolves to the process exit code: 0 intact, 1 broken. */
export async function main(options: VerifyOptions = {}): Promise<number> {
  const log = options.log ?? ((line: string) => console.error(line))
  const lockPath = options.lockPath ?? DEFAULT_LOCK_PATH
  const paths = {
    grooveDir: options.grooveDir ?? DEFAULT_GROOVE_DIR,
    cataloguePath: options.cataloguePath ?? DEFAULT_CATALOGUE_PATH,
    manifestPath: options.manifestPath ?? DEFAULT_MANIFEST_PATH,
  }

  let lock: Lock | null
  try {
    lock = readLock(lockPath)
  } catch (error) {
    log(`grooves:verify — the lock file could not be read: ${lockPath}`)
    log(`  ${error instanceof Error ? error.message : String(error)}`)
    return 1
  }

  if (lock === null) {
    log(`grooves:verify — no lock file at ${lockPath}; run \`npm run grooves\` to write one.`)
    return 1
  }

  const failures = verifyLock(lock, paths)
  if (failures.length === 0) {
    log(`grooves:verify — ${lock.grooves.length} grooves, the manifest and the catalogue all match the lock.`)
    return 0
  }

  log(`grooves:verify — ${failures.length} problem(s) with the committed grooves:`)
  for (const failure of failures) log(`  [${failure.check}] ${failure.detail}`)
  return 1
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  process.exitCode = await main()
}
