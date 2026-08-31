import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { mixTracks, PEAK_CEILING, SEAM_THRESHOLD } from './mix.ts'
import { templateById } from './templates/index.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import { renderVoices } from './voices.ts'
import { gateCandidate } from './gate.ts'
import type { FeelTemplate, MusicMeta, NoteEvent, Pcm } from './types.ts'
import type { Harmony } from './theory/harmony.ts'

const SAMPLE_RATE = 44100
const OVERHANG_BARS = 1

type Candidate = {
  pcm: Pcm
  events: NoteEvent[]
  music: MusicMeta
  harmony: Harmony
  template: FeelTemplate
}

/**
 * A real, fully rendered groove: the catalogue's first spec through the same
 * stages the pipeline runs, on the placeholder pack so no ffmpeg or sample pack
 * is needed. This is the candidate the gate must ACCEPT — every rejection test
 * below is this one with exactly one thing broken, so a gate that fails
 * everything cannot pass this suite.
 */
function goodCandidate(): Candidate {
  const spec = readCatalogue()[0]
  const template = templateById(spec.template)
  const { events, music, harmony } = buildEvents(spec, template)
  // `loopBars`, not `bars`: a groove is several passes of the four-bar figure,
  // and the buffer is as long as what was rendered.
  const tracks = renderVoices(events, placeholderPack(), SAMPLE_RATE, {
    id: spec.id,
    bars: music.loopBars,
    bpm: music.bpm,
    overhangBars: OVERHANG_BARS,
  })
  const pcm = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
  return { pcm, events, music, harmony, template }
}

const GOOD = goodCandidate()

function pcmOf(fill: (i: number, n: number) => number, frames = 4410): Pcm {
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    left[i] = fill(i, frames)
    right[i] = fill(i, frames)
  }
  return { sampleRate: SAMPLE_RATE, left, right }
}

/** Constant 1.5: well past the ceiling and past full scale. */
const CLIPPING = pcmOf(() => 1.5)

/** Digital silence. */
const SILENT = pcmOf(() => 0)

/** A ramp from 0 to 0.5: audible, unclipped, and its ends do not meet. */
const DISCONTINUOUS = pcmOf((i, n) => (0.5 * i) / n)

/** Ten whole cycles across the buffer, so the last sample sits next to the first. */
const CLEAN_LOOP = pcmOf((i, n) => 0.5 * Math.sin((2 * Math.PI * 10 * i) / n))

/** More events than the template's ceiling allows over the whole rendered loop. */
function tooManyEvents(): NoteEvent[] {
  return eventsOf((GOOD.template.density.maxPerBar + 10) * GOOD.music.loopBars)
}

function eventsOf(count: number): NoteEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    voice: 'kick' as const,
    timeSec: i * 0.01,
    durationSec: 0.1,
    velocity: 0.8,
  }))
}

