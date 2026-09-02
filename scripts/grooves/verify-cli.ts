import { join, resolve } from 'node:path'
import { readLock, verifyLock, type Lock } from './lock.ts'

const HERE = import.meta.dirname

export const DEFAULT_LOCK_PATH = join(HERE, 'grooves.lock.json')
export const DEFAULT_CATALOGUE_PATH = join(HERE, 'catalogue.json')
export const DEFAULT_GROOVE_DIR = join(HERE, '../../public/grooves')
export const DEFAULT_MANIFEST_PATH = join(
  HERE,
  '../../src/features/daily-groove/data/grooves.generated.ts',
)
export const DEFAULT_NOTES_DIR = join(HERE, '../../public/notes')
export const DEFAULT_NOTES_MANIFEST_PATH = join(
  HERE,
  '../../src/features/daily-groove/data/notes.generated.ts',
)
export const DEFAULT_PACK_DECLARATION_PATH = join(HERE, 'samples/pack.json')

export type VerifyOptions = {
  lockPath?: string
  grooveDir?: string
  cataloguePath?: string
  manifestPath?: string
  notesDir?: string
  notesManifestPath?: string
  packDeclarationPath?: string
  log?: (line: string) => void
}

export async function main(options: VerifyOptions = {}): Promise<number> {
  const log = options.log ?? ((line: string) => console.error(line))
  const lockPath = options.lockPath ?? DEFAULT_LOCK_PATH
  const paths = {
    grooveDir: options.grooveDir ?? DEFAULT_GROOVE_DIR,
    cataloguePath: options.cataloguePath ?? DEFAULT_CATALOGUE_PATH,
    manifestPath: options.manifestPath ?? DEFAULT_MANIFEST_PATH,
    notesDir: options.notesDir ?? DEFAULT_NOTES_DIR,
    notesManifestPath: options.notesManifestPath ?? DEFAULT_NOTES_MANIFEST_PATH,
    packDeclarationPath: options.packDeclarationPath ?? DEFAULT_PACK_DECLARATION_PATH,
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
    log(
      `grooves:verify — ${lock.grooves.length} grooves, ${lock.notes?.length ?? 0} notes, the manifests and the catalogue all match the lock.`,
    )
    return 0
  }

  log(`grooves:verify — ${failures.length} problem(s) with the committed artifacts:`)
  for (const failure of failures) log(`  [${failure.check}] ${failure.detail}`)
  return 1
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  process.exitCode = await main()
}
