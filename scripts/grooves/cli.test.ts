import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { readLock, sha256File, writeLock } from './lock.ts'
import { decodeAudioFile } from './decode.ts'
import { buildEvents } from './events.ts'
import { mixTracks, PEAK_CEILING, SEAM_THRESHOLD, truePeak } from './mix.ts'
import { loadPack } from './pack.ts'
import { templateById } from './templates/index.ts'
import { renderVoices } from './voices.ts'
import { OVERHANG_BARS, SAMPLE_RATE } from './cli.ts'
import { DEFAULT_MANIFEST_PATH, DEFAULT_PACK_DIR, displayFlavour, generate, toGroove } from './cli.ts'
import { FLAVOURS } from './theory/scales.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { GrooveSpec } from './types.ts'

const REAL_LOCK = join(process.cwd(), 'scripts', 'grooves', 'grooves.lock.json')
/** A committed mp3, used where a test needs a file with a real head delay. */
const REAL_MP3 = join(process.cwd(), 'public', 'grooves', 'groove-01.mp3')

const SPECS: GrooveSpec[] = [
  { id: 'groove-01', uuid: '20b80c61-ed92-4203-8451-b988b09ad8c2', template: 'straight-funk', seed: 1 },
  { id: 'groove-02', uuid: 'eaaa0108-1bd4-4472-aee7-b5726b5b89ad', template: 'straight-funk', seed: 2 },
]

function tempRun() {
  const dir = mkdtempSync(join(tmpdir(), 'grooves-'))
  // Every path generate() writes to must land in the temp dir. Miss one — the
  // lock especially — and the tests silently overwrite the committed artifacts.
  return {
    catalogue: SPECS,
    pack: placeholderPack(),
    outDir: join(dir, 'audio'),
    manifestPath: join(dir, 'grooves.generated.ts'),
    cataloguePath: join(dir, 'catalogue.json'),
    lockPath: join(dir, 'grooves.lock.json'),
  }
}

/**
 * A render is not a unit of work you can do in five seconds any more.
 *
 * Every candidate now carries per-pass humanization, a tempo drift, note-offs, a
 * hi-hat choke, a Schroeder reverb and a fill, over a catalogue four times the
 * length it was — and these tests shell out to the real CLI. Vitest's 5 s
 * default was written against a much lighter pipeline; under parallel load these
 * time out and read as flaky when nothing is flaky but the clock.
 */