describe('gateCandidate', () => {
  it('accepts a real render of a catalogue groove', () => {
    expect(gateCandidate(GOOD)).toBeNull()
  })

  // Step A1 — R5, R6, AC4
  describe('peak and silence', () => {
    it('rejects a buffer that clips, naming the peak check', () => {
      const failure = gateCandidate({ ...GOOD, pcm: CLIPPING })
      expect(failure?.check).toBe('peak')
    })

    it('rejects a buffer over the ceiling but under full scale', () => {
      const failure = gateCandidate({ ...GOOD, pcm: pcmOf(() => (PEAK_CEILING + 1) / 2) })
      expect(failure?.check).toBe('peak')
    })

    it('rejects a silent buffer, naming the silence check', () => {
      expect(gateCandidate({ ...GOOD, pcm: SILENT })?.check).toBe('silence')
    })

    it('rejects a near-silent buffer', () => {
      const failure = gateCandidate({ ...GOOD, pcm: pcmOf(() => 0.0005) })
      expect(failure?.check).toBe('silence')
    })

    it('accepts a buffer that sits under the ceiling and is audible', () => {
      expect(gateCandidate({ ...GOOD, pcm: CLEAN_LOOP })).toBeNull()
    })

    it('accepts a buffer sitting exactly on the ceiling, as the mix leaves it', () => {
      expect(gateCandidate({ ...GOOD, pcm: GOOD.pcm })).toBeNull()
    })
  })

  // Step A2 — R5, R6, AC4
  describe('the loop seam', () => {
    it('rejects a buffer whose ends do not meet, naming the seam check', () => {
      expect(gateCandidate({ ...GOOD, pcm: DISCONTINUOUS })?.check).toBe('seam')
    })

    it('rejects a discontinuity on the right channel alone', () => {
      const pcm = {
        sampleRate: SAMPLE_RATE,
        left: CLEAN_LOOP.left,
        right: DISCONTINUOUS.right,
      }
      expect(gateCandidate({ ...GOOD, pcm })?.check).toBe('seam')
    })

    it('accepts a buffer that wraps cleanly', () => {
      const seamL = Math.abs(CLEAN_LOOP.left[CLEAN_LOOP.left.length - 1] - CLEAN_LOOP.left[0])
      expect(seamL, 'fixture is not actually clean').toBeLessThan(SEAM_THRESHOLD)
      expect(gateCandidate({ ...GOOD, pcm: CLEAN_LOOP })).toBeNull()
    })

    it('accepts the real render, whose seam the mix closes by overhang', () => {
      expect(gateCandidate(GOOD)).toBeNull()
    })
  })

  // Step A3 — R5, R6, AC4
  describe('harmony', () => {
    it('rejects a candidate whose chord name is not what its harmony plays', () => {
      const music = { ...GOOD.music, chord: 'B♭dim7' }
      expect(gateCandidate({ ...GOOD, music })?.check).toBe('harmony')
    })

    it('rejects a candidate whose progression names drifted from its degrees', () => {
      const harmony: Harmony = { ...GOOD.harmony, progressionDegrees: [] }
      expect(gateCandidate({ ...GOOD, harmony })?.check).toBe('harmony')
    })

    it('rejects a chord that is outside the flavour it claims', () => {
      // A dominant seventh on the tonic is not diatonic to any of the modes.
      const harmony: Harmony = {
        ...GOOD.harmony,
        chordName: 'C7',
        chordMidi: [60, 64, 67, 70],
        progressionDegrees: [0],
        progressionName: 'C7',
        progressionMidi: [[60, 64, 67, 70]],
      }
      const music: MusicMeta = {
        ...GOOD.music,
        root: 'C',
        flavour: 'ionian',
        chord: 'C7',
        progression: 'C7',
      }
      expect(gateCandidate({ ...GOOD, music, harmony })?.check).toBe('harmony')
    })

    it('accepts the harmony the generator actually built', () => {
      expect(gateCandidate(GOOD)).toBeNull()
    })
  })

  // Step A4 — R5, R6, AC4
  describe('density', () => {
    it('rejects two events over the whole loop, naming the density check', () => {
      const failure = gateCandidate({ ...GOOD, events: eventsOf(2) })
      expect(failure?.check).toBe('density')
    })

    it('rejects far more events than the template’s ceiling allows', () => {
      const failure = gateCandidate({ ...GOOD, events: tooManyEvents() })
      expect(failure?.check).toBe('density')
    })

    it('rejects a groove with no events at all', () => {
      expect(gateCandidate({ ...GOOD, events: [] })?.check).toBe('density')
    })

    it('reads its bounds from the template, not from a constant', () => {
      const perBar = GOOD.events.length / GOOD.music.loopBars
      const narrow: FeelTemplate = {
        ...GOOD.template,
        density: { minPerBar: perBar + 1, maxPerBar: perBar + 2 },
      }
      expect(gateCandidate({ ...GOOD, template: narrow })?.check).toBe('density')

      const wide: FeelTemplate = {
        ...GOOD.template,
        density: { minPerBar: 0, maxPerBar: perBar + 10 },
      }
      expect(gateCandidate({ ...GOOD, template: wide })).toBeNull()
    })

    // Feature 9, Epic 1, Step B5 — R13, AC13. A groove is now several passes of
    // the four-bar figure, so dividing by the figure would report four times
    // the density that is actually there and reject a perfectly good groove.
    it('measures over the bars rendered, not over the figure — R13, AC13', () => {
      const { minPerBar, maxPerBar } = GOOD.template.density
      const loopBars = 16
      const perBar = Math.round((minPerBar + maxPerBar) / 2)
      const music: MusicMeta = { ...GOOD.music, bars: 4, loopBars }

      expect(
        gateCandidate({
          ...GOOD,
          pcm: CLEAN_LOOP,
          music,
          events: eventsOf(perBar * loopBars),
        }),
        'a mid-density sixteen-bar groove was rejected',
      ).toBeNull()
    })

    it('names the rendered length in a density failure — R13', () => {
      const music: MusicMeta = { ...GOOD.music, bars: 4, loopBars: 16 }
      const failure = gateCandidate({ ...GOOD, pcm: CLEAN_LOOP, music, events: eventsOf(2) })
      expect(failure?.check).toBe('density')
      expect(failure?.detail).toContain('over 16 bars')
    })

    it('accepts a real render, which sits inside its own template bounds', () => {
      const perBar = GOOD.events.length / GOOD.music.loopBars
      expect(perBar).toBeGreaterThanOrEqual(GOOD.template.density.minPerBar)
      expect(perBar).toBeLessThanOrEqual(GOOD.template.density.maxPerBar)
      expect(gateCandidate(GOOD)).toBeNull()
    })
  })

  // Step A5 — R7, AC5
  describe('every rejection says what was measured', () => {
    const rejections: { check: string; candidate: Candidate; detail: RegExp }[] = [
      { check: 'peak', candidate: { ...GOOD, pcm: CLIPPING }, detail: /1\.5/ },
      { check: 'silence', candidate: { ...GOOD, pcm: SILENT }, detail: /0(\.0+)?/ },
      { check: 'seam', candidate: { ...GOOD, pcm: DISCONTINUOUS }, detail: /0\.49|0\.5/ },
      {
        check: 'harmony',
        candidate: { ...GOOD, music: { ...GOOD.music, chord: 'B♭dim7' } },
        detail: /B♭dim7/,
      },
      {
        check: 'density',
        candidate: { ...GOOD, events: eventsOf(2) },
        detail: new RegExp(`2 over ${GOOD.music.loopBars} bars`),
      },
      {
        check: 'density',
        candidate: { ...GOOD, events: tooManyEvents() },
        detail: new RegExp(`over ${GOOD.music.loopBars} bars`),
      },
    ]

    for (const { check, candidate, detail } of rejections) {
      it(`${check} names its check and the value it measured`, () => {
        const failure = gateCandidate(candidate)
        expect(failure, `${check} candidate was accepted`).not.toBeNull()
        expect(failure!.check).toBe(check)
        expect(failure!.check.length).toBeGreaterThan(0)
        expect(failure!.detail.length).toBeGreaterThan(0)
        expect(failure!.detail, `${check} detail states no measured value`).toMatch(detail)
      })
    }

    it('reports a bound alongside the measurement, so the reader knows the target', () => {
      expect(gateCandidate({ ...GOOD, pcm: CLIPPING })!.detail).toContain(String(PEAK_CEILING))
      expect(gateCandidate({ ...GOOD, pcm: DISCONTINUOUS })!.detail).toContain(
        String(SEAM_THRESHOLD),
      )
      const dense = gateCandidate({ ...GOOD, events: tooManyEvents() })!.detail
      expect(dense).toContain(String(GOOD.template.density.maxPerBar))
    })

    it('returns null — not a failure with an empty check — for a good candidate', () => {
      expect(gateCandidate(GOOD)).toBeNull()
    })
  })
})

