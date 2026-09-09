import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { readLock, sha256File, writeLock } from './lock.ts'
import { decodeAudioFile } from './decode.ts'
import { buildEvents } from './events.ts'
import { mixTracks, PEAK_CEILING, SEAM_THRESHOLD, truePeak } from './mix.ts'
import { nameFor } from './name.ts'
import { loadPack } from './pack.ts'
import { TEMPLATES, templateById } from './templates/index.ts'
import { renderVoices } from './voices.ts'
import { OVERHANG_BARS, SAMPLE_RATE } from './cli.ts'
import {
  DEFAULT_LOCK_PATH,
  DEFAULT_MANIFEST_PATH,
  DEFAULT_OUT_DIR,
  DEFAULT_PACK_DIR,
  generate,
  optionsFrom,
  parseArgs,
  toGroove,
} from './cli.ts'
import { FLAVOURS, displayFlavour } from '../../src/lib/theory/names.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { GrooveSpec } from './types.ts'

const REAL_LOCK = join(process.cwd(), 'scripts', 'grooves', 'grooves.lock.json')
const REAL_MP3 = join(process.cwd(), 'public', 'grooves', 'groove-01.mp3')

const SPECS: GrooveSpec[] = [
  { id: 'groove-01', uuid: '20b80c61-ed92-4203-8451-b988b09ad8c2', template: 'straight-funk', seed: 1 },
  { id: 'groove-02', uuid: 'eaaa0108-1bd4-4472-aee7-b5726b5b89ad', template: 'straight-funk', seed: 2 },
]

function tempRun() {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-'))
  return {
    catalogue: SPECS,
    pack: placeholderPack(),
    outDir: join(dir, 'audio'),
    manifestPath: join(dir, 'grooves.generated.ts'),
    cataloguePath: join(dir, 'catalogue.json'),
    lockPath: join(dir, 'grooves.lock.json'),
    heardIn: {},
  }
}

const RENDER_TIMEOUT_MS = 60_000

const scaleOf = (spec: GrooveSpec) =>
  buildEvents(spec, templateById(spec.template)).music.scale

describe('generate with a heard-in table', () => {
  it('writes the table into the manifest as HEARD_IN', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    const table = { [scaleOf(SPECS[0])]: { track: 'So What', artist: 'Miles Davis' } }

    await generate({ ...opts, encode: false, heardIn: table })

    const manifest = readFileSync(opts.manifestPath, 'utf8')
    expect(manifest).toContain('export const HEARD_IN: Record<string, HeardIn> = {')
    expect(manifest).toContain(`'${scaleOf(SPECS[0])}': { track: 'So What', artist: 'Miles Davis' },`)
  })

  it('refuses a key no groove in the run renders, naming it', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    const table = { 'C♯ locrian': { track: 'A', artist: 'B' } }

    await expect(generate({ ...opts, encode: false, heardIn: table })).rejects.toThrow(
      /heard-in\.json: C♯ locrian: no groove renders this scale/,
    )
    expect(existsSync(opts.manifestPath)).toBe(false)
  })
})