const RENDER_TIMEOUT_MS = 60_000

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
    // AC8: the app reads the loop length out of the module, so it has to be in
    // the text, not only on the in-memory entry.
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
      // Feature 12, Epic 1 — R1, R5. Copied from the spec, never minted here:
      // that is what keeps two runs of `generate` byte-identical.
      expect(e.uuid, `${e.id} carries no uuid`).toBe(
        SPECS.find((spec) => spec.id === e.id)?.uuid,
      )
      expect(e.bars).toBe(4)
      // Feature 9, Step C2 — R7, AC8. The figure is always four bars; the file
      // is whole passes of it, so the entry states both and the second is a
      // multiple of the first.
      expect(e.loopBars, `${e.id} states no loop length`).toBeGreaterThanOrEqual(e.bars)
      expect(e.loopBars! % e.bars, `${e.id} is not whole passes`).toBe(0)
      expect(e.bpm).toBeGreaterThan(40)
      expect(e.name.length).toBeGreaterThan(0)
      expect(e.scale.startsWith(e.root)).toBe(true)
      expect(e.scale.toLowerCase()).toContain(e.flavour.toLowerCase())
      expect(e.chord.length).toBeGreaterThan(0)
      expect(e.progression.length).toBeGreaterThan(0)
      // Step E4: measured from the mp3 this run just encoded, not assumed.
      expect(e.headDelaySeconds).toBeGreaterThan(0)
      expect(e.headDelaySeconds).toBeCloseTo(0.025057, 6)
    }
  })

  // Step E5: the manifest can be re-rendered without re-encoding a single
  // groove. Encoders differ between ffmpeg builds, so re-encoding to pick up a
  // metadata change would rewrite audio for reasons unrelated to the music.
  it('re-renders the manifest and the lock from existing audio, writing no mp3', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    mkdirSync(opts.outDir, { recursive: true })
    for (const spec of SPECS) copyFileSync(REAL_MP3, join(opts.outDir, `${spec.id}.mp3`))
    const before = Object.fromEntries(
      SPECS.map((s) => [s.id, readFileSync(join(opts.outDir, `${s.id}.mp3`))]),
    )

    const { entries } = await generate({ ...opts, encode: false })

    // Not one byte of audio was written.
    for (const spec of SPECS) {
      expect(
        readFileSync(join(opts.outDir, `${spec.id}.mp3`)).equals(before[spec.id]),
        `${spec.id}.mp3 was re-encoded`,
      ).toBe(true)
    }
    expect(readdirSync(opts.outDir).filter((f) => f.endsWith('.mp3'))).toHaveLength(SPECS.length)

    // The manifest was rendered, carrying the delay measured from those files.
    const manifest = readFileSync(opts.manifestPath, 'utf8')
    expect(manifest).toContain('export const GROOVES')
    for (const e of entries) expect(e.headDelaySeconds).toBeCloseTo(0.025057, 6)
    expect(manifest).toMatch(/^ {4}headDelaySeconds: 0\.025057,$/m)

    // And the lock was written from the files already on disk.
    const lock = readLock(opts.lockPath)
    expect(lock).not.toBeNull()
    expect(lock!.grooves.map((g) => g.id)).toEqual(SPECS.map((s) => s.id))
    for (const entry of lock!.grooves) {
      expect(entry.sha256).toBe(sha256File(join(opts.outDir, `${entry.id}.mp3`)))
    }
  })

  // Feature-10, Step B5a — R23. The notes and the grooves are rendered by two
  // commands into one lock. `npm run grooves` has rendered no note and cannot
  // vouch for one, so it must carry through what `npm run notes` recorded
  // rather than overwrite the file with what it happens to know.
  it('preserves the note fields another command recorded in the lock', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    mkdirSync(opts.outDir, { recursive: true })
    for (const spec of SPECS) copyFileSync(REAL_MP3, join(opts.outDir, `${spec.id}.mp3`))

    // A lock as `npm run notes` would leave it: the note family filled in, the
    // groove family whatever was there before.
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
    // ...while the groove family is the one this run actually rendered.
    expect(after.grooves.map((g) => g.id)).toEqual(SPECS.map((s) => s.id))
    expect(after.catalogueSha256).toBe(sha256File(opts.cataloguePath))
  }, RENDER_TIMEOUT_MS)

  it('renders identical PCM when run twice — determinism is asserted here, not on the mp3', async () => {
    const a = await generate({ ...tempRun(), encode: false })
    const b = await generate({ ...tempRun(), encode: false })

    expect(a.entries).toEqual(b.entries)
    // Feature-12, Epic 1, Step A5 — R2, R5, AC2. The uuid is input, not output:
    // it is copied out of the catalogue, so two runs agree on it. If the
    // renderer ever minted one, this is the assertion that would catch it —
    // `toEqual` above would too, but only by accident, and only until someone
    // narrowed it.
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

  // Feature 9, Step C2 — R15, AC15. What is rendered is the whole loop, not the
  // four-bar figure it repeats: the pipeline hands the renderers `loopBars`, so
  // the audio is as long as the entry says the loop is.
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
  // Step I3: what ships must come from the real CC0 pack, never the placeholder.
  it('defaults to the real sample pack, not the placeholder', () => {
    expect(DEFAULT_PACK_DIR.endsWith('samples')).toBe(true)
    expect(existsSync(join(DEFAULT_PACK_DIR, 'pack.json'))).toBe(true)
    expect(existsSync(join(DEFAULT_PACK_DIR, 'provenance.json'))).toBe(true)
  })

  // Epic 2, Step B3: generated data lives in the feature's data/ folder, never
  // in lib/. The generator is the one place that names where the manifest lands.
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

// Step E4: the entry carries the number it was measured with, untouched.
describe('toGroove', () => {
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
    } as const
    expect(toGroove(SPECS[0], music, 0.025057).headDelaySeconds).toBe(0.025057)
    // A different file, a different number: nothing here is shared.
    expect(toGroove(SPECS[1], music, 0.031111).headDelaySeconds).toBe(0.031111)
  })

  // Feature-12, Epic 1, Step A5 — R1, R4, AC1. The entry carries the catalogue's
  // uuid, byte for byte. `toGroove` is the one place the field crosses from the
  // generator's input to the app's contract, so it is the one place that could
  // silently substitute a fresh one.
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
    } as const
    expect(toGroove(SPECS[0], music, 0).uuid).toBe(SPECS[0].uuid)
    // A different groove, a different uuid: nothing here is shared or derived.
    expect(toGroove(SPECS[1], music, 0).uuid).toBe(SPECS[1].uuid)
    expect(toGroove(SPECS[0], music, 0).uuid).not.toBe(SPECS[1].uuid)
  })

  // Feature 9, Step C2 — R7, AC8. The figure and the file are two numbers, and
  // the entry carries both: `bars` is what a player counts, `loopBars` is what
  // the mp3 actually contains.
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
    } as const
    const entry = toGroove(SPECS[0], music, 0.025057)
    expect(entry.bars).toBe(4)
    expect(entry.loopBars).toBe(8)
    // A longer feel is a bigger number on the same entry shape; nothing here is
    // derived from a constant.
    expect(toGroove(SPECS[0], { ...music, loopBars: 16 }, 0.025057).loopBars).toBe(16)
  })
})

describe('displayFlavour', () => {
  it('title-cases the generator flavour into the app spelling', () => {
    expect(displayFlavour('dorian')).toBe('Dorian')
    expect(displayFlavour('harmonic-minor')).toBe('Harmonic minor')
    expect(displayFlavour('blues')).toBe('Blues')
  })

  // Epic 4, AC3 — the vocabulary the app is handed is modal end to end.
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
    }, 0.025057)
    // The app's parseScale() splits on the first space and title-cases the rest.
    const rest = groove.scale.slice(groove.scale.indexOf(' ') + 1)
    expect(groove.flavour).toBe(rest.charAt(0).toUpperCase() + rest.slice(1))
  })
})

// Step I2 — everything the finished pipeline must be true of, asserted on one
// render through the real pack rather than the placeholder.
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

// AC10 — the committed mp3s are what actually ship, so assert on them.
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
