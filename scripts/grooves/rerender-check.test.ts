import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Groove } from '../../src/lib/groove.ts'
import { DEFAULT_LOCK_PATH, DEFAULT_MANIFEST_PATH, DEFAULT_OUT_DIR } from './cli.ts'
import { buildLock, noteFile, readLock, writeLock, type Lock } from './lock.ts'
import { writeManifest } from './manifest.ts'
import {
  EXIT_AUDIO_SET,
  EXIT_CLEAN,
  EXIT_HARMONIC,
  EXIT_LOUDNESS,
  EXIT_PRECONDITION,
  EXIT_PROMOTE,
  REPORT_NAME,
  SCRATCH_GROOVE_DIR,
  SCRATCH_LOCK_NAME,
  SCRATCH_MANIFEST_NAME,
  main,
  type RenderReport,
} from './rerender-check.ts'
import type { Pcm } from './types.ts'

const RIDING = ['groove-01', 'groove-02']
const TEMPLATE_OF: Record<string, string> = {
  'groove-01': 'shuffle',
  'groove-02': 'swung-sixteenth',
  'groove-03': 'straight-funk',
  'groove-04': 'half-time',
  'groove-05': 'bright-straight',
}
const IDS = Object.keys(TEMPLATE_OF)
const NOTE_IDS = ['C', 'E♭']

function audioBytes(id: string, salt = 0, n = 1024): Buffer {
  const buf = Buffer.alloc(n)
  for (let i = 0; i < n; i += 1) buf[i] = (i * 17 + id.charCodeAt(id.length - 1) + salt) % 251
  return buf
}