describe('generate', () => {
  it('writes every artifact inside the run it was given, and nothing outside it', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    const before = readFileSync(REAL_LOCK, 'utf8')
    await generate(opts)
    expect(existsSync(opts.lockPath)).toBe(true)
    expect(readFileSync(REAL_LOCK, 'utf8'), 'a test run rewrote the committed lock').toBe(before)
  }, RENDER_TIMEOUT_MS)

  it('writes one mp3 per catalogue entry and a manifest describing them', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    const { entries } = await generate(opts)

    expect(entries.map((e) => e.id)).toEqual(['groove-01', 'groove-02'])
    for (const spec of SPECS) {
      const file = join(opts.outDir, `${spec.id}.mp3`)
      expect(existsSync(file), `${spec.id}.mp3 missing`).toBe(true)
      expect(statSync(file).size).toBeGreaterThan(1024)
    }
    const manifest = readFileSync(opts.manifestPath, 'utf8')
    expect(manifest).toContain('export const GROOVES')
    for (const e of entries) expect(manifest).toContain(e.name)
    for (const e of entries) {
      expect(manifest).toMatch(new RegExp(`^ {4}loopBars: ${e.loopBars},$`, 'm'))
    }
  })

  it('describes each groove with all thirteen fields', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    const { entries } = await generate(opts)
    for (const e of entries) {
      expect(e.audioSrc).toBe(`/grooves/${e.id}.mp3`)
      expect(e.uuid, `${e.id} carries no uuid`).toBe(
        SPECS.find((spec) => spec.id === e.id)?.uuid,
      )
      expect(e.bars).toBe(4)
      expect(e.loopBars, `${e.id} states no loop length`).toBeGreaterThanOrEqual(e.bars)
      expect(e.loopBars! % e.bars, `${e.id} is not whole passes`).toBe(0)
      expect(e.bpm).toBeGreaterThan(40)
      expect(e.name.length).toBeGreaterThan(0)
      expect(e.scale.startsWith(e.root)).toBe(true)
      expect(e.scale.toLowerCase()).toContain(e.flavour.toLowerCase())
      expect(e.chord.length).toBeGreaterThan(0)
      expect(e.progression.length).toBeGreaterThan(0)
      expect(e.headDelaySeconds).toBeGreaterThan(0)
      expect(e.headDelaySeconds).toBeCloseTo(0.025057, 6)
    }
  })

  it('re-renders the manifest and the lock from existing audio, writing no mp3', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    mkdirSync(opts.outDir, { recursive: true })
    for (const spec of SPECS) copyFileSync(REAL_MP3, join(opts.outDir, `${spec.id}.mp3`))
    const before = Object.fromEntries(
      SPECS.map((s) => [s.id, readFileSync(join(opts.outDir, `${s.id}.mp3`))]),
    )

    const { entries } = await generate({ ...opts, encode: false })

    for (const spec of SPECS) {
      expect(
        readFileSync(join(opts.outDir, `${spec.id}.mp3`)).equals(before[spec.id]),
        `${spec.id}.mp3 was re-encoded`,
      ).toBe(true)
    }
    expect(readdirSync(opts.outDir).filter((f) => f.endsWith('.mp3'))).toHaveLength(SPECS.length)

    const manifest = readFileSync(opts.manifestPath, 'utf8')
    expect(manifest).toContain('export const GROOVES')
    for (const e of entries) expect(e.headDelaySeconds).toBeCloseTo(0.025057, 6)
    expect(manifest).toMatch(/^ {4}headDelaySeconds: 0\.025057,$/m)

    const lock = readLock(opts.lockPath)
    expect(lock).not.toBeNull()
    expect(lock!.grooves.map((g) => g.id)).toEqual(SPECS.map((s) => s.id))
    for (const entry of lock!.grooves) {
      expect(entry.sha256).toBe(sha256File(join(opts.outDir, `${entry.id}.mp3`)))
    }
  })

  it('preserves the note fields another command recorded in the lock', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    mkdirSync(opts.outDir, { recursive: true })
    for (const spec of SPECS) copyFileSync(REAL_MP3, join(opts.outDir, `${spec.id}.mp3`))

    const notes = [
      { id: 'C', sha256: 'a'.repeat(64), bytes: 11 },
      { id: 'E\u266d', sha256: 'b'.repeat(64), bytes: 22 },
    ]
    writeLock(
      {
        catalogueSha256: 'c'.repeat(64),
        manifestSha256: 'd'.repeat(64),
        grooves: [],
        notes,
        notesManifestSha256: 'e'.repeat(64),
        packSha256: 'f'.repeat(64),
      },
      opts.lockPath,
    )

    await generate({ ...opts, encode: false })

    const after = readLock(opts.lockPath)!
    expect(after.notes).toEqual(notes)
    expect(after.notesManifestSha256).toBe('e'.repeat(64))
    expect(after.packSha256).toBe('f'.repeat(64))
    expect(after.grooves.map((g) => g.id)).toEqual(SPECS.map((s) => s.id))
    expect(after.catalogueSha256).toBe(sha256File(opts.cataloguePath))
  }, RENDER_TIMEOUT_MS)

  it('renders identical PCM when run twice — determinism is asserted here, not on the mp3', async () => {
    const a = await generate({ ...tempRun(), encode: false })
    const b = await generate({ ...tempRun(), encode: false })

    expect(a.entries).toEqual(b.entries)
    expect(a.entries.map((e) => e.uuid)).toEqual(SPECS.map((s) => s.uuid))
    expect(a.entries.map((e) => e.uuid)).toEqual(b.entries.map((e) => e.uuid))
    for (const spec of SPECS) {
      const left = a.pcm.get(spec.id)!
      const right = b.pcm.get(spec.id)!
      expect(left.sampleRate).toBe(right.sampleRate)
      expect(Array.from(left.left)).toEqual(Array.from(right.left))
      expect(Array.from(left.right)).toEqual(Array.from(right.right))
    }
  })

  it('renders a loop as long as the entry says it is, at its stated tempo', async () => {
    const { entries, pcm } = await generate({ ...tempRun(), encode: false })
    for (const e of entries) {
      const buffer = pcm.get(e.id)!
      const expectedFrames = Math.ceil((60 / e.bpm) * 4 * e.loopBars! * buffer.sampleRate)
      expect(Math.abs(buffer.left.length - expectedFrames), e.id).toBeLessThanOrEqual(1)
    }
  })

  it('renders audio that is not silent and does not clip', async () => {
    const { pcm } = await generate({ ...tempRun(), encode: false })
    for (const [id, buffer] of pcm) {
      let peak = 0
      for (const v of buffer.left) peak = Math.max(peak, Math.abs(v))
      expect(peak, `${id} is silent`).toBeGreaterThan(0.01)
      expect(peak, `${id} clips`).toBeLessThan(1)
    }
  })
})

