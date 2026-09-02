import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type { GateFailure } from './types.ts'
import type { GateFailure, GrooveSpec } from './types.ts'
import { readCatalogue } from './catalogue.ts'
import { uuidFailures } from './uuid.ts'

export type LockEntry = { id: string; sha256: string; bytes: number }

export type Lock = {
  catalogueSha256: string
  manifestSha256: string
  grooves: LockEntry[]
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

export function grooveFile(grooveDir: string, id: string): string {
  return join(grooveDir, `${id}.mp3`)
}

const BASE_OCTAVE = 4

export function noteFile(notesDir: string, id: string): string {
  const digits = /(\d+)$/.exec(id)
  const octave = digits === null ? BASE_OCTAVE : Number(digits[1])
  const slug = (digits === null ? id : id.slice(0, -digits[1].length))
    .toLowerCase()
    .replaceAll('\u266f', '-sharp')
    .replaceAll('\u266d', '-flat')
  const suffix = octave === BASE_OCTAVE ? '' : `-${octave}`
  return join(notesDir, `note-${slug}${suffix}.mp3`)
}

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

function sorted(grooves: readonly LockEntry[]): LockEntry[] {
  return [...grooves].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

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

function withNotes(base: Lock, source: Lock): Lock {
  const out: Lock = base
  if (source.notes !== undefined) out.notes = sorted(source.notes)
  if (source.notesManifestSha256 !== undefined) {
    out.notesManifestSha256 = source.notesManifestSha256
  }
  if (source.packSha256 !== undefined) out.packSha256 = source.packSha256
  return out
}

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

function checkEntries(
  entries: readonly LockEntry[],
  fileOf: (id: string) => string,
  what: string,
): GateFailure[] {
  const failures: GateFailure[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const file = fileOf(entry.id)

    if (seen.has(entry.id)) {
      failures.push({
        check: 'duplicate-id',
        detail: `${entry.id}: two ${what} entries share this id, so one file was hashed twice and another was never recorded: ${file}`,
      })
      continue
    }
    seen.add(entry.id)

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

function catalogueOrNull(path: string): GrooveSpec[] | null {
  try {
    const specs = readCatalogue(path)
    return Array.isArray(specs) ? specs : null
  } catch {
    return null
  }
}

export function verifyLock(lock: Lock, paths: LockPaths): GateFailure[] {
  const failures: GateFailure[] = [
    ...checkEntries(lock.grooves, (id) => grooveFile(paths.grooveDir, id), 'audio file'),
  ]

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

  const specs = catalogueOrNull(paths.cataloguePath)
  if (specs !== null) failures.push(...uuidFailures(specs))

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
