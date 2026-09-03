import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_LOCK_PATH, generate } from './cli.ts'
import { readLock } from './lock.ts'

const committed = readLock(DEFAULT_LOCK_PATH)
if (committed === null) {
  console.error(`no committed lock at ${DEFAULT_LOCK_PATH}`)
  process.exit(1)
}

const scratch = mkdtempSync(join(tmpdir(), 'groove-rerender-'))
await generate({
  outDir: join(scratch, 'grooves'),
  manifestPath: join(scratch, 'grooves.generated.ts'),
  lockPath: join(scratch, 'grooves.lock.json'),
})

const fresh = readLock(join(scratch, 'grooves.lock.json'))
if (fresh === null) {
  console.error(`the render wrote no lock into ${scratch}`)
  process.exit(1)
}

let mismatches = 0

for (const entry of fresh.grooves) {
  const recorded = committed.grooves.find((g) => g.id === entry.id)
  if (recorded === undefined) {
    console.log(`${entry.id}  NOT IN THE LOCK`)
    mismatches++
    continue
  }
  if (entry.sha256 === recorded.sha256 && entry.bytes === recorded.bytes) {
    console.log(`${entry.id}  match  ${entry.bytes} bytes`)
  } else {
    console.log(
      `${entry.id}  MISMATCH  rendered ${entry.bytes} bytes ${entry.sha256.slice(0, 12)}, the lock records ${recorded.bytes} bytes ${recorded.sha256.slice(0, 12)}`,
    )
    mismatches++
  }
}

for (const recorded of committed.grooves) {
  if (!fresh.grooves.some((g) => g.id === recorded.id)) {
    console.log(`${recorded.id}  NOT RENDERED`)
    mismatches++
  }
}

const manifestSame = fresh.manifestSha256 === committed.manifestSha256
const catalogueSame = fresh.catalogueSha256 === committed.catalogueSha256

console.log(
  manifestSame
    ? 'manifest   match'
    : `manifest   MISMATCH  rendered ${fresh.manifestSha256}, the lock records ${committed.manifestSha256}`,
)
console.log(catalogueSame ? 'catalogue  match' : 'catalogue  MISMATCH')
console.log(
  `${committed.grooves.length - mismatches} of ${committed.grooves.length} grooves match`,
)
console.log(`scratch: ${scratch}`)

if (mismatches > 0 || !manifestSame || !catalogueSame) process.exit(1)
