import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { addGrooves, renderCandidate } from './add.ts'
import { readCatalogue, writeCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { gateCandidate } from './gate.ts'
import { readLock } from './lock.ts'
import { allTemplates } from './templates/index.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { GateFailure, GrooveSpec } from './types.ts'
import { isCanonicalUuid } from './uuid.ts'

const ROOT = join(process.cwd(), 'scripts', 'grooves')
const REAL_LOCK = join(ROOT, 'grooves.lock.json')
const REAL_CATALOGUE = join(ROOT, 'catalogue.json')
const REAL_MANIFEST = join(
  process.cwd(),
  'src',
  'features',
  'daily-groove',
  'data',
  'grooves.generated.ts',
)
const REAL_AUDIO = join(process.cwd(), 'public', 'grooves')
const COMMITTED = {
  lock: readFileSync(REAL_LOCK, 'utf8'),
  catalogue: readFileSync(REAL_CATALOGUE, 'utf8'),
  manifest: readFileSync(REAL_MANIFEST, 'utf8'),
  audio: audioFingerprint(REAL_AUDIO),
}

function audioFingerprint(dir: string): string {
  return readdirSync(dir)
    .sort()
    .map((name) => `${name}:${statSync(join(dir, name)).size}`)
    .join(',')
}

const STAND_IN = join(mkdtempSync(join(tmpdir(), 'grooves-standin-')), 'stand-in.mp3')
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.4',
  '-ac', '2', '-c:a', 'libmp3lame', '-write_xing', '0',
  STAND_IN,
])

function headDelays(manifest: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of manifest.matchAll(
    /id: '([^']+)',[\s\S]*?headDelaySeconds: ([\d.e+-]+),/g,
  )) {
    out[m[1]] = Number(m[2])
  }
  return out
}

const FIVE: GrooveSpec[] = [
  { id: 'groove-01', uuid: '6e48e341-7821-4980-be8b-0595cc854d35', template: 'straight-funk', seed: 1 },
  { id: 'groove-02', uuid: '42c659b3-a1af-41a1-8cdf-dabed78e961b', template: 'straight-funk', seed: 2 },
  { id: 'groove-03', uuid: 'c78377c1-f51b-4701-af4b-4c2107456851', template: 'straight-funk', seed: 3 },
  { id: 'groove-04', uuid: 'f52dfb38-ef29-4efb-b6d6-3897d297ba2a', template: 'straight-funk', seed: 4 },
  { id: 'groove-05', uuid: '61b80299-0b4a-459a-a487-c5c9eab95848', template: 'shuffle', seed: 5 },
]

const TWO = FIVE.slice(0, 2)

const PASS = () => null
const REJECT_ALL = (): GateFailure => ({ check: 'seam', detail: 'discontinuity of 0.9' })

type Fixture = ReturnType<typeof fixture>

function fixture(specs: readonly GrooveSpec[] = TWO) {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-add-'))
  const outDir = join(dir, 'audio')
  mkdirSync(outDir, { recursive: true })
  const cataloguePath = join(dir, 'catalogue.json')
  writeCatalogue(specs, cataloguePath)
  for (const spec of specs) {
    copyFileSync(STAND_IN, join(outDir, `${spec.id}.mp3`))
  }
  return {
    dir,
    outDir,
    cataloguePath,
    manifestPath: join(dir, 'grooves.generated.ts'),
    lockPath: join(dir, 'grooves.lock.json'),
    pack: placeholderPack(),
  }
}

function mp3s(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.mp3'))
    .sort()
}

function audioBytes(f: Fixture): Record<string, string> {
  return Object.fromEntries(mp3s(f.outDir).map((n) => [n, readFileSync(join(f.outDir, n), 'utf8')]))
}

const MINT_TIMEOUT_MS = 30_000

const NOTE_FIELDS = {
  notes: [{ id: 'C', sha256: 'a'.repeat(64), bytes: 49571 }],
  notesManifestSha256: 'b'.repeat(64),
  packSha256: 'c'.repeat(64),
}

