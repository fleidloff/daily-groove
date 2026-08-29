import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The build guard's evidence.
 *
 * This module deliberately imports nothing but `fs`, `crypto` and `path`. The
 * guard runs on a machine with no ffmpeg and no sample pack (R13): it compares
 * committed artifacts against recorded checksums and never renders anything.
 * Adding an import from voices/mix/encode/pack/decode/pcmio/events/cli here
 * breaks that guarantee — and lock.test.ts asserts it by reading this source.
 */

/** A named reason something did not pass. Shared shape with the quality gate. */
export type { GateFailure } from './types.ts'
import type { GateFailure } from './types.ts'

export type LockEntry = { id: string; sha256: string; bytes: number }

/**
 * Hashes for all three artifacts of one render: the audio, the manifest it
 * produced, and the catalogue it was produced from. The catalogue's hash is
 * what catches the staleness case the other two cannot see — someone appends
 * to catalogue.json, forgets to regenerate, and commits: manifest and lock
 * still agree with each other while disagreeing with their input.
 */
export type Lock = {
  catalogueSha256: string
  manifestSha256: string
  grooves: LockEntry[]
}

export type LockPaths = {
  grooveDir: string
  cataloguePath: string
  manifestPath: string
}

const REGENERATE = 'run `npm run grooves` to regenerate'

/** The audio file one catalogue id renders to. */
export function grooveFile(grooveDir: string, id: string): string {
  return join(grooveDir, `${id}.mp3`)
}

/** The sha256 of a file's bytes, hex-encoded. Throws if the file is missing. */
export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function sizeOrNull(path: string): number | null {
  try {
    const stat = statSync(path)
    return stat.isFile() ? stat.size : null
  } catch {
    return null
  }
}

/** Entries sorted by id, so the committed lock has stable diffs. */
function sorted(grooves: readonly LockEntry[]): LockEntry[] {
  return [...grooves].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** The committed lock, or `null` when there is none. */
export function readLock(path: string): Lock | null {
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return null
  }
  const parsed = JSON.parse(text) as Lock
  return {
    catalogueSha256: parsed.catalogueSha256,
    manifestSha256: parsed.manifestSha256,
    grooves: sorted(parsed.grooves ?? []),
  }
}

export function writeLock(lock: Lock, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const ordered: Lock = {
    catalogueSha256: lock.catalogueSha256,
    manifestSha256: lock.manifestSha256,
    grooves: sorted(lock.grooves),
  }
  writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8')
}

/**
 * Hash the three artifacts of a render into a lock. Called by `npm run grooves`
 * once the audio and the manifest are on disk.
 */
export function buildLock(paths: LockPaths, ids: readonly string[]): Lock {
  return {
    catalogueSha256: sha256File(paths.cataloguePath),
    manifestSha256: sha256File(paths.manifestPath),
    grooves: sorted(
      ids.map((id) => {
        const file = grooveFile(paths.grooveDir, id)
        return { id, sha256: sha256File(file), bytes: statSync(file).size }
      }),
    ),
  }
}

/** One generated artifact whose hash must still match what was recorded. */
function checkArtifact(
  path: string,
  expected: string,
  staleCheck: string,
  what: string,
): GateFailure | null {
  if (sizeOrNull(path) === null) {
    return { check: 'missing', detail: `${what} is missing: ${path}` }
  }
  if (sha256File(path) !== expected) {
    return {
      check: staleCheck,
      detail: `${what} does not match the checksum recorded when the grooves were rendered: ${path} — ${REGENERATE}`,
    }
  }
  return null
}

/**
 * Compare the committed artifacts against the lock. Returns one failure per
 * problem, each naming the file — an empty array means the tree is intact.
 */
export function verifyLock(lock: Lock, paths: LockPaths): GateFailure[] {
  const failures: GateFailure[] = []

  for (const entry of lock.grooves) {
    const file = grooveFile(paths.grooveDir, entry.id)
    const bytes = sizeOrNull(file)

    if (bytes === null) {
      failures.push({ check: 'missing', detail: `${entry.id}: audio file is missing: ${file}` })
      continue
    }
    if (bytes === 0) {
      failures.push({ check: 'empty', detail: `${entry.id}: audio file is zero bytes: ${file}` })
      continue
    }
    if (bytes !== entry.bytes) {
      failures.push({
        check: 'checksum',
        detail: `${entry.id}: audio file is ${bytes} bytes, the lock records ${entry.bytes}: ${file}`,
      })
      continue
    }
    const sha256 = sha256File(file)
    if (sha256 !== entry.sha256) {
      failures.push({
        check: 'checksum',
        detail: `${entry.id}: audio file checksum ${sha256.slice(0, 12)} does not match the recorded ${entry.sha256.slice(0, 12)}: ${file}`,
      })
    }
  }

  const manifest = checkArtifact(
    paths.manifestPath,
    lock.manifestSha256,
    'manifest-stale',
    'the generated manifest',
  )
  if (manifest) failures.push(manifest)

  const catalogue = checkArtifact(
    paths.cataloguePath,
    lock.catalogueSha256,
    'catalogue-stale',
    'the catalogue',
  )
  if (catalogue) failures.push(catalogue)

  return failures
}