// Feature 9, Epic 1, Step B4 — R4, AC4. The gate's own fixture is a real,
// fully rendered candidate, which makes it the cheapest place to assert the
// thing the epic exists for: the seventh repeat a listener hears is not the
// same bytes as the first.
describe('a rendered candidate — R4, AC4', () => {
  it('is several passes long, and no two of them are byte-identical', () => {
    const passes = GOOD.music.loopBars / GOOD.music.bars
    expect(passes, 'the fixture is a single-pass groove').toBeGreaterThan(1)

    const frames = Math.floor(GOOD.pcm.left.length / passes)
    expect(frames).toBeGreaterThan(0)

    const digest = (pass: number) => {
      const from = pass * frames
      return Array.from(GOOD.pcm.left.slice(from, from + frames)).join(',')
    }
    const seen = new Set<string>()
    for (let pass = 0; pass < passes; pass++) {
      const bytes = digest(pass)
      expect(seen.has(bytes), `pass ${pass} repeats an earlier pass sample for sample`).toBe(
        false,
      )
      seen.add(bytes)
    }
  })
})

describe('the ceiling comparison', () => {
  // Regression: mixTracks normalises true peak ONTO the ceiling, so a correctly
  // mastered groove measures it exactly. A strict `>` comparison rejected roughly
  // three candidates in five during a real mint — an arithmetic artefact, not a
  // quality signal.
  it('accepts a master sitting exactly on the ceiling', async () => {
    const { readCatalogue } = await import('./catalogue.ts')
    const { buildEvents } = await import('./events.ts')
    const { templateById } = await import('./templates/index.ts')
    const { renderVoices } = await import('./voices.ts')
    const { mixTracks, truePeak, PEAK_CEILING } = await import('./mix.ts')
    const { placeholderPack } = await import('./testing/placeholderPack.ts')

    const spec = readCatalogue()[0]
    const template = templateById(spec.template)
    const { events, music, harmony } = buildEvents(spec, template)
    const tracks = renderVoices(events, placeholderPack(), 44100, {
      id: spec.id,
      bars: music.loopBars,
      bpm: music.bpm,
      overhangBars: 1,
    })
    const pcm = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })

    // The mix really does land on the ceiling — that is the premise of the bug.
    expect(truePeak(pcm)).toBeCloseTo(PEAK_CEILING, 6)
    expect(gateCandidate({ pcm, events, music, harmony, template })).toBeNull()
  })

  it('still rejects a master genuinely over the ceiling', async () => {
    const { readCatalogue } = await import('./catalogue.ts')
    const { buildEvents } = await import('./events.ts')
    const { templateById } = await import('./templates/index.ts')
    const { renderVoices } = await import('./voices.ts')
    const { mixTracks } = await import('./mix.ts')
    const { placeholderPack } = await import('./testing/placeholderPack.ts')

    const spec = readCatalogue()[0]
    const template = templateById(spec.template)
    const { events, music, harmony } = buildEvents(spec, template)
    const tracks = renderVoices(events, placeholderPack(), 44100, {
      id: spec.id,
      bars: music.loopBars,
      bpm: music.bpm,
      overhangBars: 1,
    })
    const base = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
    const hot = {
      sampleRate: base.sampleRate,
      left: base.left.map((v) => v * 1.05) as Float32Array,
      right: base.right.map((v) => v * 1.05) as Float32Array,
    }
    const failure = gateCandidate({ pcm: hot, events, music, harmony, template })
    expect(failure?.check).toBe('peak')
  })
})
