import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { decodeAudioFile } from './decode.ts'
import { buildEvents } from './events.ts'
import { mixTracks, PEAK_CEILING, SEAM_THRESHOLD, truePeak } from './mix.ts'
import { loadPack } from './pack.ts'
import { templateById } from './templates/index.ts'
import { renderVoices } from './voices.ts'
import { OVERHANG_BARS, SAMPLE_RATE } from './cli.ts'
import { DEFAULT_MANIFEST_PATH, DEFAULT_PACK_DIR, displayFlavour, generate, toGroove } from './cli.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { GrooveSpec } from './types.ts'

const REAL_LOCK = join(process.cwd(), 'scripts', 'grooves', 'grooves.lock.json')

const SPECS: GrooveSpec[] = [
  { id: 'groove-01', template: 'straight-funk', seed: 1 },
  { id: 'groove-02', template: 'straight-funk', seed: 2 },
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

describe('generate', () => {
  it('writes every artifact inside the run it was given, and nothing outside it', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    const before = readFileSync(REAL_LOCK, 'utf8')
    await generate(opts)
    expect(existsSync(opts.lockPath)).toBe(true)
    expect(readFileSync(REAL_LOCK, 'utf8'), 'a test run rewrote the committed lock').toBe(before)
  })

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
  })

  it('describes each groove with all ten fields', async () => {
    const opts = tempRun()
    writeFileSync(opts.cataloguePath, JSON.stringify(SPECS))
    const { entries } = await generate(opts)
    for (const e of entries) {
      expect(e.audioSrc).toBe(`/grooves/${e.id}.mp3`)
      expect(e.bars).toBe(4)
      expect(e.bpm).toBeGreaterThan(40)
      expect(e.name.length).toBeGreaterThan(0)
      expect(e.scale.startsWith(e.root)).toBe(true)
      expect(e.scale.toLowerCase()).toContain(e.flavour.toLowerCase())
      expect(e.chord.length).toBeGreaterThan(0)
      expect(e.progression.length).toBeGreaterThan(0)
    }
  })

  it('renders identical PCM when run twice — determinism is asserted here, not on the mp3', async () => {
    const a = await generate({ ...tempRun(), encode: false })
    const b = await generate({ ...tempRun(), encode: false })

    expect(a.entries).toEqual(b.entries)
    for (const spec of SPECS) {
      const left = a.pcm.get(spec.id)!
      const right = b.pcm.get(spec.id)!
      expect(left.sampleRate).toBe(right.sampleRate)
      expect(Array.from(left.left)).toEqual(Array.from(right.left))
      expect(Array.from(left.right)).toEqual(Array.from(right.right))
    }
  })

  it('renders a groove of exactly four bars at its stated tempo', async () => {
    const { entries, pcm } = await generate({ ...tempRun(), encode: false })
    for (const e of entries) {
      const buffer = pcm.get(e.id)!
      const expectedFrames = Math.ceil((60 / e.bpm) * 4 * e.bars * buffer.sampleRate)
      expect(Math.abs(buffer.left.length - expectedFrames)).toBeLessThanOrEqual(1)
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

describe('displayFlavour', () => {
  it('title-cases the generator flavour into the app spelling', () => {
    expect(displayFlavour('dorian')).toBe('Dorian')
    expect(displayFlavour('harmonic-minor')).toBe('Harmonic minor')
    expect(displayFlavour('blues')).toBe('Blues')
  })

  it('agrees with what the app derives from the scale string', () => {
    const groove = toGroove(SPECS[0], {
      bpm: 96,
      bars: 4,
      root: 'A',
      flavour: 'harmonic-minor',
      scale: 'A harmonic minor',
      chord: 'AmMaj7',
      progression: 'Am–Dm–E7',
    })
    // The app's parseScale() splits on the first space and title-cases the rest.
    const rest = groove.scale.slice(groove.scale.indexOf(' ') + 1)
    expect(groove.flavour).toBe(rest.charAt(0).toUpperCase() + rest.slice(1))
  })
})

// Step I2 — everything the finished pipeline must be true of, asserted on one
// render through the real pack rather than the placeholder.
describe('the finished pipeline, through the real pack', () => {
  it('renders a loop that is exactly four bars, peaks on the ceiling, and closes its seam', async () => {
    const pack = await loadPack(DEFAULT_PACK_DIR)
    for (const spec of readCatalogue().slice(0, 3)) {
      const template = templateById(spec.template)
      const { events, music } = buildEvents(spec, template)
      const tracks = renderVoices(events, pack, SAMPLE_RATE, {
        id: spec.id,
        bars: music.bars,
        bpm: music.bpm,
        overhangBars: OVERHANG_BARS,
      })
      const master = mixTracks(tracks, template, { loopBars: music.bars, bpm: music.bpm })

      const expected = Math.round((60 / music.bpm) * 4 * music.bars * SAMPLE_RATE)
      expect(Math.abs(master.left.length - expected), `${spec.id} is not 4 bars`).toBeLessThanOrEqual(1)

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
