import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Lock } from './lock.ts'
import { main } from './notes-cli.ts'
import { noteFileName, noteSpecs } from './notes.ts'

/**
 * Encoding needs ffmpeg, exactly as `npm run notes` does. Where it is absent
 * the render cannot be exercised at all, so the suite reports itself skipped
 * rather than failing on a missing binary — the guard the notes ship behind
 * (`npm run grooves:verify`) is the part that must run everywhere.
 */
const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0

/** A lock as `npm run grooves` leaves it: grooves recorded, no notes. */
const GROOVES_ONLY: Lock = {
  catalogueSha256: 'a'.repeat(64),
  manifestSha256: 'b'.repeat(64),
  grooves: [{ id: 'groove-01', sha256: 'c'.repeat(64), bytes: 123 }],
}

let dir: string
let outDir: string
let manifestPath: string
let lockPath: string
let lock: Lock

describe.skipIf(!HAS_FFMPEG)('npm run notes', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'groove-notes-cli-'))
    outDir = join(dir, 'notes')
    manifestPath = join(dir, 'data', 'notes.generated.ts')
    lockPath = join(dir, 'grooves.lock.json')
    writeFileSync(lockPath, `${JSON.stringify(GROOVES_ONLY, null, 2)}\n`, 'utf8')

    await main({ outDir, manifestPath, lockPath })

    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as Lock
  }, 300_000)

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('renders one non-empty mp3 per root', () => {
    for (const spec of noteSpecs()) {
      const file = join(outDir, noteFileName(spec.root))
      expect(existsSync(file), `${spec.root}: ${file}`).toBe(true)
      expect(statSync(file).size).toBeGreaterThan(1024)
    }
  })

  it('writes the generated manifest', () => {
    const source = readFileSync(manifestPath, 'utf8')

    expect(source).toContain('export const NOTES: ReferenceNote[] = [')
    expect([...source.matchAll(/^ {4}root: /gm)]).toHaveLength(12)
  })

  it('records the twelve notes, their manifest and the pack in the lock', () => {
    expect(lock.notes).toHaveLength(12)
    expect(lock.notes?.map((entry) => entry.id).sort()).toEqual(
      noteSpecs().map((spec) => spec.root).sort(),
    )
    for (const entry of lock.notes ?? []) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(entry.bytes).toBeGreaterThan(1024)
    }
    expect(lock.notesManifestSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(lock.packSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  // The notes and the grooves are rendered by two commands into one lock, so
  // the one that renders no groove must not speak for the grooves.
  it('leaves the groove side of the lock exactly as it found it', () => {
    expect(lock.catalogueSha256).toBe(GROOVES_ONLY.catalogueSha256)
    expect(lock.manifestSha256).toBe(GROOVES_ONLY.manifestSha256)
    expect(lock.grooves).toEqual(GROOVES_ONLY.grooves)
  })
})

/**
 * AC15, end to end. The suite above proves `renderNote` is a pure function of
 * the pack — two calls agree sample for sample — but the artifact the lock
 * hashes is the *encoded* file, and nothing above ever encodes twice. A drift
 * between PCM and mp3 (a nondeterministic step between render and encode, or an
 * ffmpeg that stopped being reproducible for fixed input) would leave every
 * other test green while the determinism the lock rests on was gone.
 *
 * It renders both runs itself rather than reusing the suite above: that one
 * removes its directory in `afterAll`, so its files are gone by the time this
 * block executes.
 */
describe.skipIf(!HAS_FFMPEG)('npm run notes, run twice', () => {
  const runs: string[] = []
  const locks: Lock[] = []

  beforeAll(async () => {
    for (const tag of ['a', 'b']) {
      const root = mkdtempSync(join(tmpdir(), `groove-notes-twice-${tag}-`))
      const lockPath = join(root, 'grooves.lock.json')
      writeFileSync(lockPath, `${JSON.stringify(GROOVES_ONLY, null, 2)}\n`, 'utf8')
      await main({
        outDir: join(root, 'notes'),
        manifestPath: join(root, 'data', 'notes.generated.ts'),
        lockPath,
      })
      runs.push(root)
      locks.push(JSON.parse(readFileSync(lockPath, 'utf8')) as Lock)
    }
  }, 600_000)

  afterAll(() => {
    for (const root of runs) rmSync(root, { recursive: true, force: true })
  })

  const sha256 = (path: string) =>
    createHash('sha256').update(readFileSync(path)).digest('hex')

  it('encodes twelve byte-identical files (AC15)', () => {
    for (const spec of noteSpecs()) {
      const name = noteFileName(spec.root)
      expect(
        sha256(join(runs[1], 'notes', name)),
        `${name} differs between two renders of an unchanged pack`,
      ).toBe(sha256(join(runs[0], 'notes', name)))
    }
  })

  it('records the same hashes in the lock both times (AC15)', () => {
    expect(locks[1].notes).toEqual(locks[0].notes)
    expect(locks[1].notesManifestSha256).toBe(locks[0].notesManifestSha256)
    expect(locks[1].packSha256).toBe(locks[0].packSha256)
  })
})
