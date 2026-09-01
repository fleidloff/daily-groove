import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { rmsDbfs } from './level.ts'
import { buildEvents } from './events.ts'
import { mixTracks, PEAK_CEILING, SEAM_THRESHOLD, truePeak } from './mix.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import { loadPack } from './pack.ts'
import { fileURLToPath } from 'node:url'
import { renderVoices } from './voices.ts'
import { gateCandidate, LOUDNESS_CEILING_DB, LOUDNESS_FLOOR_DB } from './gate.ts'
import { offScalePitches } from './theory/pitches.ts'
import { pitchesOf } from './theory/scales.ts'
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
/**
 * The committed sample pack, not the synthesized stand-in.
 *
 * `goodCandidate` claims to be "a real render of a catalogue groove", and the
 * seam check is calibrated for real samples — a threshold of 0.02 against a
 * ceiling of 0.891. `placeholderPack`'s pitched voice is a 0.9-second sine that
 * is still sounding at a quarter of full scale when a four-pass loop ends, so
 * it fails that threshold (0.07) on events the real pack renders cleanly
 * (0.004). The fixture is a fine stand-in for "does the renderer place events
 * where it says", which is what the other tests here use it for; it is not one
 * for "does this master loop without a click".
 */
const realPack = await loadPack(fileURLToPath(new URL('./samples', import.meta.url)))

