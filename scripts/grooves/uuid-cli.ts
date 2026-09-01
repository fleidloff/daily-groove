import { CATALOGUE_PATH, readCatalogue, writeCatalogue } from './catalogue.ts'
import { assignMissingUuids, isCanonicalUuid } from './uuid.ts'

/**
 * `npm run grooves:uuid` — mint a uuid for every catalogue entry that has none.
 *
 * It ran once to backfill the grooves that predate the field (F12 E1 R6), and it
 * stays because it is the repair path: if a hand edit ever drops or mangles a
 * uuid, `grooves:verify` names the groove and this puts one back. Idempotent, so
 * a second run mints nothing and leaves catalogue.json byte-identical.
 *
 * It touches the catalogue only. The uuid it writes reaches the app on the next
 * `npm run grooves -- --manifest-only`, which is also what re-records the
 * catalogue's hash in the lock.
 */

export type BackfillOptions = {
  cataloguePath?: string
  /** Injected by tests; defaults to `crypto.randomUUID()` through `uuid.ts`. */
  mint?: () => string
  log?: (line: string) => void
}

export type BackfillResult = { minted: number; kept: number }

export function backfillUuids(options: BackfillOptions = {}): BackfillResult {
  const cataloguePath = options.cataloguePath ?? CATALOGUE_PATH
  const log = options.log ?? ((line: string) => console.log(line))

  const before = readCatalogue(cataloguePath)
  const kept = before.filter((spec) => isCanonicalUuid(spec.uuid)).length
  const after = assignMissingUuids(before, options.mint)
  writeCatalogue(after, cataloguePath)

  const minted = after.length - kept
  log(
    `grooves:uuid — ${minted} minted, ${kept} already present, ${after.length} grooves in the catalogue`,
  )
  if (minted > 0) {
    log('  run `npm run grooves -- --manifest-only` to carry the new uuids into the manifest')
  }
  return { minted, kept }
}

const entry = process.argv[1]
if (entry !== undefined && entry === import.meta.filename) {
  backfillUuids()
}