describe('the committed render', () => {
  it('defaults to the real sample pack, not the placeholder', () => {
    expect(DEFAULT_PACK_DIR.endsWith('samples')).toBe(true)
    expect(existsSync(join(DEFAULT_PACK_DIR, 'pack.json'))).toBe(true)
    expect(existsSync(join(DEFAULT_PACK_DIR, 'provenance.json'))).toBe(true)
  })

  it('writes the manifest into the feature data/ folder, not lib/', () => {
    expect(DEFAULT_MANIFEST_PATH).toBe(
      join(import.meta.dirname, '../../src/features/daily-groove/data/grooves.generated.ts'),
    )
  })

  it('has a committed catalogue whose ids and templates are well formed', () => {
    const specs = readCatalogue()
    expect(specs.length).toBeGreaterThan(0)
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length)
    expect(new Set(specs.map((s) => s.seed)).size).toBe(specs.length)
    for (const s of specs) expect(s.id).toMatch(/^groove-\d{2}$/)
  })
})

describe('toGroove', () => {
  it('carries the name it is handed, and asks for none of its own (quick 10)', () => {
    const music = {
      bpm: 96,
      bars: 4,
      loopBars: 4,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am–Dm–E7',
      progressionDegrees: [0, 3, 4] as number[],
    } as const
    expect(toGroove(SPECS[0], music, 0, 'Quiet Lagoon').name).toBe('Quiet Lagoon')
    expect(toGroove(SPECS[0], music, 0, 'Salted Ferry').name).toBe('Salted Ferry')
  })

  it('carries the head delay it was measured with onto the entry', () => {
    const music = {
      bpm: 96,
      bars: 4,
      loopBars: 4,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am–Dm–E7',
      progressionDegrees: [0, 3, 4] as number[],
    } as const
    expect(toGroove(SPECS[0], music, 0.025057, nameFor(SPECS[0].id)).headDelaySeconds).toBe(0.025057)
    expect(toGroove(SPECS[1], music, 0.031111, nameFor(SPECS[1].id)).headDelaySeconds).toBe(0.031111)
  })

  it("carries the spec's template onto the entry as its style (quick 11)", () => {
    const music = {
      bpm: 96,
      bars: 4,
      loopBars: 4,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am–Dm–E7',
      progressionDegrees: [0, 3, 4] as number[],
    } as const
    for (const spec of [SPECS[0], SPECS[1]]) {
      expect(toGroove(spec, music, 0, nameFor(spec.id)).style).toBe(spec.template)
    }
  })

  it("carries the spec's uuid onto the entry, unchanged", () => {
    const music = {
      bpm: 96,
      bars: 4,
      loopBars: 4,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am\u2013Dm\u2013E7',
      progressionDegrees: [0, 3, 4] as number[],
    } as const
    expect(toGroove(SPECS[0], music, 0, nameFor(SPECS[0].id)).uuid).toBe(SPECS[0].uuid)
    expect(toGroove(SPECS[1], music, 0, nameFor(SPECS[1].id)).uuid).toBe(SPECS[1].uuid)
    expect(toGroove(SPECS[0], music, 0, nameFor(SPECS[0].id)).uuid).not.toBe(SPECS[1].uuid)
  })

  it('carries the degrees the music was built from onto the entry — R4, AC5', () => {
    const music = {
      bpm: 96,
      bars: 4,
      loopBars: 4,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am–Dm–E7',
      progressionDegrees: [0, 3, 4] as number[],
    } as const
    expect(toGroove(SPECS[0], music, 0, nameFor(SPECS[0].id)).progressionDegrees).toEqual([0, 3, 4])
    expect(
      toGroove(SPECS[0], { ...music, progressionDegrees: [0, 4, 3] }, 0, nameFor(SPECS[0].id))
        .progressionDegrees,
    ).toEqual([0, 4, 3])
  })

  it('carries both lengths: the four-bar figure and the rendered loop', () => {
    const music = {
      bpm: 96,
      bars: 4,
      loopBars: 8,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am–Dm–E7',
      progressionDegrees: [0, 3, 4] as number[],
    } as const
    const entry = toGroove(SPECS[0], music, 0.025057, nameFor(SPECS[0].id))
    expect(entry.bars).toBe(4)
    expect(entry.loopBars).toBe(8)
    expect(toGroove(SPECS[0], { ...music, loopBars: 16 }, 0.025057, nameFor(SPECS[0].id)).loopBars).toBe(16)
  })
})

