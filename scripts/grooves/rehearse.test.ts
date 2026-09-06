import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CATALOGUE_PATH, readCatalogue, writeCatalogue } from './catalogue.ts'
import { DEFAULT_LOCK_PATH, DEFAULT_MANIFEST_PATH, DEFAULT_OUT_DIR } from './cli.ts'
import { commit, parseArgs, rehearse, resolveTemplate, type Rehearsal } from './rehearse.ts'
import { straightFunk } from './templates/index.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { GrooveSpec } from './types.ts'
import { isCanonicalUuid } from './uuid.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function audioFingerprint(dir: string): string {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.mp3'))
    .sort()
    .map((name) => `${name}:${sha256(join(dir, name))}`)
    .join(',')
}

// Captured before any test runs, so a write from any of them is caught below.
const COMMITTED = {
  catalogue: readFileSync(CATALOGUE_PATH, 'utf8'),
  lock: readFileSync(DEFAULT_LOCK_PATH, 'utf8'),
  manifest: readFileSync(DEFAULT_MANIFEST_PATH, 'utf8'),
  audio: audioFingerprint(DEFAULT_OUT_DIR),
}

// The placeholder pack's synthetic samples fail the real gate on `seam`, so
// every rehearsal here injects a pass. What is under test is the rig, not the
// thresholds — gate.test.ts owns those.
const PASS = () => null
const PACK = placeholderPack()

const TWO: GrooveSpec[] = [
  { id: 'groove-01', uuid: '6e48e341-7821-4980-be8b-0595cc854d35', template: 'straight-funk', seed: 1 },
  { id: 'groove-02', uuid: '42c659b3-a1af-41a1-8cdf-dabed78e961b', template: 'shuffle', seed: 2 },
]

const STAND_IN = (() => {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-rehearse-standin-'))
  const path = join(dir, 'stand-in.mp3')
  copyFileSync(join(DEFAULT_OUT_DIR, `${readCatalogue(CATALOGUE_PATH)[0].id}.mp3`), path)
  return path
})()

function fixture(specs: readonly GrooveSpec[] = TWO) {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-rehearse-'))
  const audioDir = join(dir, 'audio')
  mkdirSync(audioDir, { recursive: true })
  const cataloguePath = join(dir, 'catalogue.json')
  writeCatalogue(specs, cataloguePath)
  for (const spec of specs) copyFileSync(STAND_IN, join(audioDir, `${spec.id}.mp3`))
  return {
    dir,
    audioDir,
    cataloguePath,
    manifestPath: join(dir, 'grooves.generated.ts'),
    lockPath: join(dir, 'grooves.lock.json'),
  }
}

const TIMEOUT_MS = 30_000

