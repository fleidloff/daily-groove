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
  /**
   * The reference notes, their manifest, and the pack they were rendered from.
   * All optional: a lock written before `npm run notes` existed still parses,
   * and `verifyLock` reports on whichever families it finds.
   */
  notes?: LockEntry[]
  notesManifestSha256?: string
  packSha256?: string
}

export type LockPaths = {
  grooveDir: string
  cataloguePath: string
  manifestPath: string
  notesDir?: string
  notesManifestPath?: string
  packDeclarationPath?: string
}

const REGENERATE = 'run `npm run grooves` to regenerate'
const RERENDER_NOTES = 'run `npm run notes` to re-render the reference notes'

/** The audio file one catalogue id renders to. */
export function grooveFile(grooveDir: string, id: string): string {
  return join(grooveDir, `${id}.mp3`)
}

/**
 * The audio file one reference note renders to.
 *
 * A note is keyed by its root — `C♯`, `E♭` — and named by that root's
 * ASCII slug, so `note-e-flat.mp3` survives a reordering of ROOTS the way
 * `note-04.mp3` would not. That is why this cannot be `grooveFile` with another
 * directory: the id is not the file name.
 */
export function noteFile(notesDir: string, id: string): string {
  const slug = id
    .toLowerCase()
    .replaceAll('\u266f', '-sharp')
    .replaceAll('\u266d', '-flat')
  return join(notesDir, `note-${slug}.mp3`)
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
  return withNotes(
    {
      catalogueSha256: parsed.catalogueSha256,
      manifestSha256: parsed.manifestSha256,
      grooves: sorted(parsed.grooves ?? []),
    },
    parsed,
  )
}

/**
 * Copy the note family onto a lock, omitting each field that is absent.
 *
 * Both `readLock` and `writeLock` project their result field by field rather
 * than spreading, so the committed JSON keeps a stable key order. That
 * projection is exactly where a field that no one has thought about since gets
 * silently dropped — which is what would happen to everything `npm run notes`
 * records the next time `npm run grooves` wrote the lock. One function, used by
 * both, so there is one place to add the next family.
 */
function withNotes(base: Lock, source: Lock): Lock {
  const out: Lock = base
  if (source.notes !== undefined) out.notes = sorted(source.notes)
  if (source.notesManifestSha256 !== undefined) {
    out.notesManifestSha256 = source.notesManifestSha256
  }
  if (source.packSha256 !== undefined) out.packSha256 = source.packSha256
  return out
}

/**
 * One lock from two commands. `npm run grooves` renders no note and `npm run
 * notes` renders no groove, so each writes what it can vouch for and keeps
 * whatever the other left behind.
 */
export function mergeLock(existing: Lock | null, next: Lock): Lock {
  if (existing === null) return next
  return withNotes(
    withNotes(
      {
        catalogueSha256: next.catalogueSha256,
        manifestSha256: next.manifestSha256,
        grooves: sorted(next.grooves),
      },
      existing,
    ),
    next,
  )
}

export function writeLock(lock: Lock, path: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const ordered: Lock = withNotes(
    {
      catalogueSha256: lock.catalogueSha256,
      manifestSha256: lock.manifestSha256,
      grooves: sorted(lock.grooves),
    },
    lock,
  )
  writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8')
}

/**
 * Hash a render's artifacts into a lock. Called by `npm run grooves` once the
 * audio and the manifest are on disk, and by `npm run notes` with `noteIds` for
 * the second family. A command records only what it rendered — see `mergeLock`
 * for how the two halves end up in one file.
 */
export function buildLock(
  paths: LockPaths,
  ids: readonly string[],
  noteIds: readonly string[] = [],
): Lock {
  const entries = (list: readonly string[], fileOf: (id: string) => string): LockEntry[] =>
    sorted(
      list.map((id) => {
        const file = fileOf(id)
        return { id, sha256: sha256File(file), bytes: statSync(file).size }
      }),
    )

  const lock: Lock = {
    catalogueSha256: sha256File(paths.cataloguePath),
    manifestSha256: sha256File(paths.manifestPath),
    grooves: entries(ids, (id) => grooveFile(paths.grooveDir, id)),
  }

  // The note family is recorded only by the command that rendered it. A
  // grooves-only run leaves all three fields absent rather than empty, which is
  // how `mergeLock` tells `I did not render this` apart from `this is now
  // empty`.
  const notesDir = paths.notesDir
  if (notesDir !== undefined && noteIds.length > 0) {
    lock.notes = entries(noteIds, (id) => noteFile(notesDir, id))
  }
  if (paths.notesManifestPath !== undefined && noteIds.length > 0) {
    lock.notesManifestSha256 = sha256File(paths.notesManifestPath)
  }
  if (paths.packDeclarationPath !== undefined && noteIds.length > 0) {
    lock.packSha256 = sha256File(paths.packDeclarationPath)
  }
  return lock
}

