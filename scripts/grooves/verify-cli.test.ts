import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildLock, writeLock } from './lock.ts'
import {
  DEFAULT_MANIFEST_PATH,
  DEFAULT_NOTES_DIR,
  DEFAULT_NOTES_MANIFEST_PATH,
  DEFAULT_PACK_DECLARATION_PATH,
  main,
} from './verify-cli.ts'

function audioBytes(id: string, n = 2048): Buffer {
  const buf = Buffer.alloc(n)
  for (let i = 0; i < n; i += 1) buf[i] = (i * 17 + id.charCodeAt(id.length - 1)) % 253
  return buf
}

type Fixture = {
  grooveDir: string
  cataloguePath: string
  manifestPath: string
  lockPath: string
}

/**
 * One canonical v4 uuid per fixture groove, derived from its position so the
 * fixture stays deterministic. The guard checks the catalogue's uuids, so a
 * fixture catalogue without them is not one an intact tree would hold.
 */
function fixtureUuid(i: number): string {
  return `a0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`
}

/** An intact tree plus a lock that describes it. */
function fixture(ids: string[] = ['groove-01', 'groove-02']): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-verify-'))
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
  writeFileSync(manifestPath, `export const GROOVES = [\n${ids.map((id) => `  { id: '${id}' },`).join('\n')}\n]\n`)

  const lockPath = join(dir, 'grooves.lock.json')
  writeLock(buildLock({ grooveDir, cataloguePath, manifestPath }, ids), lockPath)

  return { grooveDir, cataloguePath, manifestPath, lockPath }
}

/**
 * Feature-10, Track B. The same tree with the reference notes beside it: three
 * note mp3s named by root slug, their generated manifest, and the pack
 * declaration they were rendered from.
 */
const NOTE_FILES: Record<string, string> = {
  C: 'note-c.mp3',
  'C\u266f': 'note-c-sharp.mp3',
  'E\u266d': 'note-e-flat.mp3',
}

type NotesFixture = Fixture & {
  notesDir: string
  notesManifestPath: string
  packDeclarationPath: string
}

function notesFixture(ids: string[] = ['groove-01', 'groove-02']): NotesFixture {
  const f = fixture(ids)
  const dir = join(f.lockPath, '..')

  const notesDir = join(dir, 'public', 'notes')
  mkdirSync(notesDir, { recursive: true })
  const roots = Object.keys(NOTE_FILES)
  for (const root of roots) writeFileSync(join(notesDir, NOTE_FILES[root]), audioBytes(root, 512))

  const notesManifestPath = join(dir, 'notes.generated.ts')
  writeFileSync(notesManifestPath, `export const NOTES = [${roots.map((r) => `'${r}'`).join(', ')}]\n`)

  const packDeclarationPath = join(dir, 'pack.json')
  writeFileSync(packDeclarationPath, `${JSON.stringify({ comp: ['c4.wav'] }, null, 2)}\n`)

  const paths = {
    grooveDir: f.grooveDir,
    cataloguePath: f.cataloguePath,
    manifestPath: f.manifestPath,
    notesDir,
    notesManifestPath,
    packDeclarationPath,
  }
  writeLock(buildLock(paths, ids, roots), f.lockPath)

  return { ...f, notesDir, notesManifestPath, packDeclarationPath }
}

function run(f: Fixture) {
  const lines: string[] = []
  return {
    lines,
    code: main({ ...f, log: (line: string) => lines.push(line) }),
  }
}