function goodCandidate(): Candidate {
  const spec = readCatalogue()[0]
  const template = templateById(spec.template)
  const { events, music, harmony } = buildEvents(spec, template)
  // `loopBars`, not `bars`: a groove is several passes of the four-bar figure,
  // and the buffer is as long as what was rendered.
  const tracks = renderVoices(events, realPack, SAMPLE_RATE, {
    id: spec.id,
    bars: music.loopBars,
    bpm: music.bpm,
    passes: music.loopBars / music.bars,
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

/**
 * Ten whole cycles across the buffer, so the last sample sits next to the first.
 *
 * The amplitude is 0.084 rather than 0.5 because the gate now checks integrated
 * loudness too: a sine at 0.5 measures -9 dBFS, five times louder than any real
 * groove, and would fail a check this fixture exists to have nothing to do with.
 * At 0.084 it sits mid-band. Its shape - whole cycles, ends meeting - is the
 * property every test using it actually asserts, and that is unchanged.
 */
const CLEAN_LOOP = pcmOf((i, n) => 0.084 * Math.sin((2 * Math.PI * 10 * i) / n))

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
    // The real pack, for the same reason `goodCandidate` uses it: this asserts
    // the gate accepts a master the mix actually produces, and the synthesized
    // stand-in's sustained pitched voice fails the seam check on its own.
    const spec = readCatalogue()[0]
    const template = templateById(spec.template)
    const { events, music, harmony } = buildEvents(spec, template)
    const tracks = renderVoices(events, realPack, 44100, {
      id: spec.id,
      bars: music.loopBars,
      bpm: music.bpm,
      passes: music.loopBars / music.bars,
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

// Feature 9, Epic 4, Steps C1–C3 — R9, R10, R10a, AC10, AC11, AC11a.
//
// `checkHarmony` validates the harmony OBJECT and never reads a `NoteEvent`.
// These are the tests that the gate now reads the events too.
describe('the pitch check — R9, R10, AC10, AC11', () => {
  /**
   * The good candidate with one bass note the scale does not contain, and the
   * pitch that was put there.
   *
   * The offending pitch is returned rather than searched for afterwards. A
   * search — "the event whose midi is not among the originals" — finds nothing
   * the moment the altered pitch happens to coincide with a note the groove
   * already plays somewhere else, which is a property of the catalogue rather
   * than of the thing under test.
   */
  function withOffScaleBass(): { candidate: Candidate; midi: number } {
    const scale = new Set(pitchesOf(GOOD.music.root, GOOD.music.flavour))
    const bass = GOOD.events.find((e) => e.voice === 'bass' && e.midi !== undefined)
    expect(bass, 'the fixture groove has no bass').toBeDefined()

    // A semitone up from a chord tone, mid-bar: not in the scale, and — because
    // it is the FIRST bass event of the loop — nowhere near a bar's last
    // off-beat, so the approach-note exception cannot admit it.
    let midi = bass!.midi! + 1
    while (scale.has(midi % 12)) midi += 1

    const events = GOOD.events.map((e) => (e === bass ? { ...e, midi } : e))
    return { candidate: { ...GOOD, events }, midi }
  }

  it('rejects a groove whose events contradict its stated scale, naming the pitch check', () => {
    const failure = gateCandidate(withOffScaleBass().candidate)
    expect(failure?.check).toBe('pitch')
  })

  it('names the offending MIDI value in the failure’s detail', () => {
    const { candidate, midi } = withOffScaleBass()
    const failure = gateCandidate(candidate)
    expect(failure?.detail).toContain(String(midi))
  })

  it('reads the events, not only the harmony object — the harmony is untouched', () => {
    const { candidate } = withOffScaleBass()
    // Same music, same harmony as the candidate the gate accepts: only the
    // events differ, so nothing but an event-level check can catch this.
    expect(candidate.music).toBe(GOOD.music)
    expect(candidate.harmony).toBe(GOOD.harmony)
    expect(gateCandidate(GOOD)).toBeNull()
    expect(gateCandidate(candidate)?.check).toBe('pitch')
  })

  it('runs between the harmony and density checks', () => {
    // Harmony first: a candidate broken in both ways reports the harmony.
    const both = { ...withOffScaleBass().candidate, music: { ...GOOD.music, chord: 'B♭dim7' } }
    expect(gateCandidate(both)?.check).toBe('harmony')

    // Density after: a candidate broken in both ways reports the pitch.
    const pitchAndDensity = {
      ...withOffScaleBass().candidate,
      template: {
        ...GOOD.template,
        density: { minPerBar: 1000, maxPerBar: 2000 },
      },
    }
    expect(gateCandidate(pitchAndDensity)?.check).toBe('pitch')
  })

  it('rejects an off-scale COMP note too — the exception is the bass’s alone', () => {
    const scale = new Set(pitchesOf(GOOD.music.root, GOOD.music.flavour))
    const comp = GOOD.events.find((e) => e.voice === 'comp' && e.midi !== undefined)
    expect(comp, 'the fixture groove has no comp').toBeDefined()
    let midi = comp!.midi! + 1
    while (scale.has(midi % 12)) midi += 1
    const events = GOOD.events.map((e) => (e === comp ? { ...e, midi } : e))
    expect(gateCandidate({ ...GOOD, events })?.check).toBe('pitch')
  })

  // R10a, AC11a — a hard failure from the moment it lands, with no warning
  // period and no grandfathered entries. This sweep is the proof that today's
  // catalogue was already honest.
  it('accepts every groove in the catalogue', () => {
    const specs = readCatalogue()
    expect(specs.length).toBeGreaterThan(0)

    for (const spec of specs) {
      const template = templateById(spec.template)
      const { events, music, harmony } = buildEvents(spec, template)
      expect(
        offScalePitches(events, music, harmony),
        `${spec.id} plays a pitch outside ${music.scale}`,
      ).toEqual([])
      // And through the gate itself, on a buffer that passes the audio checks.
      const failure = gateCandidate({ pcm: GOOD.pcm, events, music, harmony, template })
      expect(failure?.check, `${spec.id}: ${failure?.detail ?? ''}`).not.toBe('pitch')
    }
  })
})

describe('the loudness check', () => {
  /**
   * A real render, scaled to a chosen RMS.
   *
   * Built from `GOOD.pcm` rather than from synthesised noise on purpose: every
   * other property the gate checks - it wraps at the seam, it is not silent, its
   * events match its density - stays exactly as true as it was, so level is the
   * only variable and a failure can only mean the loudness check fired.
   */
  function quieterBy(db: number): Pcm {
    const scale = 10 ** (-db / 20)
    return {
      sampleRate: GOOD.pcm.sampleRate,
      left: GOOD.pcm.left.map((v) => v * scale),
      right: GOOD.pcm.right.map((v) => v * scale),
    }
  }

  /**
   * The same groove squashed: louder in RMS, still under the peak ceiling.
   *
   * It has to be built by saturation rather than by turning it up, and that is
   * the whole argument for this check in one fixture. Every groove leaves the
   * mix normalised to `PEAK_CEILING`, so scaling one up only clips it — the only
   * way to raise its integrated level is to change its crest factor. Which is
   * exactly the mis-mix peak cannot see and this check can.
   */
  function squashed(): Pcm {
    const drive = 12
    const shape = (v: number) => Math.tanh(v * drive)
    const left = GOOD.pcm.left.map(shape)
    const right = GOOD.pcm.right.map(shape)
    let peak = 0
    for (let i = 0; i < left.length; i += 1) {
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
    }
    // Normalised against the stored peak, but the gate measures *true* peak with
    // 4x oversampling, which reads higher on a saturated signal — hence the
    // margin rather than sitting just under the ceiling.
    const scale = (PEAK_CEILING * 0.7) / peak
    return {
      sampleRate: GOOD.pcm.sampleRate,
      left: left.map((v) => v * scale),
      right: right.map((v) => v * scale),
    }
  }

  it('fails a groove that is too quiet, naming the measure and the band', () => {
    const failure = gateCandidate({ ...GOOD, pcm: quieterBy(12) })
    expect(failure?.check).toBe('loudness')
    expect(failure?.detail).toMatch(/dBFS RMS/)
    expect(failure?.detail).toContain(String(LOUDNESS_FLOOR_DB))
  })

  it('fails a groove that is too loud while still under the peak ceiling', () => {
    // The case peak cannot catch. Every groove is normalised to PEAK_CEILING, so
    // peak is the one quantity already equal across the catalogue; a mix far too
    // dense passes checkPeak and still sounds wrong beside its neighbours.
    const pcm = squashed()
    expect(truePeak(pcm)).toBeLessThan(PEAK_CEILING)
    expect(rmsDbfs(pcm)).toBeGreaterThan(LOUDNESS_CEILING_DB)
    expect(gateCandidate({ ...GOOD, pcm })?.check).toBe('loudness')
  })

  it('passes a groove inside the band', () => {
    // The committed render itself, unmodified: it is what the band is for.
    expect(rmsDbfs(GOOD.pcm)).toBeGreaterThan(LOUDNESS_FLOOR_DB)
    expect(rmsDbfs(GOOD.pcm)).toBeLessThan(LOUDNESS_CEILING_DB)
    expect(gateCandidate(GOOD)).toBeNull()
  })

  it('reports the worse fault when a groove both clips and sits off-level', () => {
    const pcm = squashed()
    pcm.left[10] = 1.4
    pcm.right[10] = 1.4
    expect(gateCandidate({ ...GOOD, pcm })?.check).toBe('peak')
  })

  it('accepts every feel as committed', () => {
    // The band is a guard against a gross mis-level, not a mastering tolerance:
    // the six feels span about five decibels and closing that needs an ear.
    for (const template of allTemplates()) {
      const spec = readCatalogue().find((g) => g.template === template.id)!
      const { events, music } = buildEvents(spec, template)
      const tracks = renderVoices(events, realPack, SAMPLE_RATE, {
        id: spec.id,
        bars: music.loopBars,
        bpm: music.bpm,
        passes: music.loopBars / music.bars,
        overhangBars: OVERHANG_BARS,
      })
      const pcm = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
      const level = rmsDbfs(pcm)
      expect(level, `${template.id} measured ${level.toFixed(1)} dBFS`).toBeGreaterThan(
        LOUDNESS_FLOOR_DB,
      )
      expect(level, `${template.id} measured ${level.toFixed(1)} dBFS`).toBeLessThan(
        LOUDNESS_CEILING_DB,
      )
    }
  })
})