describe('displayFlavour', () => {
  it('title-cases the generator flavour into the app spelling', () => {
    expect(displayFlavour('dorian')).toBe('Dorian')
    expect(displayFlavour('harmonic-minor')).toBe('Harmonic minor')
    expect(displayFlavour('blues')).toBe('Blues')
  })

  it('spells the whole vocabulary modally, with no Major or Minor in it', () => {
    const displayed = FLAVOURS.map(displayFlavour)
    expect(displayed).toContain('Ionian')
    expect(displayed).toContain('Aeolian')
    expect(displayed).not.toContain('Major')
    expect(displayed).not.toContain('Minor')
  })

  it('agrees with what the app derives from the scale string', () => {
    const groove = toGroove(SPECS[0], {
      bpm: 96,
      bars: 4,
      loopBars: 4,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am–Dm–E7',
      progressionDegrees: [0, 3, 4] as number[],
    }, 0.025057, nameFor(SPECS[0].id))
    const rest = groove.scale.slice(groove.scale.indexOf(' ') + 1)
    expect(groove.flavour).toBe(rest.charAt(0).toUpperCase() + rest.slice(1))
  })
})

describe('the finished pipeline, through the real pack', () => {
  it('renders the whole loop, peaks on the ceiling, and closes its seam', async () => {
    const pack = await loadPack(DEFAULT_PACK_DIR)
    for (const spec of readCatalogue().slice(0, 3)) {
      const template = templateById(spec.template)
      const { events, music } = buildEvents(spec, template)
      const tracks = renderVoices(events, pack, SAMPLE_RATE, {
        id: spec.id,
        bars: music.loopBars,
        bpm: music.bpm,
        overhangBars: OVERHANG_BARS,
      })
      const master = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })

      const expected = Math.round((60 / music.bpm) * 4 * music.loopBars * SAMPLE_RATE)
      expect(
        Math.abs(master.left.length - expected),
        `${spec.id} is not ${music.loopBars} bars`,
      ).toBeLessThanOrEqual(1)

      expect(truePeak(master)).toBeCloseTo(PEAK_CEILING, 3)
      let stored = 0
      for (const v of master.left) stored = Math.max(stored, Math.abs(v))
      expect(stored, `${spec.id} clips`).toBeLessThan(1)

      const seamL = Math.abs(master.left[master.left.length - 1] - master.left[0])
      const seamR = Math.abs(master.right[master.right.length - 1] - master.right[0])
      expect(seamL, `${spec.id} left seam`).toBeLessThan(SEAM_THRESHOLD)
      expect(seamR, `${spec.id} right seam`).toBeLessThan(SEAM_THRESHOLD)
    }
  }, 60_000)
})

