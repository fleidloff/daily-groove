import { createHash } from 'node:crypto'
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildLock,
  mergeLock,
  noteFile,
  readLock,
  sha256File,
  verifyLock,
  writeLock,
  type Lock,
  type LockPaths,
} from './lock.ts'

/**
 * One canonical v4 uuid per fixture groove, derived from its position so the
 * fixture stays deterministic. The guard reads the catalogue's uuids, so a
 * fixture catalogue without them is not a catalogue the guard would pass.
 */
function fixtureUuid(i: number): string {
  return `a0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
}

/** Bytes that stand in for an mp3 — the lock never looks inside one. */
function audioBytes(id: string, n = 2048): Buffer {
  const buf = Buffer.alloc(n)
  for (let i = 0; i < n; i += 1) buf[i] = (i * 31 + id.charCodeAt(id.length - 1)) % 251
  return buf
}

type Fixture = {
  dir: string
  grooveDir: string
  cataloguePath: string
  manifestPath: string
  lockPath: string
  lock: Lock
  paths: { grooveDir: string; cataloguePath: string; manifestPath: string }
}

/** A temp tree where audio, manifest and catalogue all match the lock. */
function fixture(ids: string[] = ['groove-01', 'groove-02']): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-lock-'))
  const grooveDir = join(dir, 'public', 'grooves')
  mkdirSync(grooveDir, { recursive: true })
  for (const id of ids) writeFileSync(join(grooveDir, `${id}.mp3`), audioBytes(id))

  const cataloguePath = join(dir, 'catalogue.json')
  writeFileSync(
    cataloguePath,
    `${JSON.stringify(
      ids.map((id, i) => ({ id, uuid: fixtureUuid(i), template: 'straight-funk', seed: i + 1 })),
      null,
      2,
    )}\n`,
  )

  const manifestPath = join(dir, 'grooves.generated.ts')
  writeFileSync(
    manifestPath,
    `export const GROOVES = [\n${ids.map((id) => `  { id: '${id}', bpm: 96 },`).join('\n')}\n]\n`,
  )

  const paths = { grooveDir, cataloguePath, manifestPath }
  return { dir, grooveDir, cataloguePath, manifestPath, lockPath: join(dir, 'grooves.lock.json'), lock: buildLock(paths, ids), paths }
}

describe('readLock / writeLock — Step B1', () => {
  it('round-trips a lock, including both top-level hashes', () => {
    const { lockPath } = fixture()
    const lock: Lock = {
      catalogueSha256: 'a'.repeat(64),
      manifestSha256: 'b'.repeat(64),
      grooves: [
        { id: 'groove-01', sha256: 'c'.repeat(64), bytes: 10 },
        { id: 'groove-02', sha256: 'd'.repeat(64), bytes: 20 },
      ],
    }

    writeLock(lock, lockPath)

    expect(readLock(lockPath)).toEqual(lock)
  })

  it('returns null for a missing file', () => {
    const { dir } = fixture()
    expect(readLock(join(dir, 'nope.lock.json'))).toBe(null)
  })

  it('sorts grooves by id so diffs stay stable', () => {
    const { lockPath } = fixture()
    writeLock(
      {
        catalogueSha256: 'a'.repeat(64),
        manifestSha256: 'b'.repeat(64),
        grooves: [
          { id: 'groove-09', sha256: 'c'.repeat(64), bytes: 1 },
          { id: 'groove-02', sha256: 'd'.repeat(64), bytes: 2 },
          { id: 'groove-05', sha256: 'e'.repeat(64), bytes: 3 },
        ],
      },
      lockPath,
    )

    expect(readLock(lockPath)!.grooves.map((g) => g.id)).toEqual([
      'groove-02',
      'groove-05',
      'groove-09',
    ])
    // ...and on disk, not merely in memory.
    expect(readFileSync(lockPath, 'utf8').indexOf('groove-02')).toBeLessThan(
      readFileSync(lockPath, 'utf8').indexOf('groove-09'),
    )
  })

  it('records the real sha256 and byte count of each artifact', () => {
    const f = fixture(['groove-01'])
    const file = join(f.grooveDir, 'groove-01.mp3')
    const expected = createHash('sha256').update(readFileSync(file)).digest('hex')

    expect(f.lock.grooves[0]).toEqual({ id: 'groove-01', sha256: expected, bytes: 2048 })
    expect(f.lock.catalogueSha256).toBe(sha256File(f.cataloguePath))
    expect(f.lock.manifestSha256).toBe(sha256File(f.manifestPath))
  })
})

describe('verifyLock — Step B2', () => {
  it('returns no failures when everything matches', () => {
    const f = fixture()
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })

  it('fails, naming the groove, when its file is missing (AC8)', () => {
    const f = fixture()
    rmSync(join(f.grooveDir, 'groove-02.mp3'))

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('missing')
    expect(failures[0].detail).toContain('groove-02')
  })

  it('fails, naming the groove, when its file is zero bytes (AC9)', () => {
    const f = fixture()
    writeFileSync(join(f.grooveDir, 'groove-01.mp3'), Buffer.alloc(0))

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('empty')
    expect(failures[0].detail).toContain('groove-01')
  })

  it('fails, naming the groove, when a single byte is altered (AC10)', () => {
    const f = fixture()
    const file = join(f.grooveDir, 'groove-02.mp3')
    const bytes = readFileSync(file)
    bytes[100] = bytes[100] ^ 0xff
    writeFileSync(file, bytes)

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('checksum')
    expect(failures[0].detail).toContain('groove-02')
    // The size is unchanged, so only the hash can have caught this.
    expect(readFileSync(file).length).toBe(f.lock.grooves[1].bytes)
  })

  it('reports every broken groove, not just the first', () => {
    const f = fixture(['groove-01', 'groove-02', 'groove-03'])
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    writeFileSync(join(f.grooveDir, 'groove-03.mp3'), Buffer.alloc(0))

    const failures = verifyLock(f.lock, f.paths)
    expect(failures.map((x) => x.check).sort()).toEqual(['empty', 'missing'])
    expect(failures.map((x) => x.detail).join(' ')).toContain('groove-01')
    expect(failures.map((x) => x.detail).join(' ')).toContain('groove-03')
  })

  it('names the file in every detail', () => {
    const f = fixture()
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    for (const failure of verifyLock(f.lock, f.paths)) {
      expect(failure.check.length).toBeGreaterThan(0)
      expect(failure.detail).toContain('.mp3')
    }
  })
})

describe('verifyLock — Step B2b, stale inputs and outputs', () => {
  it('passes when audio, manifest and catalogue all match their hashes', () => {
    const f = fixture()
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })

  it('fails when the catalogue was appended to without regenerating', () => {
    const f = fixture()
    appendFileSync(f.cataloguePath, '\n// hand-added entry\n')

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('catalogue-stale')
    expect(failures[0].detail).toContain('catalogue.json')
    expect(failures[0].detail).toContain('npm run grooves')
  })

  it('fails when the generated manifest was edited by hand', () => {
    const f = fixture()
    writeFileSync(
      f.manifestPath,
      readFileSync(f.manifestPath, 'utf8').replace('bpm: 96', 'bpm: 120'),
    )

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('manifest-stale')
    expect(failures[0].detail).toContain('grooves.generated.ts')
    expect(failures[0].detail).toContain('npm run grooves')
  })

  it('reports a missing catalogue or manifest rather than throwing', () => {
    const f = fixture()
    rmSync(f.cataloguePath)
    rmSync(f.manifestPath)

    const failures = verifyLock(f.lock, f.paths)
    expect(failures).toHaveLength(2)
    expect(failures.every((x) => x.check === 'missing')).toBe(true)
    expect(failures.map((x) => x.detail).join(' ')).toContain('catalogue.json')
    expect(failures.map((x) => x.detail).join(' ')).toContain('grooves.generated.ts')
  })

  it('uses a distinct check name for each way of being broken', () => {
    const f = fixture(['groove-01', 'groove-02', 'groove-03'])
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    writeFileSync(join(f.grooveDir, 'groove-02.mp3'), Buffer.alloc(0))
    const file = join(f.grooveDir, 'groove-03.mp3')
    const bytes = readFileSync(file)
    bytes[7] = bytes[7] ^ 0xff
    writeFileSync(file, bytes)
    appendFileSync(f.cataloguePath, '\n\n')
    writeFileSync(f.manifestPath, `${readFileSync(f.manifestPath, 'utf8')}\n`)

    const checks = verifyLock(f.lock, f.paths).map((x) => x.check)
    expect(new Set(checks)).toEqual(
      new Set(['missing', 'empty', 'checksum', 'catalogue-stale', 'manifest-stale']),
    )
  })
})

/**
 * Feature-10, Track B, widened by feature-16 Epic 1 Track B. The reference
 * notes are a second artifact family in the same lock: mp3s named by pitch,
 * their own generated manifest, and the pack declaration they were rendered
 * from. Two octaves now, so a note is keyed by its scientific pitch rather
 * than by its root alone.
 *
 * Every expectation here is a literal file name. `notes.ts`'s `noteFileName`
 * asserts the same literals on its own side and the two are never asserted
 * against each other, because this module may not import that one — see
 * `noteFile`'s comment for the four things that have to stay true across both
 * copies of the rule.
 */
const NOTE_FILES: Record<string, string> = {
  C4: 'note-c.mp3',
  'C\u266f4': 'note-c-sharp.mp3',
  'E\u266d4': 'note-e-flat.mp3',
  C5: 'note-c-5.mp3',
  'C\u266f5': 'note-c-sharp-5.mp3',
  'E\u266d5': 'note-e-flat-5.mp3',
  // The ids a lock written before the widening carries: no octave digit at all.
  // They name the same three base-octave files (R27).
  C: 'note-c.mp3',
  'C\u266f': 'note-c-sharp.mp3',
  'E\u266d': 'note-e-flat.mp3',
}

/** The fixture's notes: both octaves, so every path in the guard is walked. */
const NOTE_IDS = ['C4', 'C\u266f4', 'E\u266d4', 'C5', 'C\u266f5', 'E\u266d5']

/** What today's committed lock records, until the artifacts are re-rendered. */
const HISTORICAL_IDS = ['C', 'C\u266f', 'E\u266d']

type NotesFixture = Fixture & {
  notesDir: string
  notesManifestPath: string
  packDeclarationPath: string
  notePaths: Required<LockPaths>
  notesLock: Lock
}

/** The groove fixture, plus an intact notes family beside it. */
function notesFixture(ids: string[] = NOTE_IDS): NotesFixture {
  const f = fixture()
  const notesDir = join(f.dir, 'public', 'notes')
  mkdirSync(notesDir, { recursive: true })
  for (const id of ids) writeFileSync(join(notesDir, NOTE_FILES[id]), audioBytes(id, 1024))

  const notesManifestPath = join(f.dir, 'notes.generated.ts')
  writeFileSync(
    notesManifestPath,
    `export const NOTES = [\n${ids.map((r) => `  { id: '${r}', midi: 60 },`).join('\n')}\n]\n`,
  )

  const packDeclarationPath = join(f.dir, 'pack.json')
  writeFileSync(packDeclarationPath, `${JSON.stringify({ comp: ['c4.wav'] }, null, 2)}\n`)

  const notePaths: Required<LockPaths> = {
    ...f.paths,
    notesDir,
    notesManifestPath,
    packDeclarationPath,
  }
  return {
    ...f,
    notesDir,
    notesManifestPath,
    packDeclarationPath,
    notePaths,
    notesLock: buildLock(notePaths, ['groove-01', 'groove-02'], ids),
  }
}

const ROOT_SLUGS = ['C', 'C\u266f', 'D', 'E\u266d', 'E', 'F', 'F\u266f', 'G', 'A\u266d', 'A', 'B\u266d', 'B']

describe('noteFile — a scientific-pitch id names the file (Step B1, R30)', () => {
  it('derives the ASCII slug the render writes, in both octaves', () => {
    expect(noteFile('/notes', 'C4')).toBe('/notes/note-c.mp3')
    expect(noteFile('/notes', 'C\u266f4')).toBe('/notes/note-c-sharp.mp3')
    expect(noteFile('/notes', 'E\u266d4')).toBe('/notes/note-e-flat.mp3')
    expect(noteFile('/notes', 'C5')).toBe('/notes/note-c-5.mp3')
    expect(noteFile('/notes', 'C\u266f5')).toBe('/notes/note-c-sharp-5.mp3')
    expect(noteFile('/notes', 'E\u266d5')).toBe('/notes/note-e-flat-5.mp3')
    expect(noteFile('/notes', 'B5')).toBe('/notes/note-b-5.mp3')
  })

  it('reads an id with no octave digit as the base octave', () => {
    // Today's committed lock records `A`, `E\u266d`, `B` — no digits at all. Between
    // this change landing and the artifacts being re-rendered, those are the ids
    // `noteFile` is handed, and they have to keep naming the twelve committed
    // files or `prebuild` goes red for a render nobody has run yet. Leniency
    // hides nothing: the file must still exist and still hash-match.
    expect(noteFile('/notes', 'C')).toBe('/notes/note-c.mp3')
    expect(noteFile('/notes', 'C\u266f')).toBe('/notes/note-c-sharp.mp3')
    expect(noteFile('/notes', 'E\u266d')).toBe('/notes/note-e-flat.mp3')
    expect(noteFile('/notes', 'B')).toBe('/notes/note-b.mp3')
    // ...and the bare id and the base-octave id name one file, never two.
    for (const root of ROOT_SLUGS) {
      expect(noteFile('/notes', root)).toBe(noteFile('/notes', `${root}4`))
    }
  })

  it('names the base octave bare and the octave above with a plain decimal suffix', () => {
    // Stronger than one regex over both octaves: a single `[a-z0-9-]+` pattern
    // also matches `note-c4.mp3`, so it would pass the naming scheme R27
    // forbids. Each octave is asserted against its own shape instead.
    const names: string[] = []
    for (const root of ROOT_SLUGS) {
      const base = noteFile('/notes', `${root}4`)
      const upper = noteFile('/notes', `${root}5`)
      expect(base, root).toMatch(/^\/notes\/note-[a-z-]+\.mp3$/)
      expect(upper, root).toMatch(/^\/notes\/note-[a-z-]+-5\.mp3$/)
      names.push(base, upper)
    }
    // Twenty-four pitches, twenty-four distinct files.
    expect(names).toHaveLength(24)
    expect(new Set(names).size).toBe(24)
  })
})

describe('verifyLock — two note entries may not share one id (Step B1)', () => {
  // The trap this closes: a render that keys its lock entries by root rather
  // than by pitch produces twenty-four entries with twelve duplicate ids, each
  // duplicate hashing the same file. Every hash matches, nothing is missing,
  // the guard passes and reports "24 notes" — a fully green, completely wrong
  // lock. A duplicate id is never legitimate: `sorted()` already treats the id
  // as the key that identifies an entry.
  it('fails, naming the id, when the notes family repeats one', () => {
    const f = notesFixture()
    const doubled: Lock = {
      ...f.notesLock,
      notes: [...f.notesLock.notes!, { ...f.notesLock.notes![0] }],
    }

    const failures = verifyLock(doubled, f.notePaths)

    expect(failures.map((x) => x.check)).toEqual(['duplicate-id'])
    expect(failures[0].detail).toContain(f.notesLock.notes![0].id)
    expect(failures[0].detail).toContain('.mp3')
  })

  it('catches the same fault in the groove family', () => {
    const f = fixture()
    const doubled: Lock = { ...f.lock, grooves: [...f.lock.grooves, { ...f.lock.grooves[0] }] }

    expect(verifyLock(doubled, f.paths).map((x) => x.check)).toEqual(['duplicate-id'])
  })

  it('says nothing when every id is distinct, in either octave', () => {
    const f = notesFixture()
    expect(verifyLock(f.notesLock, f.notePaths)).toEqual([])
  })
})

describe('verifyLock — the historical ids still resolve', () => {
  it('verifies a lock whose note ids carry no octave (R27)', () => {
    const f = notesFixture(HISTORICAL_IDS)
    expect(verifyLock(f.notesLock, f.notePaths)).toEqual([])
  })

  it('still fails on a missing file when the id is a bare root', () => {
    const f = notesFixture(HISTORICAL_IDS)
    rmSync(join(f.notesDir, 'note-c.mp3'))

    const failures = verifyLock(f.notesLock, f.notePaths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('missing')
    expect(failures[0].detail).toContain('note-c.mp3')
  })
})

describe('verifyLock — Step B1, a lock written before the notes existed', () => {
  it('returns no failures when the lock carries no note fields at all', () => {
    const f = fixture()
    expect(f.lock.notes).toBeUndefined()
    expect(f.lock.notesManifestSha256).toBeUndefined()
    expect(f.lock.packSha256).toBeUndefined()
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })

  it('still returns none when the note paths are supplied but the lock has nothing to check', () => {
    // `grooves:verify` always passes the note paths. A pre-epic lock must not
    // start failing because a path it never recorded a hash for now exists.
    const f = notesFixture()
    const preEpic: Lock = {
      catalogueSha256: f.lock.catalogueSha256,
      manifestSha256: f.lock.manifestSha256,
      grooves: f.lock.grooves,
    }
    expect(verifyLock(preEpic, f.notePaths)).toEqual([])
  })
})

describe('verifyLock — Step B2, the note audio', () => {
  it('returns no failures when every note matches', () => {
    const f = notesFixture()
    expect(verifyLock(f.notesLock, f.notePaths)).toEqual([])
  })

  it('fails, naming the file, when a note is missing (AC16)', () => {
    const f = notesFixture()
    rmSync(join(f.notesDir, 'note-c-sharp.mp3'))

    const failures = verifyLock(f.notesLock, f.notePaths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('missing')
    expect(failures[0].detail).toContain('note-c-sharp.mp3')
  })

  it('fails when a note is zero bytes', () => {
    const f = notesFixture()
    writeFileSync(join(f.notesDir, 'note-c.mp3'), Buffer.alloc(0))

    const failures = verifyLock(f.notesLock, f.notePaths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('empty')
    expect(failures[0].detail).toContain('note-c.mp3')
  })

  it('fails when a single byte of a note is altered', () => {
    const f = notesFixture()
    const file = join(f.notesDir, 'note-e-flat.mp3')
    const bytes = readFileSync(file)
    bytes[64] = bytes[64] ^ 0xff
    writeFileSync(file, bytes)

    const failures = verifyLock(f.notesLock, f.notePaths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('checksum')
    expect(failures[0].detail).toContain('note-e-flat.mp3')
    expect(readFileSync(file).length).toBe(1024)
  })

  it('reports a broken groove and a broken note in the same run', () => {
    const f = notesFixture()
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    rmSync(join(f.notesDir, 'note-c.mp3'))

    const details = verifyLock(f.notesLock, f.notePaths).map((x) => x.detail).join(' ')
    expect(details).toContain('groove-01.mp3')
    expect(details).toContain('note-c.mp3')
  })
})

describe('verifyLock — Step B3, the notes manifest (AC17)', () => {
  it('fails when the notes manifest was edited by hand', () => {
    const f = notesFixture()
    writeFileSync(
      f.notesManifestPath,
      readFileSync(f.notesManifestPath, 'utf8').replace('midi: 60', 'midi: 72'),
    )

    const failures = verifyLock(f.notesLock, f.notePaths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('notes-manifest-stale')
    expect(failures[0].detail).toContain('notes.generated.ts')
    expect(failures[0].detail).toContain('npm run notes')
  })

  it('reports a missing notes manifest rather than throwing', () => {
    const f = notesFixture()
    rmSync(f.notesManifestPath)

    const failures = verifyLock(f.notesLock, f.notePaths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('missing')
    expect(failures[0].detail).toContain('notes.generated.ts')
  })

  it('skips the check when the lock recorded no notes manifest hash', () => {
    const f = notesFixture()
    const lock: Lock = { ...f.notesLock, notesManifestSha256: undefined }
    rmSync(f.notesManifestPath)
    expect(verifyLock(lock, f.notePaths)).toEqual([])
  })
})

describe('verifyLock — Step B4, the pack declaration (AC18)', () => {
  it('fails when the pack declaration changed without a re-render', () => {
    const f = notesFixture()
    writeFileSync(
      f.packDeclarationPath,
      `${JSON.stringify({ comp: ['c4.wav', 'e4.wav'] }, null, 2)}\n`,
    )

    const failures = verifyLock(f.notesLock, f.notePaths)
    expect(failures).toHaveLength(1)
    expect(failures[0].check).toBe('pack-stale')
    expect(failures[0].detail).toContain('pack.json')
    expect(failures[0].detail).toContain('npm run notes')
  })

  it('skips the check when the lock recorded no pack hash', () => {
    const f = notesFixture()
    const lock: Lock = { ...f.notesLock, packSha256: undefined }
    writeFileSync(f.packDeclarationPath, '{}\n')
    expect(verifyLock(lock, f.notePaths)).toEqual([])
  })
})

describe('buildLock — Step B5, it records the notes', () => {
  it('hashes each note, the notes manifest and the pack declaration', () => {
    const f = notesFixture()

    expect(f.notesLock.notes).toHaveLength(NOTE_IDS.length)
    for (const entry of f.notesLock.notes!) {
      const file = join(f.notesDir, NOTE_FILES[entry.id])
      expect(entry.sha256).toBe(sha256File(file))
      expect(entry.bytes).toBe(1024)
    }
    expect(f.notesLock.notesManifestSha256).toBe(sha256File(f.notesManifestPath))
    expect(f.notesLock.packSha256).toBe(sha256File(f.packDeclarationPath))
  })

  it('sorts the note entries so diffs stay stable', () => {
    const f = notesFixture()
    const ids = f.notesLock.notes!.map((n) => n.id)
    expect(ids).toEqual([...ids].sort())
  })

  it('records nothing about the notes when it is not given any', () => {
    const f = notesFixture()
    const lock = buildLock(f.paths, ['groove-01', 'groove-02'])
    expect(lock.notes).toBeUndefined()
    expect(lock.notesManifestSha256).toBeUndefined()
    expect(lock.packSha256).toBeUndefined()
  })
})

describe('Step B5a — `npm run grooves` does not drop the notes', () => {
  it('round-trips the three note fields through writeLock and readLock', () => {
    const f = notesFixture()
    writeLock(f.notesLock, f.lockPath)

    const read = readLock(f.lockPath)!
    expect(read.notes).toEqual(f.notesLock.notes)
    expect(read.notesManifestSha256).toBe(f.notesLock.notesManifestSha256)
    expect(read.packSha256).toBe(f.notesLock.packSha256)
    // ...and on disk, in a stable order after the grooves.
    const json = readFileSync(f.lockPath, 'utf8')
    expect(json.indexOf('"grooves"')).toBeLessThan(json.indexOf('"notes"'))
    expect(json.indexOf('"notes"')).toBeLessThan(json.indexOf('"notesManifestSha256"'))
    expect(json.indexOf('"notesManifestSha256"')).toBeLessThan(json.indexOf('"packSha256"'))
  })

  it('keeps the note fields when a grooves-only lock is written over the same path', () => {
    const f = notesFixture()
    writeLock(f.notesLock, f.lockPath)

    // Exactly what `npm run grooves` produces: it has rendered no note and
    // cannot vouch for one, so what it builds carries none.
    const groovesOnly = buildLock(f.paths, ['groove-01', 'groove-02'])
    expect(groovesOnly.notes).toBeUndefined()
    writeLock(mergeLock(readLock(f.lockPath), groovesOnly), f.lockPath)

    const after = readLock(f.lockPath)!
    expect(after.notes).toEqual(f.notesLock.notes)
    expect(after.notesManifestSha256).toBe(f.notesLock.notesManifestSha256)
    expect(after.packSha256).toBe(f.notesLock.packSha256)
    // The groove family is still the one that was just rendered.
    expect(after.grooves).toEqual(groovesOnly.grooves)
  })

  it('keeps the groove fields when a notes-only render writes over them', () => {
    const f = notesFixture()
    writeLock(buildLock(f.paths, ['groove-01', 'groove-02']), f.lockPath)

    const existing = readLock(f.lockPath)!
    writeLock(mergeLock(existing, { ...existing, ...f.notesLock }), f.lockPath)

    const after = readLock(f.lockPath)!
    expect(after.grooves).toEqual(existing.grooves)
    expect(after.notes).toEqual(f.notesLock.notes)
  })

  it('merges onto nothing when there is no existing lock', () => {
    const f = notesFixture()
    expect(mergeLock(null, f.notesLock)).toEqual(f.notesLock)
  })

  it('takes the newer note fields when both locks carry them', () => {
    const f = notesFixture()
    const stale: Lock = {
      ...f.notesLock,
      notes: [{ id: 'C', sha256: 'f'.repeat(64), bytes: 1 }],
      packSha256: 'e'.repeat(64),
    }
    expect(mergeLock(stale, f.notesLock).notes).toEqual(f.notesLock.notes)
    expect(mergeLock(stale, f.notesLock).packSha256).toBe(f.notesLock.packSha256)
  })
})

describe('Step B3 — the guard needs no audio toolchain (R13, AC11)', () => {
  const AUDIO_MODULES = [
    'voices',
    'mix',
    'encode',
    'pack',
    'decode',
    'pcmio',
    'events',
    'cli',
    'wav',
    'templates',
    'theory',
  ]
  // `uuid.ts` and `catalogue.ts` are on this list deliberately, not by
  // oversight: the guard now checks the catalogue's uuids, so it has to read the
  // catalogue and recognise a uuid. Neither module renders anything — `uuid.ts`
  // imports only `node:crypto`, `catalogue.ts` only `node:fs` and `node:url` —
  // so the no-audio-toolchain guarantee below is untouched (F12 E1 Step A7).
  const ALLOWED = new Set([
    'node:fs',
    'node:crypto',
    'node:path',
    './types.ts',
    './lock.ts',
    './uuid.ts',
    './catalogue.ts',
  ])

  function importsOf(file: string): string[] {
    const source = readFileSync(join(import.meta.dirname, file), 'utf8')
    const found: string[] = []
    for (const m of source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) found.push(m[1])
    for (const m of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1])
    for (const m of source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) found.push(m[1])
    return found
  }

  for (const file of ['lock.ts', 'verify-cli.ts']) {
    it(`${file} imports only fs, crypto, path and the lock itself`, () => {
      const specifiers = importsOf(file)
      expect(specifiers.length).toBeGreaterThan(0)
      for (const specifier of specifiers) {
        expect(ALLOWED.has(specifier), `${file} imports ${specifier}`).toBe(true)
      }
    })

    it(`${file} reaches for no audio module`, () => {
      for (const specifier of importsOf(file)) {
        const base = specifier.replace(/^.*\//, '').replace(/\.ts$/, '')
        expect(AUDIO_MODULES.includes(base), `${file} imports ${specifier}`).toBe(false)
      }
    })
  }

  it('verifies a whole fixture without any audio module being loadable', () => {
    // The proof that matters: nothing in the verify path decodes or renders.
    const f = fixture()
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })
})

/**
 * Feature-12, Epic 1, Step A7 — R3, R8, R9, R10, AC3, AC4.
 *
 * The uuid is what a share link carries, and it lives in the catalogue, which is
 * hand-editable. So the guard that already proves the committed artifacts match
 * their input also proves the input's uuids are usable: one per groove, well
 * formed, and held by exactly one groove. Every failure names the groove, because
 * "a uuid is wrong somewhere in thirty entries" is not a fixable report.
 */
describe("verifyLock — the catalogue's uuids", () => {
  type Spec = { id: string; uuid?: string; template: string; seed: number }

  /** The fixture with `specs` as its catalogue, and a lock that matches it. */
  function withCatalogue(specs: readonly Spec[]) {
    const f = fixture(specs.map((s) => s.id))
    writeFileSync(f.cataloguePath, `${JSON.stringify(specs, null, 2)}\n`)
    // Re-locked against the catalogue just written, so the only thing left for
    // the guard to complain about is the uuids themselves.
    return { paths: f.paths, lock: buildLock(f.paths, specs.map((s) => s.id)) }
  }

  const A = '9f1c2e40-7b3a-4c15-9d8e-2a6b41f0c7de'
  const B = 'c0105415-48cb-43cb-a54d-996fcdb40d94'

  it('passes a catalogue whose uuids are all present, well formed and unique', () => {
    const f = withCatalogue([
      { id: 'groove-01', uuid: A, template: 'straight-funk', seed: 1 },
      { id: 'groove-02', uuid: B, template: 'shuffle', seed: 2 },
    ])
    expect(verifyLock(f.lock, f.paths)).toEqual([])
  })

  it('fails and names both grooves when two share a uuid (AC3)', () => {
    const f = withCatalogue([
      { id: 'groove-01', uuid: A, template: 'straight-funk', seed: 1 },
      { id: 'groove-02', uuid: A, template: 'shuffle', seed: 2 },
    ])

    const failures = verifyLock(f.lock, f.paths)

    expect(failures.map((x) => x.check)).toEqual(['uuid-duplicate'])
    expect(failures[0].detail).toContain('groove-01')
    expect(failures[0].detail).toContain('groove-02')
  })

  it('fails and names the groove whose uuid is missing (AC4)', () => {
    const f = withCatalogue([
      { id: 'groove-01', uuid: A, template: 'straight-funk', seed: 1 },
      { id: 'groove-02', template: 'shuffle', seed: 2 },
    ])

    const failures = verifyLock(f.lock, f.paths)

    expect(failures.map((x) => x.check)).toEqual(['uuid-missing'])
    expect(failures[0].detail).toContain('groove-02')
    expect(failures[0].detail).not.toContain('groove-01')
  })

  it('fails and names the groove whose uuid is malformed (AC4)', () => {
    const f = withCatalogue([
      { id: 'groove-01', uuid: A, template: 'straight-funk', seed: 1 },
      { id: 'groove-02', uuid: A.toUpperCase(), template: 'shuffle', seed: 2 },
    ])

    const failures = verifyLock(f.lock, f.paths)

    expect(failures.map((x) => x.check)).toEqual(['uuid-malformed'])
    expect(failures[0].detail).toContain('groove-02')
  })

  it('reports a uuid fault alongside the artifact faults, not instead of them', () => {
    // The two checks are independent: a stale manifest does not excuse a broken
    // uuid, and neither hides the other.
    const f = withCatalogue([
      { id: 'groove-01', uuid: A, template: 'straight-funk', seed: 1 },
      { id: 'groove-02', uuid: A, template: 'shuffle', seed: 2 },
    ])
    appendFileSync(f.paths.manifestPath, '\n')

    const checks = verifyLock(f.lock, f.paths).map((x) => x.check)

    expect(checks).toContain('manifest-stale')
    expect(checks).toContain('uuid-duplicate')
  })

  it('returns a failure rather than throwing when the catalogue will not parse', () => {
    // The guard used to never open the catalogue, only hash it. It must not start
    // throwing where it used to report: a corrupt catalogue is caught by its
    // hash, and the uuid checks simply have nothing to say about it.
    const f = fixture()
    writeFileSync(f.cataloguePath, 'not json at all')

    const failures = verifyLock(f.lock, f.paths)

    expect(failures.map((x) => x.check)).toContain('catalogue-stale')
    expect(failures.every((x) => !x.check.startsWith('uuid-'))).toBe(true)
  })

  it('says nothing about uuids when the catalogue is missing entirely', () => {
    const f = fixture()
    rmSync(f.cataloguePath)

    const checks = verifyLock(f.lock, f.paths).map((x) => x.check)

    expect(checks).toContain('missing')
    expect(checks.filter((c) => c.startsWith('uuid-'))).toEqual([])
  })
})

// Step C2 — R5b, AC7a. `verifyLock` walks the lock's entries, so it is blind in
// one direction: an mp3 whose catalogue row has been deleted stays on disk,
// passes the build guard, and ships to every visitor. This walks the directory
// instead, so the committed audio and the committed lock have to agree both
// ways round.
describe('Step C2 — public/grooves holds one mp3 per locked groove and no others', () => {
  const GROOVE_DIR = join(import.meta.dirname, '..', '..', 'public', 'grooves')
  const LOCK_PATH = join(import.meta.dirname, 'grooves.lock.json')

  const committed = readLock(LOCK_PATH)
  if (!committed) throw new Error(`no lock at ${LOCK_PATH} — run \`npm run grooves\``)
  const lockedIds = committed.grooves.map((g) => g.id)
  const onDisk = readdirSync(GROOVE_DIR)
    .filter((name) => name.endsWith('.mp3'))
    .map((name) => name.replace(/\.mp3$/, ''))

  it('leaves no mp3 behind that the lock does not record', () => {
    const orphans = onDisk.filter((id) => !lockedIds.includes(id))
    expect(orphans, 'unreferenced audio is shipped to every visitor').toEqual([])
  })

  it('has an mp3 on disk for every groove the lock records', () => {
    const missing = lockedIds.filter((id) => !onDisk.includes(id))
    expect(missing).toEqual([])
  })

  it('matches the directory to the lock exactly', () => {
    expect([...onDisk].sort()).toEqual([...lockedIds].sort())
  })
})
