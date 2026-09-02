import { CATALOGUE_PATH, readCatalogue, writeCatalogue } from './catalogue.ts'
import { assignMissingUuids, isCanonicalUuid } from './uuid.ts'

export type BackfillOptions = {
  cataloguePath?: string
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