describe('the committed mp3s', () => {
  it('carry no silent padding at either end beyond the music itself', async () => {
    const entries = readCatalogue().slice(0, 3)
    for (const spec of entries) {
      const pcm = await decodeAudioFile(join(process.cwd(), 'public', 'grooves', `${spec.id}.mp3`))
      const audible = (from: number, to: number, step: number) => {
        for (let i = from; i !== to; i += step) {
          if (Math.abs(pcm.left[i]) > 0.005 || Math.abs(pcm.right[i]) > 0.005) return i
        }
        return -1
      }
      const head = audible(0, pcm.left.length, 1)
      const tail = audible(pcm.left.length - 1, -1, -1)
      const leadMs = (head / pcm.sampleRate) * 1000
      const trailMs = ((pcm.left.length - 1 - tail) / pcm.sampleRate) * 1000
      expect(head, `${spec.id} decoded silent`).toBeGreaterThanOrEqual(0)
      expect(leadMs, `${spec.id} has ${leadMs.toFixed(1)}ms of leading silence`).toBeLessThan(15)
      expect(trailMs, `${spec.id} has ${trailMs.toFixed(1)}ms of trailing silence`).toBeLessThan(15)
    }
  }, 60_000)
})

describe('the audition rig', () => {
  it('sends audio, manifest and lock to the scratch directory --out names', () => {
    const options = optionsFrom(parseArgs(['--out', '/tmp/audition-x']))

    expect(options).toMatchObject({
      outDir: '/tmp/audition-x',
      manifestPath: join('/tmp/audition-x', 'grooves.generated.ts'),
      lockPath: join('/tmp/audition-x', 'grooves.lock.json'),
    })
    expect(options.outDir).not.toBe(DEFAULT_OUT_DIR)
    expect(options.manifestPath).not.toBe(DEFAULT_MANIFEST_PATH)
    expect(options.lockPath).not.toBe(DEFAULT_LOCK_PATH)
  })

  // --only used to set options.catalogue, which narrowed what generate rendered *and*
  // what it wrote: the manifest came out holding only the named ids, the option pools
  // were built from them alone, and heardIn was cleared to stop the table failing
  // against six scales. Quick-14 ran it over six bossa grooves and lost the other 48.
  it('names the ids to re-encode and leaves the catalogue alone', () => {
    const options = optionsFrom(parseArgs(['--only', 'groove-07']))

    expect(options.encodeOnly).toEqual(['groove-07'])
    expect(options.catalogue, '--only narrows the catalogue again').toBeUndefined()
    expect(options.heardIn, '--only drops the heard-in table again').toBeUndefined()
  })

  it('takes --only more than once', () => {
    const options = optionsFrom(parseArgs(['--only', 'groove-07', '--only', 'groove-01']))
    expect(options.encodeOnly).toEqual(['groove-07', 'groove-01'])
  })

  it('names an --only id the catalogue does not hold, instead of rendering everything', () => {
    expect(() => optionsFrom(parseArgs(['--only', 'groove-99']))).toThrow(/groove-99/)
  })

  it('points packDir at the throwaway pack --pack names', () => {
    expect(optionsFrom(parseArgs(['--pack', '/tmp/pack-1'])).packDir).toBe('/tmp/pack-1')
  })

  it('names a flag that was given no value', () => {
    expect(() => parseArgs(['--pack'])).toThrow(/--pack/)
    expect(() => parseArgs(['--out'])).toThrow(/--out/)
    expect(() => parseArgs(['--only'])).toThrow(/--only/)
    expect(() => parseArgs(['--out', '--pack', '/tmp/p'])).toThrow(/--out/)
  })

  it('names an unknown token rather than falling back to a full render', () => {
    expect(() => parseArgs(['--outdir', '/tmp/x'])).toThrow(/--outdir/)
    expect(() => parseArgs(['groove-07'])).toThrow(/groove-07/)
  })

  it('still reads --manifest-only, off the same parse', () => {
    expect(parseArgs(['--manifest-only']).manifestOnly).toBe(true)
    expect(parseArgs([]).manifestOnly).toBe(false)
    expect(optionsFrom(parseArgs(['--manifest-only'])).encode).toBe(false)
  })

  it('asks for exactly today’s options when no flag is given', () => {
    const options = optionsFrom(parseArgs([]))
    expect(Object.keys(options)).toEqual(['encode'])
    expect(options.encode).toBe(true)
  })

  it('renders one groove into a temp directory and leaves the committed render alone', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audition-'))
    const manifestBefore = sha256File(DEFAULT_MANIFEST_PATH)
    const manifestMtimeBefore = statSync(DEFAULT_MANIFEST_PATH).mtimeMs
    const lockBefore = readLock(DEFAULT_LOCK_PATH)

    await generate({
      ...optionsFrom(parseArgs(['--only', 'groove-07', '--out', dir])),
      pack: placeholderPack(),
      encode: false,
    })

    expect(existsSync(join(dir, 'grooves.generated.ts'))).toBe(true)
    expect(sha256File(DEFAULT_MANIFEST_PATH)).toBe(manifestBefore)
    expect(statSync(DEFAULT_MANIFEST_PATH).mtimeMs).toBe(manifestMtimeBefore)
    expect(readLock(DEFAULT_LOCK_PATH)).toEqual(lockBefore)
  }, RENDER_TIMEOUT_MS)

  // The assertion quick-14 needed and did not have. It is written against the manifest
  // the run produces rather than against options, because the loss happened inside
  // generate: a narrowed catalogue reaches writeManifest and buildPools, and neither
  // can tell a subset run from a full one.
  it('writes a manifest covering every groove, not only the ones it re-encodes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audition-'))
    const catalogue = readCatalogue()

    const { entries, pcm } = await generate({
      ...optionsFrom(parseArgs(['--only', 'groove-07', '--out', dir])),
      pack: placeholderPack(),
      encode: false,
    })

    expect(entries.map((e) => e.id)).toEqual(catalogue.map((s) => s.id))
    expect(entries.length, 'the catalogue shrank to what --only names').toBeGreaterThan(1)
    expect([...pcm.keys()], 'mixed audio for a groove it was not asked to re-encode').toEqual([
      'groove-07',
    ])

    const written = readFileSync(join(dir, 'grooves.generated.ts'), 'utf8')
    for (const spec of catalogue) {
      expect(written, `${spec.id} is missing from the manifest`).toContain(`id: '${spec.id}'`)
    }
    expect(written, 'the heard-in table was dropped').toContain('HEARD_IN')
  }, RENDER_TIMEOUT_MS)

  // The delay probe used to be all-or-nothing: one absent mp3 and every groove in the
  // manifest got headDelaySeconds: 0. That was invisible while --only rendered only what
  // it named; once the manifest covers the catalogue, one missing file would zero the
  // other 53. Probed against the committed renders, with one file deliberately absent.
  it('keeps every head delay a subset run does not re-encode', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audition-'))
    const catalogue = readCatalogue()
    const skipped = catalogue.filter((s) => s.id !== 'groove-01')

    for (const spec of skipped) {
      copyFileSync(join(DEFAULT_OUT_DIR, `${spec.id}.mp3`), join(dir, `${spec.id}.mp3`))
    }

    const { entries } = await generate({
      ...optionsFrom(parseArgs(['--only', 'groove-07', '--out', dir])),
      pack: placeholderPack(),
      encode: false,
    })

    const delayOf = (id: string) => entries.find((e) => e.id === id)!.headDelaySeconds
    expect(delayOf('groove-01'), 'a groove with no mp3 on disk should read 0').toBe(0)
    for (const spec of skipped) {
      expect(delayOf(spec.id), `${spec.id} was zeroed by groove-01's absence`).toBeGreaterThan(0)
    }
  }, RENDER_TIMEOUT_MS)
})

