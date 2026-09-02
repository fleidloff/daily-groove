import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Lock } from './lock.ts'
import { type NotesResult, main } from './notes-cli.ts'
import { noteFileName, noteSpecs } from './notes.ts'

const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0

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
let result: NotesResult

describe.skipIf(!HAS_FFMPEG)('npm run notes', () => {
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'groove-notes-cli-'))
    outDir = join(dir, 'notes')
    manifestPath = join(dir, 'data', 'notes.generated.ts')
    lockPath = join(dir, 'grooves.lock.json')
    writeFileSync(lockPath, `${JSON.stringify(GROOVES_ONLY, null, 2)}\n`, 'utf8')

    result = await main({ outDir, manifestPath, lockPath })

    lock = JSON.parse(readFileSync(lockPath, 'utf8')) as Lock
  }, 300_000)

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('renders one non-empty mp3 per pitch, both octaves', () => {
    expect(noteSpecs()).toHaveLength(24)
    for (const spec of noteSpecs()) {
      const file = join(outDir, noteFileName(spec.root, spec.octave))
      expect(existsSync(file), `${spec.id}: ${file}`).toBe(true)
      expect(statSync(file).size, spec.id).toBeGreaterThan(1024)
    }
  })

  it('returns the pre-encode PCM for all twenty-four, keyed by pitch id', () => {
    expect(result.pcm.size).toBe(24)
    expect([...result.pcm.keys()].sort()).toEqual(noteSpecs().map((spec) => spec.id).sort())
  })

  it('writes the generated manifest with both exports', () => {
    const source = readFileSync(manifestPath, 'utf8')

    expect(source).toContain('export const NOTES: ReferenceNote[] = [')
    expect(source).toContain('export const PITCHES: PitchSample[] = [')
    expect([...source.matchAll(/^ {4}root: /gm)]).toHaveLength(36)
  })

  it('records all twenty-four notes under their pitch ids, plus manifest and pack', () => {
    expect(lock.notes).toHaveLength(24)
    expect(lock.notes?.map((entry) => entry.id).sort()).toEqual(
      noteSpecs().map((spec) => spec.id).sort(),
    )
    expect(new Set(lock.notes?.map((entry) => entry.sha256)).size).toBe(24)
    for (const entry of lock.notes ?? []) {
      expect(entry.sha256, entry.id).toMatch(/^[0-9a-f]{64}$/)
      expect(entry.bytes, entry.id).toBeGreaterThan(1024)
    }
    expect(lock.notesManifestSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(lock.packSha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('leaves the groove side of the lock exactly as it found it', () => {
    expect(lock.catalogueSha256).toBe(GROOVES_ONLY.catalogueSha256)
    expect(lock.manifestSha256).toBe(GROOVES_ONLY.manifestSha256)
    expect(lock.grooves).toEqual(GROOVES_ONLY.grooves)
  })
})

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

  it('encodes twenty-four byte-identical files (AC15, AC18)', () => {
    for (const spec of noteSpecs()) {
      const name = noteFileName(spec.root, spec.octave)
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
