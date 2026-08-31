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

/**
 * The committed artifacts, read once at module load — before any test runs.
 * A minting test that writes into the live tree corrupts the catalogue the
 * build guard checks, and that has already happened once in this feature.
 * Every fixture below lives in a temp dir; the last test in this file proves it.
 */
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

/** Every file in the committed audio directory, by name and size. */
function audioFingerprint(dir: string): string {
  return readdirSync(dir)
    .sort()
    .map((name) => `${name}:${statSync(join(dir, name)).size}`)
    .join(',')
}

/**
 * A real mp3 standing in for audio an earlier run minted. It is encoded
 * without the Xing header on purpose, so ffprobe reports a head delay of 0 for
 * it — a different number from the 0.025057 libmp3lame writes into a groove
 * this run encodes. A mint that shared one delay across the catalogue would
 * agree with itself while disagreeing with the files it describes.
 */
const STAND_IN = join(mkdtempSync(join(tmpdir(), 'grooves-standin-')), 'stand-in.mp3')
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.4',
  '-ac', '2', '-c:a', 'libmp3lame', '-write_xing', '0',
  STAND_IN,
])

/** Every entry's measured head delay, read back out of a rendered manifest. */
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
  { id: 'groove-01', template: 'straight-funk', seed: 1 },
  { id: 'groove-02', template: 'straight-funk', seed: 2 },
  { id: 'groove-03', template: 'straight-funk', seed: 3 },
  { id: 'groove-04', template: 'straight-funk', seed: 4 },
  { id: 'groove-05', template: 'shuffle', seed: 5 },
]

const TWO = FIVE.slice(0, 2)

const PASS = () => null
const REJECT_ALL = (): GateFailure => ({ check: 'seam', detail: 'discontinuity of 0.9' })

type Fixture = ReturnType<typeof fixture>

/** A whole generator tree in a temp dir: catalogue, audio, manifest and lock. */
function fixture(specs: readonly GrooveSpec[] = TWO) {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-add-'))
  const outDir = join(dir, 'audio')
  mkdirSync(outDir, { recursive: true })
  const cataloguePath = join(dir, 'catalogue.json')
  writeCatalogue(specs, cataloguePath)
  // Stand-ins for the already-minted audio. Their bytes must survive a mint,
  // and they are real mp3s because the mint measures every file it describes.
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

/**
 * Minting renders in full, and the render is no longer cheap: every candidate
 * now carries per-pass humanization, a tempo drift, note-offs, a hi-hat choke
 * and a Schroeder reverb, and a rejected candidate pays for all of it before
 * the gate turns it down. Vitest's 5 s default was written against a much
 * lighter pipeline and times these out under parallel load — which reads as a
 * flaky assertion when nothing is flaky but the clock.
 */
const MINT_TIMEOUT_MS = 30_000

/**
 * What `npm run notes` records in the shared lock. A mint never renders these
 * and cannot vouch for them, so its only correct behaviour is to leave them
 * exactly as it found them (F10 E1 R23).
 */
const NOTE_FIELDS = {
  notes: [{ id: 'C', sha256: 'a'.repeat(64), bytes: 49571 }],
  notesManifestSha256: 'b'.repeat(64),
  packSha256: 'c'.repeat(64),
}

/** Put a notes family into a fixture lock, as a prior `npm run notes` would. */
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

    // F10 E1 R23: one lock, two commands. The reference notes are recorded by
    // `npm run notes`, and a mint must carry them through untouched — a mint
    // that dropped them would leave `grooves:verify` passing while it silently
    // stopped guarding the notes.
    expect(lock!.notes).toEqual(NOTE_FIELDS.notes)
    expect(lock!.notesManifestSha256).toBe(NOTE_FIELDS.notesManifestSha256)
    expect(lock!.packSha256).toBe(NOTE_FIELDS.packSha256)

    // AC7: pre-existing audio bytes are byte-identical after the mint.
    for (const [name, bytes] of Object.entries(before)) {
      expect(readFileSync(join(f.outDir, name), 'utf8'), `${name} was rewritten`).toBe(bytes)
    }
  }, MINT_TIMEOUT_MS)

  it('regenerates the manifest so the new grooves need no follow-up edit', async () => {
    const f = fixture()
    const minted = await addGrooves(2, { startSeed: 1200, gate: PASS, ...f })

    const manifest = readFileSync(f.manifestPath, 'utf8')
    for (const spec of [...TWO, ...minted]) expect(manifest).toContain(spec.id)
  })

  // Step E4: the manifest a mint writes describes the audio on disk, one
  // measurement per file, so a groove minted under a different encoder
  // configuration carries a different, correct number.
  it("measures every mp3 it describes, giving each entry its own file's head delay", async () => {
    const f = fixture()
    const minted = await addGrooves(2, { startSeed: 1300, gate: PASS, ...f })

    const delays = headDelays(readFileSync(f.manifestPath, 'utf8'))
    expect(Object.keys(delays).sort()).toEqual(
      [...TWO, ...minted].map((s) => s.id).sort(),
    )
    // Freshly encoded: libmp3lame's 1105-sample priming, at 44.1kHz.
    for (const spec of minted) expect(delays[spec.id]).toBeCloseTo(0.025057, 6)
    // Already on disk, written by a different encoder configuration.
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
    // Seed 3 is groove-03's. The clock makes a collision unlikely, not
    // impossible, and using it as-is would mint a duplicate under a fresh id.
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
    // AC5: every rejection is reported, and names its check.
    const rejections = log.filter((line) => line.includes('peak'))
    expect(rejections).toHaveLength(2)
    for (const line of rejections) expect(line).toContain('true peak 1.42')
    // AC4/R6: a rejected candidate leaves no orphan mp3 behind.
    expect(mp3s(f.outDir)).toHaveLength(before.length + 2)
  })

  it('completes a run with many rejections without any human input', async () => {
    const f = fixture()
    let seen = 0
    // Two out of every three candidates fail.
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
    // The first candidate passes; nothing after it does. A batch that cannot
    // complete must leave no trace of the part that did.
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
    // The committed pack, not the synthesized stand-in. This is the one test
    // here that exercises `gate.ts` for real, and the gate's seam check is
    // calibrated for real samples: the stand-in's pitched voice is a
    // 0.9-second sine still sounding at a quarter of full scale when a
    // four-pass loop ends, so it fails the seam on grooves the real pack
    // renders cleanly and the mint runs out of attempts. Every other test in
    // this file injects a gate and is right to use the stand-in.
    const { loadPack } = await import('./pack.ts')
    const { fileURLToPath } = await import('node:url')
    const realPack = await loadPack(fileURLToPath(new URL('./samples', import.meta.url)))
    const f = { ...fixture(), pack: realPack }
    const minted = await addGrooves(2, { startSeed: 9000, log: () => {}, ...f })

    expect(minted).toHaveLength(2)
    // The default path reached gate.ts: re-gating what was minted still passes.
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