describe('an off-catalogue render — R11', () => {
  const optionsFor = (argv: string[]) => optionsFrom(parseArgs(argv))

  const committed = () => ({
    manifest: sha256File(DEFAULT_MANIFEST_PATH),
    manifestMtime: statSync(DEFAULT_MANIFEST_PATH).mtimeMs,
    lock: sha256File(DEFAULT_LOCK_PATH),
    lockMtime: statSync(DEFAULT_LOCK_PATH).mtimeMs,
  })

  it('reads --template and every --seed, in the order the flags appear', () => {
    const args = parseArgs(['--template', 'shuffle', '--seed', '7', '--seed', '9', '--out', '/tmp/audition-y'])

    expect(args).toEqual({
      template: 'shuffle',
      seeds: [7, 9],
      outDir: '/tmp/audition-y',
      only: [],
      manifestOnly: false,
    })
  })

  it('synthesises one uuid-less spec per seed, and asks nothing of heard-in.json', () => {
    const dir = '/tmp/audition-y'
    const options = optionsFor(['--template', 'shuffle', '--seed', '7', '--seed', '9', '--out', dir])

    expect(options.catalogue).toEqual([
      { id: 'audition-shuffle-7', uuid: '', template: 'shuffle', seed: 7 },
      { id: 'audition-shuffle-9', uuid: '', template: 'shuffle', seed: 9 },
    ])
    expect(options.heardIn).toEqual({})
    expect(options.outDir).toBe(dir)
    expect(options.manifestPath).toBe(join(dir, 'grooves.generated.ts'))
    expect(options.lockPath).toBe(join(dir, 'grooves.lock.json'))
    expect(options.manifestPath).not.toBe(DEFAULT_MANIFEST_PATH)
    expect(options.lockPath).not.toBe(DEFAULT_LOCK_PATH)
  })

  it('names no catalogue entry: the ids it invents are not groove-NN', () => {
    const options = optionsFor(['--template', 'shuffle', '--seed', '7', '--out', '/tmp/audition-y'])
    const ids = new Set(readCatalogue().map((s) => s.id))
    for (const spec of options.catalogue!) {
      expect(ids.has(spec.id), `${spec.id} collides with a catalogue entry`).toBe(false)
      expect(spec.id).not.toMatch(/^groove-\d{2}$/)
    }
  })

  it('refuses --template without --out, rather than overwriting the real manifest', () => {
    const before = committed()
    expect(() => optionsFor(['--template', 'shuffle', '--seed', '7'])).toThrow(/--out/)
    expect(committed()).toEqual(before)
  })

  it('refuses --template together with --only', () => {
    const before = committed()
    expect(() =>
      optionsFor(['--template', 'shuffle', '--seed', '7', '--only', 'groove-01', '--out', '/tmp/audition-y']),
    ).toThrow(/--only/)
    expect(committed()).toEqual(before)
  })

  it('refuses a template the registry does not hold, and lists the ones it does', () => {
    const before = committed()
    let message = ''
    try {
      optionsFor(['--template', 'no-such-feel', '--seed', '7', '--out', '/tmp/audition-y'])
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    expect(message).toContain('no-such-feel')
    for (const id of Object.keys(TEMPLATES)) expect(message).toContain(id)
    expect(committed()).toEqual(before)
  })

  it('refuses a seed that is not a non-negative integer', () => {
    const before = committed()
    for (const seed of ['abc', '-1', '1.5']) {
      expect(() =>
        optionsFor(['--template', 'shuffle', '--seed', seed, '--out', '/tmp/audition-y']),
      ).toThrow(new RegExp(`--seed[^]*${seed.replace('.', '\\.')}`))
    }
    expect(committed()).toEqual(before)
  })

  it('refuses --template with no --seed, and --seed with no --template', () => {
    const before = committed()
    expect(() => optionsFor(['--template', 'shuffle', '--out', '/tmp/audition-y'])).toThrow(/--seed/)
    expect(() => optionsFor(['--seed', '7', '--out', '/tmp/audition-y'])).toThrow(/--template/)
    expect(committed()).toEqual(before)
  })

  it('leaves the no-flag invocation exactly as it was', () => {
    const options = optionsFrom(parseArgs([]))
    expect(Object.keys(options)).toEqual(['encode'])
    expect(parseArgs([])).toEqual({ only: [], seeds: [], manifestOnly: false })
  })

  it('renders an unminted groove into a scratch tree and touches nothing in the repo', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audition-template-'))
    const before = committed()
    const realMp3Before = sha256File(REAL_MP3)

    const { entries } = await generate({
      ...optionsFrom(parseArgs(['--template', 'shuffle', '--seed', '7', '--out', dir])),
      pack: placeholderPack(),
    })

    expect(entries.map((e) => e.id)).toEqual(['audition-shuffle-7'])
    expect(existsSync(join(dir, 'audition-shuffle-7.mp3'))).toBe(true)
    expect(existsSync(join(dir, 'grooves.generated.ts'))).toBe(true)
    expect(existsSync(join(dir, 'grooves.lock.json'))).toBe(true)

    expect(committed()).toEqual(before)
    expect(sha256File(REAL_MP3)).toBe(realMp3Before)
    expect(existsSync(join(DEFAULT_OUT_DIR, 'audition-shuffle-7.mp3'))).toBe(false)
  }, RENDER_TIMEOUT_MS)
})