function seedNoteFields(lockPath: string): void {
  writeFileSync(
    lockPath,
    `${JSON.stringify(
      {
        catalogueSha256: 'd'.repeat(64),
        manifestSha256: 'e'.repeat(64),
        grooves: [],
        ...NOTE_FIELDS,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
}

describe('addGrooves', () => {
  it('adds exactly n grooves, leaving every existing entry untouched', async () => {
    const f = fixture()
    seedNoteFields(f.lockPath)
    const before = audioBytes(f)

    const minted = await addGrooves(3, { startSeed: 1000, gate: PASS, ...f })

    expect(minted).toHaveLength(3)

    const after = readCatalogue(f.cataloguePath)
    expect(after).toHaveLength(5)
    expect(after.slice(0, 2)).toEqual(TWO)

    for (const spec of minted) {
      const file = join(f.outDir, `${spec.id}.mp3`)
      expect(existsSync(file), `${spec.id}.mp3 missing`).toBe(true)
      expect(statSync(file).size).toBeGreaterThan(1024)
    }

    const lock = readLock(f.lockPath)
    expect(lock).not.toBeNull()
    for (const spec of minted) {
      expect(lock!.grooves.map((g) => g.id)).toContain(spec.id)
    }

    expect(lock!.notes).toEqual(NOTE_FIELDS.notes)
    expect(lock!.notesManifestSha256).toBe(NOTE_FIELDS.notesManifestSha256)
    expect(lock!.packSha256).toBe(NOTE_FIELDS.packSha256)

    for (const [name, bytes] of Object.entries(before)) {
      expect(readFileSync(join(f.outDir, name), 'utf8'), `${name} was rewritten`).toBe(bytes)
    }
  }, MINT_TIMEOUT_MS)

  it('mints a uuid for every groove it appends, and touches no existing one', async () => {
    const f = fixture()
    const MINTED_UUID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

    const minted = await addGrooves(1, {
      startSeed: 1400,
      gate: PASS,
      mintUuid: () => MINTED_UUID,
      ...f,
    })

    expect(minted[0].uuid).toBe(MINTED_UUID)

    const after = readCatalogue(f.cataloguePath)
    expect(after.at(-1)!.uuid).toBe(MINTED_UUID)
    expect(after.slice(0, 2).map((s) => s.uuid)).toEqual(TWO.map((s) => s.uuid))
    expect(readFileSync(f.manifestPath, 'utf8')).toContain(`uuid: '${MINTED_UUID}',`)
  }, MINT_TIMEOUT_MS)

  it('mints a real, unique uuid when nobody injects one', async () => {
    const f = fixture()
    const minted = await addGrooves(2, { startSeed: 1500, gate: PASS, ...f })

    for (const spec of minted) {
      expect(isCanonicalUuid(spec.uuid), `${spec.id}: ${String(spec.uuid)}`).toBe(true)
    }
    const all = readCatalogue(f.cataloguePath)
    expect(new Set(all.map((s) => s.uuid)).size).toBe(all.length)
  }, MINT_TIMEOUT_MS)

  it('regenerates the manifest so the new grooves need no follow-up edit', async () => {
    const f = fixture()
    const minted = await addGrooves(2, { startSeed: 1200, gate: PASS, ...f })

    const manifest = readFileSync(f.manifestPath, 'utf8')
    for (const spec of [...TWO, ...minted]) expect(manifest).toContain(spec.id)
  })

  it("measures every mp3 it describes, giving each entry its own file's head delay", async () => {
    const f = fixture()
    const minted = await addGrooves(2, { startSeed: 1300, gate: PASS, ...f })

    const delays = headDelays(readFileSync(f.manifestPath, 'utf8'))
    expect(Object.keys(delays).sort()).toEqual(
      [...TWO, ...minted].map((s) => s.id).sort(),
    )
    for (const spec of minted) expect(delays[spec.id]).toBeCloseTo(0.025057, 6)
    for (const spec of TWO) expect(delays[spec.id]).toBe(0)
  })

  it('never reuses an id or a seed across successive runs', async () => {
    const f = fixture()
    const first = await addGrooves(3, { startSeed: 1000, gate: PASS, ...f })
    const second = await addGrooves(3, { startSeed: 5000, gate: PASS, ...f })

    const all = readCatalogue(f.cataloguePath)
    expect(all).toHaveLength(8)
    expect(new Set(all.map((s) => s.id)).size).toBe(8)
    expect(new Set(all.map((s) => s.seed)).size).toBe(8)
    const firstIds = new Set(first.map((s) => s.id))
    for (const spec of second) expect(firstIds.has(spec.id)).toBe(false)
  }, MINT_TIMEOUT_MS)

  it('skips past a start seed that is already in the catalogue', async () => {
    const f = fixture(FIVE)
    const minted = await addGrooves(2, { startSeed: 3, gate: PASS, ...f })

    expect(minted.map((s) => s.seed)).not.toContain(3)
    for (const spec of minted) expect(spec.seed).toBeGreaterThan(3)
  })

  it('spreads a batch across more than one template', async () => {
    const f = fixture()
    const minted = await addGrooves(4, { startSeed: 2000, gate: PASS, ...f })

    const used = new Set(minted.map((s) => s.template))
    expect(used.size).toBeGreaterThan(1)
    for (const id of used) expect(allTemplates().map((t) => t.id)).toContain(id)
  })

  it('skips rejected candidates automatically, naming the failed check', async () => {
    const f = fixture()
    const before = mp3s(f.outDir)
    let seen = 0
    const gate = () => (seen++ < 2 ? { check: 'peak', detail: 'true peak 1.42' } : null)
    const log: string[] = []

    const minted = await addGrooves(2, { startSeed: 3000, gate, log: (m) => log.push(m), ...f })

    expect(minted).toHaveLength(2)
    const rejections = log.filter((line) => line.includes('peak'))
    expect(rejections).toHaveLength(2)
    for (const line of rejections) expect(line).toContain('true peak 1.42')
    expect(mp3s(f.outDir)).toHaveLength(before.length + 2)
  })

  it('completes a run with many rejections without any human input', async () => {
    const f = fixture()
    let seen = 0
    const gate = () => (seen++ % 3 === 2 ? null : { check: 'density', detail: '1.2 per bar' })

    const minted = await addGrooves(3, { startSeed: 3500, gate, log: () => {}, ...f })

    expect(minted).toHaveLength(3)
    expect(readCatalogue(f.cataloguePath)).toHaveLength(5)
  })

  it('fails loudly and writes nothing when it cannot reach n', async () => {
    const f = fixture()
    const catalogueBefore = readFileSync(f.cataloguePath, 'utf8')
    const audioBefore = audioBytes(f)

    await expect(
      addGrooves(1, { startSeed: 4000, maxAttempts: 5, gate: REJECT_ALL, log: () => {}, ...f }),
    ).rejects.toThrow(/5 attempts/)

    expect(readFileSync(f.cataloguePath, 'utf8')).toBe(catalogueBefore)
    expect(audioBytes(f)).toEqual(audioBefore)
    expect(existsSync(f.manifestPath), 'a failed run wrote a manifest').toBe(false)
    expect(existsSync(f.lockPath), 'a failed run wrote a lock').toBe(false)
  })

  it('writes nothing for the grooves that did pass when the batch cannot complete', async () => {
    const f = fixture()
    const catalogueBefore = readFileSync(f.cataloguePath, 'utf8')
    const audioBefore = audioBytes(f)
    let seen = 0
    const gate = () => (seen++ === 0 ? null : REJECT_ALL())

    await expect(
      addGrooves(3, { startSeed: 4500, maxAttempts: 6, gate, log: () => {}, ...f }),
    ).rejects.toThrow(/6 attempts/)

    expect(readFileSync(f.cataloguePath, 'utf8')).toBe(catalogueBefore)
    expect(audioBytes(f)).toEqual(audioBefore)
    expect(existsSync(f.manifestPath), 'a failed run wrote a manifest').toBe(false)
    expect(existsSync(f.lockPath), 'a failed run wrote a lock').toBe(false)
  })

  it('numbers a new groove from the highest ever used, not from the count', async () => {
    const f = fixture(FIVE.filter((s) => s.id !== 'groove-03'))
    const minted = await addGrooves(1, { startSeed: 6000, gate: PASS, ...f })

    const after = readCatalogue(f.cataloguePath)
    expect(after.slice(0, 4).map((s) => s.id)).toEqual([
      'groove-01',
      'groove-02',
      'groove-04',
      'groove-05',
    ])
    expect(minted[0].id).toBe('groove-06')
  })

  it('draws its start seed from the clock, so two concurrent runs diverge', async () => {
    const a = fixture()
    const b = fixture()

    const first = await addGrooves(2, { now: () => 1_700_000_000_000, gate: PASS, ...a })
    const second = await addGrooves(2, { now: () => 1_700_000_777_000, gate: PASS, ...b })

    const seeds = new Set(first.map((s) => s.seed))
    for (const spec of second) expect(seeds.has(spec.seed)).toBe(false)
  })

  it('rejects a request for a non-positive count', async () => {
    const f = fixture()
    await expect(addGrooves(0, { startSeed: 1, gate: PASS, ...f })).rejects.toThrow()
    await expect(addGrooves(-2, { startSeed: 1, gate: PASS, ...f })).rejects.toThrow()
  })

  it('puts every candidate through the real quality gate when none is injected', async () => {
    const { loadPack } = await import('./pack.ts')
    const { fileURLToPath } = await import('node:url')
    const realPack = await loadPack(fileURLToPath(new URL('./samples', import.meta.url)))
    const f = { ...fixture(), pack: realPack }
    const minted = await addGrooves(2, { startSeed: 9000, log: () => {}, ...f })

    expect(minted).toHaveLength(2)
    for (const spec of minted) {
      const template = allTemplates().find((t) => t.id === spec.template)!
      const { events, music, harmony } = buildEvents(spec, template)
      const pcm = renderCandidate(spec, events, music, template, f.pack)
      expect(gateCandidate({ pcm, events, music, harmony, template })).toBeNull()
    }
  }, MINT_TIMEOUT_MS)

  it('left every committed artifact untouched', () => {
    expect(readFileSync(REAL_LOCK, 'utf8'), 'a test rewrote the committed lock').toBe(COMMITTED.lock)
    expect(readFileSync(REAL_CATALOGUE, 'utf8'), 'a test rewrote the catalogue').toBe(
      COMMITTED.catalogue,
    )
    expect(readFileSync(REAL_MANIFEST, 'utf8'), 'a test rewrote the manifest').toBe(
      COMMITTED.manifest,
    )
    expect(audioFingerprint(REAL_AUDIO), 'a test wrote into public/grooves').toBe(COMMITTED.audio)
  })
})