/** One generated artifact whose hash must still match what was recorded. */
function checkArtifact(
  path: string,
  expected: string,
  staleCheck: string,
  what: string,
  remedy: string = REGENERATE,
): GateFailure | null {
  if (sizeOrNull(path) === null) {
    return { check: 'missing', detail: `${what} is missing: ${path}` }
  }
  if (sha256File(path) !== expected) {
    return {
      check: staleCheck,
      detail: `${what} does not match the checksum recorded when it was rendered: ${path} — ${remedy}`,
    }
  }
  return null
}

/**
 * The four checks every audio family gets — present, non-empty, the recorded
 * size, the recorded hash — over whatever path function names its files.
 */
function checkEntries(
  entries: readonly LockEntry[],
  fileOf: (id: string) => string,
  what: string,
): GateFailure[] {
  const failures: GateFailure[] = []
  for (const entry of entries) {
    const file = fileOf(entry.id)
    const bytes = sizeOrNull(file)

    if (bytes === null) {
      failures.push({ check: 'missing', detail: `${entry.id}: ${what} is missing: ${file}` })
      continue
    }
    if (bytes === 0) {
      failures.push({ check: 'empty', detail: `${entry.id}: ${what} is zero bytes: ${file}` })
      continue
    }
    if (bytes !== entry.bytes) {
      failures.push({
        check: 'checksum',
        detail: `${entry.id}: ${what} is ${bytes} bytes, the lock records ${entry.bytes}: ${file}`,
      })
      continue
    }
    const sha256 = sha256File(file)
    if (sha256 !== entry.sha256) {
      failures.push({
        check: 'checksum',
        detail: `${entry.id}: ${what} checksum ${sha256.slice(0, 12)} does not match the recorded ${entry.sha256.slice(0, 12)}: ${file}`,
      })
    }
  }
  return failures
}

/**
 * Compare the committed artifacts against the lock. Returns one failure per
 * problem, each naming the file — an empty array means the tree is intact.
 */
export function verifyLock(lock: Lock, paths: LockPaths): GateFailure[] {
  const failures: GateFailure[] = [
    ...checkEntries(lock.grooves, (id) => grooveFile(paths.grooveDir, id), 'audio file'),
  ]

  // Every note check is doubly guarded: the caller must have said where the
  // family lives, and the lock must have recorded something about it. A lock
  // written before `npm run notes` existed therefore reports nothing new, which
  // is what keeps this from being a breaking change to the guard.
  const notesDir = paths.notesDir
  if (notesDir !== undefined && lock.notes !== undefined) {
    failures.push(...checkEntries(lock.notes, (id) => noteFile(notesDir, id), 'note audio file'))
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

  if (paths.notesManifestPath !== undefined && lock.notesManifestSha256 !== undefined) {
    const notesManifest = checkArtifact(
      paths.notesManifestPath,
      lock.notesManifestSha256,
      'notes-manifest-stale',
      'the generated notes manifest',
      RERENDER_NOTES,
    )
    if (notesManifest) failures.push(notesManifest)
  }

  // The pack is an input, not an output: it catches the case the note hashes
  // cannot see — the pack changed, the notes were never re-rendered, and every
  // committed note still agrees with the lock that describes it.
  if (paths.packDeclarationPath !== undefined && lock.packSha256 !== undefined) {
    const pack = checkArtifact(
      paths.packDeclarationPath,
      lock.packSha256,
      'pack-stale',
      'the sample pack declaration',
      RERENDER_NOTES,
    )
    if (pack) failures.push(pack)
  }

  return failures
}