describe('rehearse', () => {
  it('mints into a scratch tree under tmpdir and writes nothing inside the repo', async () => {
    const rehearsal = await rehearse({
      template: 'straight-funk',
      count: 1,
      startSeed: 5,
      pack: PACK,
      gate: PASS,
      log: () => {},
    })

    expect(readFileSync(CATALOGUE_PATH, 'utf8')).toBe(COMMITTED.catalogue)
    expect(readFileSync(DEFAULT_LOCK_PATH, 'utf8')).toBe(COMMITTED.lock)
    expect(readFileSync(DEFAULT_MANIFEST_PATH, 'utf8')).toBe(COMMITTED.manifest)
    expect(audioFingerprint(DEFAULT_OUT_DIR)).toBe(COMMITTED.audio)

    expect(rehearsal.dir.startsWith(tmpdir())).toBe(true)
    expect(resolve(rehearsal.dir).startsWith(REPO_ROOT)).toBe(false)

    const committedCount = readCatalogue(CATALOGUE_PATH).length
    const scratchAudio = readdirSync(join(rehearsal.dir, 'audio')).filter((f) => f.endsWith('.mp3'))
    expect(scratchAudio).toHaveLength(committedCount + 1)

    const written = JSON.parse(
      readFileSync(join(rehearsal.dir, 'rehearsal.json'), 'utf8'),
    ) as Rehearsal
    expect(written.startSeed).toBe(5)
    expect(written.template).toBe('straight-funk')
    expect(written.catalogueSha256).toBe(sha256(CATALOGUE_PATH))
    expect(written.grooves).toHaveLength(1)
    expect(written.grooves[0].template).toBe('straight-funk')
    expect(written.grooves[0].sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(written.grooves[0].bytes).toBeGreaterThan(1024)
    expect(written).toEqual(rehearsal)

    expect(existsSync(join(rehearsal.dir, 'catalogue.json'))).toBe(true)
    expect(existsSync(join(rehearsal.dir, 'grooves.generated.ts'))).toBe(true)
    expect(existsSync(join(rehearsal.dir, 'grooves.lock.json'))).toBe(true)
  }, TIMEOUT_MS)

  it('gives the same grooves and the same bytes for the same start seed', async () => {
    const f = fixture()
    const opts = {
      template: 'straight-funk' as const,
      count: 2,
      startSeed: 5,
      pack: PACK,
      gate: PASS,
      cataloguePath: f.cataloguePath,
      audioDir: f.audioDir,
      log: () => {},
    }

    const first = await rehearse(opts)
    const second = await rehearse(opts)

    expect(first.dir).not.toBe(second.dir)
    expect(second.grooves).toEqual(first.grooves)
    expect(second.startSeed).toBe(5)
    expect(second.catalogueSha256).toBe(first.catalogueSha256)
  }, TIMEOUT_MS)

  it('records a start seed of its own when none is given', async () => {
    const f = fixture()
    const rehearsal = await rehearse({
      template: 'straight-funk',
      count: 1,
      pack: PACK,
      gate: PASS,
      cataloguePath: f.cataloguePath,
      audioDir: f.audioDir,
      now: () => 1_700_000_000_000,
      log: () => {},
    })

    expect(Number.isInteger(rehearsal.startSeed)).toBe(true)
    expect(rehearsal.startSeed).toBeGreaterThan(0)
  }, TIMEOUT_MS)
})

describe('commit', () => {
  it('refuses a rehearsal whose catalogue has moved, and writes nothing', async () => {
    const f = fixture()
    const rehearsal = await rehearse({
      template: 'straight-funk',
      count: 1,
      startSeed: 5,
      pack: PACK,
      gate: PASS,
      cataloguePath: f.cataloguePath,
      audioDir: f.audioDir,
      log: () => {},
    })

    const moved: GrooveSpec[] = [
      ...TWO,
      { id: 'groove-03', uuid: 'c78377c1-f51b-4701-af4b-4c2107456851', template: 'straight-funk', seed: 99 },
    ]
    writeCatalogue(moved, f.cataloguePath)
    const catalogueBefore = readFileSync(f.cataloguePath, 'utf8')
    const audioBefore = readdirSync(f.audioDir).sort()

    await expect(
      commit(rehearsal, {
        cataloguePath: f.cataloguePath,
        outDir: f.audioDir,
        manifestPath: f.manifestPath,
        lockPath: f.lockPath,
        pack: PACK,
        gate: PASS,
        log: () => {},
      }),
    ).rejects.toThrow(/catalogueSha256/)

    await expect(
      commit(rehearsal, {
        cataloguePath: f.cataloguePath,
        outDir: f.audioDir,
        manifestPath: f.manifestPath,
        lockPath: f.lockPath,
        pack: PACK,
        gate: PASS,
        log: () => {},
      }),
    ).rejects.toThrow(new RegExp(`${rehearsal.catalogueSha256}[\\s\\S]*${sha256(f.cataloguePath)}`))

    expect(readFileSync(f.cataloguePath, 'utf8')).toBe(catalogueBefore)
    expect(readdirSync(f.audioDir).sort()).toEqual(audioBefore)
    expect(existsSync(f.manifestPath)).toBe(false)
    expect(existsSync(f.lockPath)).toBe(false)
  }, TIMEOUT_MS)

  it('mints exactly what was rehearsed', async () => {
    const f = fixture()
    const shared = {
      template: 'straight-funk' as const,
      count: 2,
      startSeed: 5,
      pack: PACK,
      gate: PASS,
      cataloguePath: f.cataloguePath,
      log: () => {},
    }
    const rehearsal = await rehearse({ ...shared, audioDir: f.audioDir })

    const minted = await commit(rehearsal, {
      cataloguePath: f.cataloguePath,
      outDir: f.audioDir,
      manifestPath: f.manifestPath,
      lockPath: f.lockPath,
      pack: PACK,
      gate: PASS,
      log: () => {},
    })

    expect(minted.map((s) => `${s.template}:${s.seed}`)).toEqual(
      rehearsal.grooves.map((g) => `${g.template}:${g.seed}`),
    )
    expect(minted.map((s) => s.id)).toEqual(rehearsal.grooves.map((g) => g.id))

    for (const spec of minted) {
      expect(isCanonicalUuid(spec.uuid)).toBe(true)
    }
    expect(new Set(minted.map((s) => s.uuid)).size).toBe(2)

    for (const groove of rehearsal.grooves) {
      expect(sha256(join(f.audioDir, `${groove.id}.mp3`)), `${groove.id} differs`).toBe(
        groove.sha256,
      )
    }

    expect(readCatalogue(f.cataloguePath)).toHaveLength(TWO.length + 2)
  }, TIMEOUT_MS)

  it('throws naming the first groove that differs from the rehearsal', async () => {
    const f = fixture()
    const rehearsal = await rehearse({
      template: 'straight-funk',
      count: 2,
      startSeed: 5,
      pack: PACK,
      gate: PASS,
      cataloguePath: f.cataloguePath,
      audioDir: f.audioDir,
      log: () => {},
    })

    const doctored: Rehearsal = {
      ...rehearsal,
      grooves: rehearsal.grooves.map((g, i) => (i === 1 ? { ...g, seed: g.seed + 1000 } : g)),
    }

    await expect(
      commit(doctored, {
        cataloguePath: f.cataloguePath,
        outDir: f.audioDir,
        manifestPath: f.manifestPath,
        lockPath: f.lockPath,
        pack: PACK,
        gate: PASS,
        log: () => {},
      }),
    ).rejects.toThrow(new RegExp(doctored.grooves[1].id))
  }, TIMEOUT_MS)
})

describe('resolveTemplate', () => {
  it('returns the registered object for a registered id', async () => {
    expect(await resolveTemplate('straight-funk')).toBe(straightFunk)
  })

  it('names the registry and the path it looked for when the id is unknown', async () => {
    await expect(resolveTemplate('no-such-feel')).rejects.toThrow(/straight-funk/)
    await expect(resolveTemplate('no-such-feel')).rejects.toThrow(
      new RegExp(join('templates', 'no-such-feel.ts').replaceAll('\\', '\\\\')),
    )
  })

  it('loads an unregistered template from a module path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'grooves-rehearse-module-'))
    const good = join(dir, 'temp-feel.ts')
    writeFileSync(
      good,
      `export const tempFeel = ${JSON.stringify({ ...straightFunk, id: 'temp-feel' })}\n`,
      'utf8',
    )
    const resolved = await resolveTemplate('temp-feel', { modulePath: good })
    expect(resolved.id).toBe('temp-feel')
    expect(resolved.tempoRange).toEqual(straightFunk.tempoRange)

    const bad = join(dir, 'other-feel.ts')
    writeFileSync(
      bad,
      `export const otherFeel = ${JSON.stringify({ ...straightFunk, id: 'not-it' })}\n`,
      'utf8',
    )
    await expect(resolveTemplate('other-feel', { modulePath: bad })).rejects.toThrow(/not-it/)
  })
})