function grooveEntry(id: string, i: number, overrides: Partial<Groove> = {}): Groove {
  return {
    id,
    uuid: `a0000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    audioSrc: `/grooves/${id}.mp3`,
    name: `Groove ${i + 1}`,
    bpm: 90 + i,
    scale: 'C mixolydian',
    chord: 'C7',
    progression: 'I - IV',
    progressionDegrees: [0, 3],
    root: 'C',
    flavour: 'mixolydian',
    bars: 2,
    loopBars: 4,
    headDelaySeconds: 0.01,
    ...overrides,
  }
}

/** A constant-amplitude buffer whose RMS is exactly `dbfs`. */
function pcmAt(dbfs: number, frames = 128): Pcm {
  const amplitude = dbfs === Number.NEGATIVE_INFINITY ? 0 : 10 ** (dbfs / 20)
  return {
    sampleRate: 44100,
    left: new Float32Array(frames).fill(amplitude),
    right: new Float32Array(frames).fill(amplitude),
  }
}

type Tree = {
  root: string
  grooveDir: string
  notesDir: string
  cataloguePath: string
  manifestPath: string
  notesManifestPath: string
  lockPath: string
  packDeclarationPath: string
}

/**
 * A whole miniature repo: the four paths CheckOptions names, plus the three
 * the runner derives from them (notes dir, notes manifest, pack declaration),
 * so `verifyLock` on the promoted tree checks everything it checks in the real
 * one.
 */
function tree(): Tree {
  const root = mkdtempSync(join(tmpdir(), 'rerender-check-'))
  const grooveDir = join(root, 'public', 'grooves')
  const notesDir = join(root, 'public', 'notes')
  const dataDir = join(root, 'data')
  const scriptsDir = join(root, 'scripts')
  mkdirSync(grooveDir, { recursive: true })
  mkdirSync(notesDir, { recursive: true })
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(join(scriptsDir, 'samples'), { recursive: true })

  const cataloguePath = join(scriptsDir, 'catalogue.json')
  writeFileSync(
    cataloguePath,
    `${JSON.stringify(
      IDS.map((id, i) => ({
        id,
        uuid: grooveEntry(id, i).uuid,
        template: TEMPLATE_OF[id],
        seed: i + 1,
      })),
      null,
      2,
    )}\n`,
  )

  const manifestPath = join(dataDir, 'grooves.generated.ts')
  writeManifest(
    IDS.map((id, i) => grooveEntry(id, i)),
    manifestPath,
  )

  const notesManifestPath = join(dataDir, 'notes.generated.ts')
  writeFileSync(notesManifestPath, `export const NOTES = ${JSON.stringify(NOTE_IDS)}\n`)

  const packDeclarationPath = join(scriptsDir, 'samples', 'pack.json')
  writeFileSync(packDeclarationPath, `${JSON.stringify({ id: 'fixture', voices: {} }, null, 2)}\n`)

  for (const id of IDS) writeFileSync(join(grooveDir, `${id}.mp3`), audioBytes(id))
  for (const id of NOTE_IDS) writeFileSync(noteFile(notesDir, id), audioBytes(id, 7, 256))

  const lockPath = join(scriptsDir, 'grooves.lock.json')
  writeLock(
    buildLock(
      { grooveDir, cataloguePath, manifestPath, notesDir, notesManifestPath, packDeclarationPath },
      IDS,
      NOTE_IDS,
    ),
    lockPath,
  )

  return {
    root,
    grooveDir,
    notesDir,
    cataloguePath,
    manifestPath,
    notesManifestPath,
    lockPath,
    packDeclarationPath,
  }
}

type RenderShape = {
  /** ids whose mp3 bytes differ from the committed ones */
  changed?: string[]
  /** ids whose manifest entry differs, and how */
  manifest?: Record<string, Partial<Groove>>
  /** ids missing from the render entirely */
  drop?: string[]
  levels?: Record<string, number>
}

type FakeRender = {
  render: (target: { outDir: string; manifestPath: string; lockPath: string }) => Promise<{
    pcm: Map<string, Pcm>
  }>
  targets: { outDir: string; manifestPath: string; lockPath: string }[]
}

function fakeRender(t: Tree, shape: RenderShape = {}): FakeRender {
  const changed = new Set(shape.changed ?? RIDING)
  const dropped = new Set(shape.drop ?? [])
  const ids = IDS.filter((id) => !dropped.has(id))
  const targets: FakeRender['targets'] = []

  return {
    targets,
    render: async (target) => {
      targets.push(target)
      mkdirSync(target.outDir, { recursive: true })
      for (const id of ids) {
        writeFileSync(join(target.outDir, `${id}.mp3`), audioBytes(id, changed.has(id) ? 1 : 0))
      }

      writeManifest(
        ids.map((id) => {
          const i = IDS.indexOf(id)
          const moved = changed.has(id) ? { headDelaySeconds: 0.02 } : {}
          return grooveEntry(id, i, { ...moved, ...(shape.manifest?.[id] ?? {}) })
        }),
        target.manifestPath,
      )

      writeLock(
        buildLock(
          {
            grooveDir: target.outDir,
            cataloguePath: t.cataloguePath,
            manifestPath: target.manifestPath,
          },
          ids,
        ),
        target.lockPath,
      )

      const pcm = new Map<string, Pcm>()
      for (const id of ids) pcm.set(id, pcmAt(shape.levels?.[id] ?? -24))
      return { pcm }
    },
  }
}

type Run = { code: number; lines: string[]; scratchDir: string; log: string }

async function run(t: Tree, shape: RenderShape = {}, fake = fakeRender(t, shape)): Promise<Run> {
  const scratchDir = mkdtempSync(join(tmpdir(), 'rerender-scratch-'))
  const lines: string[] = []
  const code = await main({
    lockPath: t.lockPath,
    manifestPath: t.manifestPath,
    cataloguePath: t.cataloguePath,
    grooveDir: t.grooveDir,
    scratchDir,
    render: fake.render,
    log: (line) => lines.push(line),
  })
  return { code, lines, scratchDir, log: lines.join('\n') }
}

/** Every file under `dir`, as path → sha-free identity (size + mtime + bytes). */
function snapshot(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (at: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const full = join(at, entry.name)
      if (entry.isDirectory()) walk(full)
      else out[full] = readFileSync(full).toString('base64')
    }
  }
  walk(dir)
  return out
}

function stageLines(lines: readonly string[], stage: string): string[] {
  return lines.filter((line) => line.startsWith(stage))
}

describe('rerender-check — the staged runner', () => {
  describe('stage 1 — the render goes to scratch and nowhere else', () => {
    it('hands the render an out dir, a manifest and a lock all inside the scratch directory', async () => {
      const t = tree()
      const fake = fakeRender(t)
      const { code, scratchDir } = await run(t, {}, fake)

      expect(code).toBe(EXIT_CLEAN)
      expect(fake.targets).toHaveLength(1)
      const [target] = fake.targets
      expect(target.outDir).toBe(join(scratchDir, SCRATCH_GROOVE_DIR))
      expect(target.manifestPath).toBe(join(scratchDir, SCRATCH_MANIFEST_NAME))
      expect(target.lockPath).toBe(join(scratchDir, SCRATCH_LOCK_NAME))
      for (const path of [target.outDir, target.manifestPath, target.lockPath]) {
        expect(path.startsWith(`${scratchDir}/`)).toBe(true)
      }
    })

    it('writes nothing into the committed tree it was pointed at', async () => {
      const t = tree()
      const before = snapshot(t.root)
      await run(t)
      expect(snapshot(t.root)).toEqual(before)
    })

    it('leaves the repo public/grooves, manifest and lock untouched', async () => {
      const t = tree()
      const repoBefore = {
        grooves: readdirSync(DEFAULT_OUT_DIR)
          .map((name) => `${name}:${statSync(join(DEFAULT_OUT_DIR, name)).mtimeMs}`)
          .sort(),
        manifest: statSync(DEFAULT_MANIFEST_PATH).mtimeMs,
        lock: statSync(DEFAULT_LOCK_PATH).mtimeMs,
      }

      await run(t)

      expect({
        grooves: readdirSync(DEFAULT_OUT_DIR)
          .map((name) => `${name}:${statSync(join(DEFAULT_OUT_DIR, name)).mtimeMs}`)
          .sort(),
        manifest: statSync(DEFAULT_MANIFEST_PATH).mtimeMs,
        lock: statSync(DEFAULT_LOCK_PATH).mtimeMs,
      }).toEqual(repoBefore)
    })
  })

  describe('stage 2 — a moved harmonic field stops everything', () => {
    it('exits on the harmonic code, names the field, and never reaches stages 3 or 4', async () => {
      const t = tree()
      const { code, lines, log, scratchDir } = await run(t, {
        manifest: { 'groove-03': { root: 'E♭' } },
      })

      expect(code).toBe(EXIT_HARMONIC)
      expect(log).toContain('groove-03')
      expect(log).toContain('root')
      expect(log).toContain("'C'")
      expect(log).toContain("'E♭'")
      expect(stageLines(lines, 'stage 3')).toEqual([])
      expect(stageLines(lines, 'stage 4')).toEqual([])
      expect(stageLines(lines, 'stage 5')).toEqual([])
      expect(existsSync(join(scratchDir, REPORT_NAME))).toBe(false)
    })

    it('treats a non-harmonic field that moved as unexpected and stops on it too', async () => {
      const t = tree()
      const { code, log, scratchDir } = await run(t, {
        manifest: { 'groove-05': { name: 'Renamed' } },
      })

      expect(code).toBe(EXIT_HARMONIC)
      expect(log).toContain('groove-05')
      expect(log).toContain('name')
      expect(existsSync(join(scratchDir, REPORT_NAME))).toBe(false)
    })

    it('does not promote a harmonic run, and the tree is byte-identical afterwards', async () => {
      const t = tree()
      const before = snapshot(t.root)

      const { code, scratchDir } = await run(t, { manifest: { 'groove-01': { chord: 'F7' } } })
      expect(code).toBe(EXIT_HARMONIC)
      expect(snapshot(t.root)).toEqual(before)

      const lines: string[] = []
      const promoted = await main({
        lockPath: t.lockPath,
        manifestPath: t.manifestPath,
        cataloguePath: t.cataloguePath,
        grooveDir: t.grooveDir,
        promoteFrom: scratchDir,
        log: (line) => lines.push(line),
      })

      expect(promoted).toBe(EXIT_PROMOTE)
      expect(lines.join('\n')).toContain(REPORT_NAME)
      expect(snapshot(t.root)).toEqual(before)
    })

    it('a headDelaySeconds move on its own is expected and does not stop the run', async () => {
      const t = tree()
      const { code, log } = await run(t)

      expect(code).toBe(EXIT_CLEAN)
      expect(log).toContain('headDelaySeconds')
    })

    it('refuses rather than passing when the rendered manifest cannot be parsed', async () => {
      const t = tree()
      const fake = fakeRender(t)
      const scratchDir = mkdtempSync(join(tmpdir(), 'rerender-scratch-'))
      const lines: string[] = []
      const code = await main({
        lockPath: t.lockPath,
        manifestPath: t.manifestPath,
        cataloguePath: t.cataloguePath,
        grooveDir: t.grooveDir,
        scratchDir,
        log: (line) => lines.push(line),
        render: async (target) => {
          const result = await fake.render(target)
          writeFileSync(target.manifestPath, 'export const NOTHING = 1\n')
          return result
        },
      })

      expect(code).toBe(EXIT_PRECONDITION)
      expect(code).not.toBe(EXIT_CLEAN)
      expect(existsSync(join(scratchDir, REPORT_NAME))).toBe(false)
    })
  })

  describe('stage 3 — loudness stops the run before anything is counted', () => {
    it('prints the whole table, not only the failing row, and never reaches stage 4', async () => {
      const t = tree()
      const { code, lines, log } = await run(t, { levels: { 'groove-04': -80 } })

      expect(code).toBe(EXIT_LOUDNESS)
      expect(stageLines(lines, 'stage 2').join('\n')).toContain('clean')
      for (const id of IDS) expect(log).toContain(id)
      expect(log).toContain('-80.0')
      expect(stageLines(lines, 'stage 4')).toEqual([])
      expect(stageLines(lines, 'stage 5')).toEqual([])
    })

    it('reports digital silence rather than crashing on it', async () => {
      const t = tree()
      const { code, log } = await run(t, { levels: { 'groove-02': Number.NEGATIVE_INFINITY } })

      expect(code).toBe(EXIT_LOUDNESS)
      expect(log).toContain('-inf')
    })
  })

  describe('stage 4 — the changed audio must be exactly the riding feels’ grooves', () => {
    it('passes when the changed hashes are the riding feels and lists them', async () => {
      const t = tree()
      const { code, log } = await run(t)

      expect(code).toBe(EXIT_CLEAN)
      for (const id of RIDING) expect(log).toContain(id)
      expect(log).toContain('2')
    })

    it('stops when a groove that was not expected to change did', async () => {
      const t = tree()
      const { code, lines } = await run(t, { changed: [...RIDING, 'groove-03'] })

      expect(code).toBe(EXIT_AUDIO_SET)
      const stage4 = stageLines(lines, 'stage 4').join('\n')
      expect(lines.join('\n')).toContain('groove-03')
      expect(stage4.length).toBeGreaterThan(0)
      expect(
        lines.some((line) => line.includes('groove-03') && line.includes('not expected')),
      ).toBe(true)
      expect(stageLines(lines, 'stage 5')).toEqual([])
    })

    it('stops when a groove that was expected to change did not', async () => {
      const t = tree()
      const { code, lines } = await run(t, { changed: ['groove-01'] })

      expect(code).toBe(EXIT_AUDIO_SET)
      expect(
        lines.some((line) => line.includes('groove-02') && line.includes('did not')),
      ).toBe(true)
      expect(stageLines(lines, 'stage 5')).toEqual([])
    })

    it('never reaches stage 4 when the render dropped a groove — that is a stage 2 stop', async () => {
      const t = tree()
      const { code, lines, log } = await run(t, { drop: ['groove-05'] })

      expect(code).toBe(EXIT_HARMONIC)
      expect(log).toContain('groove-05')
      expect(stageLines(lines, 'stage 4')).toEqual([])
      expect(stageLines(lines, 'stage 5')).toEqual([])
    })
  })

  describe('stage 5 — the listening list and the report', () => {
    it('names every changed groove with its scratch path and its template', async () => {
      const t = tree()
      const { code, log, scratchDir } = await run(t)

      expect(code).toBe(EXIT_CLEAN)
      for (const id of RIDING) {
        expect(log).toContain(join(scratchDir, SCRATCH_GROOVE_DIR, `${id}.mp3`))
        expect(log).toContain(TEMPLATE_OF[id])
      }
    })

    it('names two unchanged controls, one of them from half-time, with their paths', async () => {
      const t = tree()
      const { lines, scratchDir } = await run(t)

      const controls = lines.filter((line) => line.includes('control'))
      expect(controls.length).toBeGreaterThanOrEqual(2)
      const text = controls.join('\n')
      expect(text).toContain('groove-04')
      expect(text).toContain('half-time')
      expect(text).toContain(join(scratchDir, SCRATCH_GROOVE_DIR, 'groove-04.mp3'))
      const others = controls.filter((line) => !line.includes('groove-04'))
      expect(others.some((line) => RIDING.every((id) => !line.includes(id)))).toBe(true)
    })

    it('writes a report.json that round-trips as a RenderReport', async () => {
      const t = tree()
      const { scratchDir } = await run(t)

      const reportPath = join(scratchDir, REPORT_NAME)
      expect(existsSync(reportPath)).toBe(true)
      const report = JSON.parse(readFileSync(reportPath, 'utf8')) as RenderReport

      expect(report.scratchDir).toBe(scratchDir)
      expect(Number.isNaN(Date.parse(report.renderedAt))).toBe(false)
      expect(report.changed).toEqual(RIDING)

      const scratchLock = readLock(join(scratchDir, SCRATCH_LOCK_NAME)) as Lock
      expect(report.grooves).toEqual(scratchLock.grooves)
      expect(report.manifestSha256).toBe(scratchLock.manifestSha256)
      expect(report.loudness.map((row) => row.id).sort()).toEqual([...IDS].sort())
      for (const row of report.loudness) expect(row.inWindow).toBe(true)
    })
  })

  describe('--promote — the listened bytes and only those', () => {
    async function greenRun(t: Tree): Promise<string> {
      const { code, scratchDir } = await run(t)
      expect(code).toBe(EXIT_CLEAN)
      return scratchDir
    }

    async function promote(t: Tree, from: string): Promise<{ code: number; log: string }> {
      const lines: string[] = []
      const code = await main({
        lockPath: t.lockPath,
        manifestPath: t.manifestPath,
        cataloguePath: t.cataloguePath,
        grooveDir: t.grooveDir,
        promoteFrom: from,
        log: (line) => lines.push(line),
      })
      return { code, log: lines.join('\n') }
    }

    it('copies the scratch mp3s and manifest byte for byte', async () => {
      const t = tree()
      const from = await greenRun(t)

      const { code } = await promote(t, from)
      expect(code).toBe(EXIT_CLEAN)

      for (const id of IDS) {
        expect(readFileSync(join(t.grooveDir, `${id}.mp3`))).toEqual(
          readFileSync(join(from, SCRATCH_GROOVE_DIR, `${id}.mp3`)),
        )
      }
      expect(readFileSync(t.manifestPath)).toEqual(
        readFileSync(join(from, SCRATCH_MANIFEST_NAME)),
      )
    })

    it('takes grooves and manifestSha256 from the render and keeps the notes rows', async () => {
      const t = tree()
      const committed = readLock(t.lockPath) as Lock
      const from = await greenRun(t)
      const scratchLock = readLock(join(from, SCRATCH_LOCK_NAME)) as Lock

      const { code } = await promote(t, from)
      expect(code).toBe(EXIT_CLEAN)

      const after = readLock(t.lockPath) as Lock
      expect(after.grooves).toEqual(scratchLock.grooves)
      expect(after.manifestSha256).toBe(scratchLock.manifestSha256)
      expect(after.notes).toEqual(committed.notes)
      expect(after.notesManifestSha256).toBe(committed.notesManifestSha256)
      expect(after.packSha256).toBe(committed.packSha256)
    })

    it('leaves a tree that verifies', async () => {
      const t = tree()
      const from = await greenRun(t)

      const { code, log } = await promote(t, from)
      expect(code).toBe(EXIT_CLEAN)
      expect(log).not.toContain('[checksum]')
      expect(log).not.toContain('[missing]')
    })

    it('refuses, naming the file, when a scratch mp3 moved after the report was written', async () => {
      const t = tree()
      const from = await greenRun(t)
      const before = snapshot(t.root)

      const tampered = join(from, SCRATCH_GROOVE_DIR, 'groove-02.mp3')
      writeFileSync(tampered, audioBytes('groove-02', 99))

      const { code, log } = await promote(t, from)
      expect(code).toBe(EXIT_PROMOTE)
      expect(log).toContain(tampered)
      expect(snapshot(t.root)).toEqual(before)
    })

    it('refuses a directory that was never checked', async () => {
      const t = tree()
      const before = snapshot(t.root)
      const never = mkdtempSync(join(tmpdir(), 'rerender-unchecked-'))
      mkdirSync(join(never, SCRATCH_GROOVE_DIR), { recursive: true })

      const { code, log } = await promote(t, never)
      expect(code).toBe(EXIT_PROMOTE)
      expect(log).toContain(REPORT_NAME)
      expect(log).toContain('never')
      expect(snapshot(t.root)).toEqual(before)
    })

    it('refuses when the scratch manifest moved after the report was written', async () => {
      const t = tree()
      const from = await greenRun(t)
      const before = snapshot(t.root)

      writeFileSync(join(from, SCRATCH_MANIFEST_NAME), '// tampered\n')

      const { code, log } = await promote(t, from)
      expect(code).toBe(EXIT_PROMOTE)
      expect(log).toContain(SCRATCH_MANIFEST_NAME)
      expect(snapshot(t.root)).toEqual(before)
    })
  })

  describe('the exit codes are distinct', () => {
    it('gives every stop its own code', () => {
      const codes = [EXIT_CLEAN, EXIT_HARMONIC, EXIT_LOUDNESS, EXIT_AUDIO_SET, EXIT_PROMOTE, EXIT_PRECONDITION]
      expect(new Set(codes).size).toBe(codes.length)
      expect(EXIT_CLEAN).toBe(0)
      expect(codes.filter((code) => code !== EXIT_CLEAN).every((code) => code > 0)).toBe(true)
    })
  })
})

describe('rerender-check — preconditions', () => {
  it('refuses when there is no committed lock to compare against', async () => {
    const t = tree()
    const lines: string[] = []
    const code = await main({
      lockPath: join(t.root, 'scripts', 'nothing-here.json'),
      manifestPath: t.manifestPath,
      cataloguePath: t.cataloguePath,
      grooveDir: t.grooveDir,
      scratchDir: mkdtempSync(join(tmpdir(), 'rerender-scratch-')),
      render: fakeRender(t).render,
      log: (line) => lines.push(line),
    })

    expect(code).toBe(EXIT_PRECONDITION)
    expect(lines.join('\n')).toContain('nothing-here.json')
  })

  it('refuses when the committed manifest is missing', async () => {
    const t = tree()
    const lines: string[] = []
    const code = await main({
      lockPath: t.lockPath,
      manifestPath: join(dirname(t.manifestPath), 'absent.generated.ts'),
      cataloguePath: t.cataloguePath,
      grooveDir: t.grooveDir,
      scratchDir: mkdtempSync(join(tmpdir(), 'rerender-scratch-')),
      render: fakeRender(t).render,
      log: (line) => lines.push(line),
    })

    expect(code).toBe(EXIT_PRECONDITION)
    expect(lines.join('\n')).toContain('absent.generated.ts')
  })
})