describe('verify-cli main — Step B4', () => {
  it('exits zero on an intact tree (AC11)', async () => {
    const r = run(fixture())
    await expect(r.code).resolves.toBe(0)
  })

  it('exits non-zero and names the groove whose file is missing (AC8)', async () => {
    const f = fixture()
    rmSync(join(f.grooveDir, 'groove-02.mp3'))

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-02')
    expect(output).toContain('missing')
  })

  it('exits non-zero and names the groove whose file is empty (AC9)', async () => {
    const f = fixture()
    writeFileSync(join(f.grooveDir, 'groove-01.mp3'), Buffer.alloc(0))

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-01')
    expect(output).toContain('empty')
  })

  it('exits non-zero and names the groove whose checksum moved (AC10)', async () => {
    const f = fixture()
    const file = join(f.grooveDir, 'groove-02.mp3')
    const bytes = readFileSync(file)
    bytes[3] = bytes[3] ^ 0xff
    writeFileSync(file, bytes)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-02')
    expect(output).toContain('checksum')
  })

  // Feature-12, Epic 1, Step A7 — R8, R9, R10, AC3, AC4. Each of the three uuid
  // faults, through the real command, reported by the name of the groove that
  // holds it: "a uuid is wrong somewhere in thirty entries" is not fixable.
  for (const [what, mangle] of [
    ['missing', (specs: { id: string; uuid?: string }[]) => delete specs[1].uuid],
    ['duplicated', (specs: { id: string; uuid?: string }[]) => (specs[1].uuid = specs[0].uuid)],
    ['malformed', (specs: { id: string; uuid?: string }[]) => (specs[1].uuid = 'not-a-uuid')],
  ] as const) {
    it(`exits non-zero naming the groove whose uuid is ${what}`, async () => {
      const f = fixture()
      const specs = JSON.parse(readFileSync(f.cataloguePath, 'utf8')) as { id: string; uuid?: string }[]
      mangle(specs)
      writeFileSync(f.cataloguePath, `${JSON.stringify(specs, null, 2)}\n`)

      const r = run(f)

      await expect(r.code).resolves.not.toBe(0)
      const output = r.lines.join('\n')
      expect(output).toContain('groove-02')
      expect(output).toContain('uuid')
    })
  }

  it('exits non-zero naming the manifest when it is stale (AC8)', async () => {
    const f = fixture()
    writeFileSync(f.manifestPath, `${readFileSync(f.manifestPath, 'utf8')}// edited\n`)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('grooves.generated.ts')
    expect(output).toContain('npm run grooves')
  })

  it('exits non-zero naming the catalogue when it is stale (AC8)', async () => {
    const f = fixture()
    writeFileSync(f.cataloguePath, `${readFileSync(f.cataloguePath, 'utf8')}\n`)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('catalogue.json')
    expect(output).toContain('npm run grooves')
  })

  it('exits non-zero when the lock file itself is missing', async () => {
    const f = fixture()
    rmSync(f.lockPath)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    expect(r.lines.join('\n')).toContain('grooves.lock.json')
  })

  it('reports every failure, not only the first', async () => {
    const f = fixture(['groove-01', 'groove-02', 'groove-03'])
    rmSync(join(f.grooveDir, 'groove-01.mp3'))
    writeFileSync(join(f.grooveDir, 'groove-03.mp3'), Buffer.alloc(0))

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('groove-01')
    expect(output).toContain('groove-03')
  })

  // Epic 2, Step B4: the build guard reads the manifest from the feature's
  // data/ folder, and must name the same file the generator writes.
  it('guards the manifest in the feature data/ folder, not lib/', () => {
    expect(DEFAULT_MANIFEST_PATH).toBe(
      join(import.meta.dirname, '../../src/features/daily-groove/data/grooves.generated.ts'),
    )
  })

  // Feature-10, Step B7 — R23, R24. The notes are a second family in the same
  // lock, checked by the same command.
  it('exits zero and names both counts when the notes are intact', async () => {
    const r = run(notesFixture())
    await expect(r.code).resolves.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('2 grooves')
    expect(output).toContain('3 notes')
  })

  it('exits non-zero and names the missing note (AC16)', async () => {
    const f = notesFixture()
    rmSync(join(f.notesDir, 'note-c-sharp.mp3'))

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('note-c-sharp.mp3')
    expect(output).toContain('missing')
  })

  it('exits non-zero when the notes manifest was hand-edited (AC17)', async () => {
    const f = notesFixture()
    writeFileSync(f.notesManifestPath, `${readFileSync(f.notesManifestPath, 'utf8')}// edited\n`)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('notes.generated.ts')
    expect(output).toContain('notes-manifest-stale')
  })

  it('exits non-zero when the pack declaration changed without a re-render (AC18)', async () => {
    const f = notesFixture()
    writeFileSync(f.packDeclarationPath, `${JSON.stringify({ comp: [] }, null, 2)}\n`)

    const r = run(f)
    await expect(r.code).resolves.not.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('pack.json')
    expect(output).toContain('pack-stale')
    expect(output).toContain('npm run notes')
  })

  // AC19: the guard runs where there is no sample pack and no rendered note.
  it('still reports on a lock that predates the notes', async () => {
    const r = run(fixture())
    await expect(r.code).resolves.toBe(0)
    const output = r.lines.join('\n')
    expect(output).toContain('2 grooves')
    expect(output).toContain('0 notes')
  })

  it('guards the notes beside the grooves, from the paths the render writes to', () => {
    expect(DEFAULT_NOTES_DIR).toBe(join(import.meta.dirname, '../../public/notes'))
    expect(DEFAULT_NOTES_MANIFEST_PATH).toBe(
      join(import.meta.dirname, '../../src/features/daily-groove/data/notes.generated.ts'),
    )
    expect(DEFAULT_PACK_DECLARATION_PATH).toBe(join(import.meta.dirname, 'samples/pack.json'))
  })

  it('importing the module runs nothing — the top-level call is guarded', async () => {
    // Reaching this line at all proves it: the import above did not exit the
    // process, and no verification ran against the real tree.
    const source = readFileSync(join(import.meta.dirname, 'verify-cli.ts'), 'utf8')
    expect(source).toMatch(/process\.argv\[1\]/)
    expect(typeof main).toBe('function')
  })
})