describe('parseArgs', () => {
  it('reads a rehearsal request', () => {
    expect(parseArgs(['--template', 'straight-funk', '--count', '6'])).toEqual({
      mode: 'rehearse',
      template: 'straight-funk',
      count: 6,
    })
  })

  it('reads the equals form and an explicit seed', () => {
    expect(parseArgs(['--template=straight-funk', '--count=2', '--seed=41'])).toEqual({
      mode: 'rehearse',
      template: 'straight-funk',
      count: 2,
      startSeed: 41,
    })
  })

  it('defaults the count to six', () => {
    expect(parseArgs(['--template', 'boom-bap'])).toEqual({
      mode: 'rehearse',
      template: 'boom-bap',
      count: 6,
    })
  })

  it('reads a commit request', () => {
    expect(parseArgs(['--commit', '/tmp/x/rehearsal.json'])).toEqual({
      mode: 'commit',
      rehearsalPath: '/tmp/x/rehearsal.json',
    })
  })

  it('rejects a request with neither a template nor a rehearsal', () => {
    expect(() => parseArgs([])).toThrow(/--template/)
    expect(() => parseArgs(['--count', '6'])).toThrow(/--template/)
    expect(() => parseArgs(['--template', 'x', '--count', 'many'])).toThrow(/--count/)
    expect(() => parseArgs(['--template', 'x', '--commit', 'y'])).toThrow(/--commit/)
  })
})

it('left every committed artifact untouched', () => {
  expect(readFileSync(CATALOGUE_PATH, 'utf8'), 'a test rewrote the catalogue').toBe(
    COMMITTED.catalogue,
  )
  expect(readFileSync(DEFAULT_LOCK_PATH, 'utf8'), 'a test rewrote the lock').toBe(COMMITTED.lock)
  expect(readFileSync(DEFAULT_MANIFEST_PATH, 'utf8'), 'a test rewrote the manifest').toBe(
    COMMITTED.manifest,
  )
  expect(audioFingerprint(DEFAULT_OUT_DIR), 'a test rewrote a committed mp3').toBe(COMMITTED.audio)
})
