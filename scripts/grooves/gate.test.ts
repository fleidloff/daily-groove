import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { encodeMp3, MP3_BITRATE } from './encode.ts'
import { interleave } from './pcmio.ts'
import { rmsDbfs, voiceLevels } from './level.ts'
import { buildEvents, RIDE_LABEL, RIDE_PATTERNS } from './events.ts'
import { pick, rngFor } from './rng.ts'
import { mixTracks, PEAK_CEILING, SEAM_THRESHOLD, truePeak } from './mix.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { loadPack } from './pack.ts'
import { fileURLToPath } from 'node:url'
import { renderVoices } from './voices.ts'
import { gateCandidate, LOUDNESS_CEILING_DB, LOUDNESS_FLOOR_DB } from './gate.ts'
import { offScalePitches } from './theory/pitches.ts'
import { pitchesOf } from '../../src/lib/theory/scales.ts'
import type { FeelTemplate, MusicMeta, NoteEvent, PackSample, Pcm, SamplePack, VoiceName } from './types.ts'
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

const realPack = await loadPack(fileURLToPath(new URL('./samples', import.meta.url)))

function goodCandidate(): Candidate {
  const spec = readCatalogue()[0]
  const template = templateById(spec.template)
  const { events, music, harmony } = buildEvents(spec, template)
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

const CLIPPING = pcmOf(() => 1.5)

const SILENT = pcmOf(() => 0)

const DISCONTINUOUS = pcmOf((i, n) => (0.5 * i) / n)

const CLEAN_LOOP = pcmOf((i, n) => 0.084 * Math.sin((2 * Math.PI * 10 * i) / n))

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
  it('accepts a master sitting exactly on the ceiling', async () => {
    const { readCatalogue } = await import('./catalogue.ts')
    const { buildEvents } = await import('./events.ts')
    const { templateById } = await import('./templates/index.ts')
    const { renderVoices } = await import('./voices.ts')
    const { mixTracks, truePeak, PEAK_CEILING } = await import('./mix.ts')
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

describe('the pitch check — R9, R10, AC10, AC11', () => {
  function withOffScaleBass(): { candidate: Candidate; midi: number } {
    const scale = new Set(pitchesOf(GOOD.music.root, GOOD.music.flavour))
    const bass = GOOD.events.find((e) => e.voice === 'bass' && e.midi !== undefined)
    expect(bass, 'the fixture groove has no bass').toBeDefined()

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
    expect(candidate.music).toBe(GOOD.music)
    expect(candidate.harmony).toBe(GOOD.harmony)
    expect(gateCandidate(GOOD)).toBeNull()
    expect(gateCandidate(candidate)?.check).toBe('pitch')
  })

  it('runs between the harmony and density checks', () => {
    const both = { ...withOffScaleBass().candidate, music: { ...GOOD.music, chord: 'B♭dim7' } }
    expect(gateCandidate(both)?.check).toBe('harmony')

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
      const failure = gateCandidate({ pcm: GOOD.pcm, events, music, harmony, template })
      expect(failure?.check, `${spec.id}: ${failure?.detail ?? ''}`).not.toBe('pitch')
    }
  })
})

describe('the loudness check', () => {
  function quieterBy(db: number): Pcm {
    const scale = 10 ** (-db / 20)
    return {
      sampleRate: GOOD.pcm.sampleRate,
      left: GOOD.pcm.left.map((v) => v * scale),
      right: GOOD.pcm.right.map((v) => v * scale),
    }
  }

  function squashed(): Pcm {
    const drive = 12
    const shape = (v: number) => Math.tanh(v * drive)
    const left = GOOD.pcm.left.map(shape)
    const right = GOOD.pcm.right.map(shape)
    let peak = 0
    for (let i = 0; i < left.length; i += 1) {
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
    }
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
    const pcm = squashed()
    expect(truePeak(pcm)).toBeLessThan(PEAK_CEILING)
    expect(rmsDbfs(pcm)).toBeGreaterThan(LOUDNESS_CEILING_DB)
    expect(gateCandidate({ ...GOOD, pcm })?.check).toBe('loudness')
  })

  it('passes a groove inside the band', () => {
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

const SHUFFLE_ID = 'groove-07'

describe('the shuffle feel, with a cymbal keeping the time — R22, R23, AC12, AC13', () => {
  function renderShuffle() {
    const spec = readCatalogue().find((g) => g.id === SHUFFLE_ID)!
    const template = templateById(spec.template)
    expect(template.id, 'the fixture groove is not a shuffle').toBe('shuffle')
    const { events, music, harmony } = buildEvents(spec, template)
    const tracks = renderVoices(events, realPack, SAMPLE_RATE, {
      id: spec.id,
      bars: music.loopBars,
      bpm: music.bpm,
      passes: music.loopBars / music.bars,
      overhangBars: OVERHANG_BARS,
    })
    const pcm = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
    return { pcm, events, music, harmony, template, tracks }
  }

  const SHUFFLE = renderShuffle()

  it('passes all seven gate checks — AC12', () => {
    expect(gateCandidate(SHUFFLE)).toBeNull()
  })

  it('sits inside its own density band, ride and foot hat included — AC12', () => {
    const perBar = SHUFFLE.events.length / SHUFFLE.music.loopBars
    expect(perBar).toBeGreaterThanOrEqual(SHUFFLE.template.density.minPerBar)
    expect(perBar).toBeLessThanOrEqual(SHUFFLE.template.density.maxPerBar)
  })

  it('actually renders ride audio, so the gate is not passing on a silent voice', () => {
    const ride = SHUFFLE.tracks.find((t) => t.voice === 'ride')
    expect(ride, 'the shuffle render has no ride track').toBeDefined()
    expect(rmsDbfs(ride!.pcm)).toBeGreaterThan(-90)
  })

  it('puts the ride under the snare and above the hat it replaced — R22', () => {
    const levels = voiceLevels(SHUFFLE.tracks)
    const gain = SHUFFLE.template.gain as Partial<Record<string, number>>
    const post = (voice: string) => levels.get(voice as never)! + (gain[voice] ?? 0)

    expect(post('ride'), 'the ride is louder than the snare').toBeLessThan(post('snare'))
    expect(post('ride'), 'the ride is quieter than the hat it replaced').toBeGreaterThan(
      post('hatClosed'),
    )
  })

  it('renders byte-for-byte the same twice — AC13', () => {
    const again = renderShuffle()
    expect(Array.from(again.pcm.left)).toEqual(Array.from(SHUFFLE.pcm.left))
    expect(Array.from(again.pcm.right)).toEqual(Array.from(SHUFFLE.pcm.right))
  })

  it('holds enough ride alternates that consecutive passes cannot replay one — AC13', () => {
    const strong = 0.78
    const heard = new Set<string>()
    for (let index = 0; index < 3; index += 1) {
      const sample = realPack.get('ride', { velocity: strong, index })
      expect(sample, `the pack returned no ride at index ${index}`).not.toBeNull()
      heard.add(Array.from(sample!.pcm.left.slice(0, 2048)).join(','))
    }
    expect(heard.size, 'the ride replays one file across consecutive passes').toBe(3)
  })
})

const SIGNED_OFF_ENCODER = `ffmpeg 6.0 / libmp3lame 3.100, -b:a ${MP3_BITRATE}`

type SignOff = {
  id: string
  /** sha256 of the interleaved f32 PCM `encodeMp3` is fed — the music and nothing else. */
  pcm: string
  /** sha256 of the encoded file, or null where the groove is deliberately not encoder-pinned. */
  mp3: string | null
  /**
   * The file that was played to a person. Session scratch — these are not in the
   * repo and cannot be opened. Kept as the record of which audition round gave the
   * approval, never quoted back as something to listen to.
   */
  file: string
  /** What that person said about it, in their own words. */
  approval: string
  /** Where those words covered more than this groove, what they covered. */
  scope?: string
  /** What has to move for this render to change; quoted back in the failure. */
  upstream: string
}

// One entry per render a human has heard and approved. A hash moves only after a
// fresh ear has heard the new render — never to make the suite green. That is what
// voidSignOff says, in the failure itself, and it is the point of the whole table.
//
// The table pins one groove per ride figure the catalogue ships, not one per groove
// that was approved. Feature-24 epic 3's migration pass approved eleven renders in a
// single sentence, and those eleven draw five distinct (feel, ride figure) pairs:
//
//   shuffle          [0,2,4,6,8,10,12,14]  groove-08 pinned · 19, 44, 52 approved
//   shuffle          [0,4,6,8,12,14]       groove-07 pinned · 42 approved
//   swung-sixteenth  [0,3,4,8,11,12]       groove-40 pinned
//   swung-sixteenth  [0,4,7,8,12,15]       groove-48 pinned · 34 approved
//   swung-sixteenth  [0,4,8,12,15]         groove-28 pinned · 50 approved
//
// Eleven pins would turn one ride change into eleven simultaneous failures, and a
// wall of red is what teaches people to re-pin in bulk without listening — the one
// thing this table exists to stop. Five fail once per thing that was separately
// approved. The six unpinned renders are approved and recorded in
// specs/features/feature-24/.implement/epic-3-track-e.md; each shares its feel and
// its ride figure with a pinned one, so nothing that could move them moves without a
// failure here. The coverage test below fails if a groove ever ships a figure no
// entry covers.
const SIGN_OFFS: SignOff[] = [
  {
    // Re-pinned 2026-09-05 for epic 2's feathered shuffle: Fred played this render
    // and approved it in the words below. A listening pass, not a measurement. The
    // epic-1 pin it replaces was bc7c5fee…1cb3 / e50363bf…5e09, voided by the
    // feathered kick.
    id: 'groove-07',
    pcm: '68002353111ca91bc829e77127990cff88ef1300e801be319c3b1ccbae57aaaf',
    mp3: '9aa8353349c5cdac68050614f86b938e525769775854ab83c5648114a43f4333',
    file: 'epic2-listen/groove-07.mp3',
    approval: 'it all sounds good',
    scope:
      'Those words were one sentence over all three of epic 2’s renders, not a verdict ' +
      'given on this groove alone. The same message went on to except groove-40 and ' +
      'nothing else — “in groove 40, the ride is too loud. It get’s a bit too much” — so ' +
      'groove-07 is covered without qualification, but by a sentence about three files. ' +
      'Recorded in specs/features/feature-24/.implement/epic-2-signoff.md.',
    upstream:
      'samples/pack.json, the ride or hat pattern pools, RIDE_SUSTAIN_SIXTEENTHS, ' +
      'RIDE_ACCENTS, the shuffle template’s gain, pan or humanize block',
  },
  {
    // Signed off 2026-09-05 by feature-24 epic 3's migration listening pass, in the
    // words below. Pinned because it carries the shuffle's all-eighths ride figure,
    // which nothing had ever pinned: the densest cymbal in the catalogue at 2.75
    // strokes/s, and narrower in dynamic range over the loop (9.0 dB) than the epic-2
    // render that was rejected for being "a bit too much". The pre-listening report
    // named it the single most likely failure of the pass; it came back good.
    // groove-19, groove-44 and groove-52 draw the same figure and are approved
    // without a hash. mp3 is null for the reason given on groove-40; the approved
    // file hashes to
    // 2c38d2d91dc3b20477b796a147f29ac567c7a7bc0e9e48bc46411ee0fb203889 (1 014 430 bytes).
    id: 'groove-08',
    pcm: '1eb966c479b70fa48d679c3160cdb36f85a9f9269ba2ee03ff8293b0fad10dc0',
    mp3: null,
    file: 'epic3-migration/02-groove-08-shuffle-91bpm-Fsharpm7-UNHEARD-densest-ride-in-catalogue.mp3',
    approval: 'listened to all of them. they are all good',
    scope:
      'Those words were one sentence over all thirteen files of epic 3’s migration ' +
      'listening pass — the eleven changed grooves and two unchanged controls — not a ' +
      'verdict given on this groove alone.',
    upstream:
      'samples/pack.json, the ride or hat pattern pools, RIDE_SUSTAIN_SIXTEENTHS, ' +
      'RIDE_ACCENTS, the shuffle template’s gain, pan or humanize block',
  },
  {
    // Signed off 2026-09-05 by epic 3's migration pass, in the words below, and
    // separately accepted in epic 2's round 1 as that round's sixteenth render — the
    // only entry here carrying two independent approvals, which is why it rather than
    // groove-50 anchors this figure. Never pinned before. groove-50 draws the same
    // figure and is approved without a hash. mp3 is null for the reason given on
    // groove-40; the approved file hashes to
    // 82ee344e403152f87d547dda32900a386ff1a36c506d964fee26c0e00dab77ab (855 187 bytes).
    id: 'groove-28',
    pcm: '0f89ea15b064026809d24d80f4c963e447912cd675d600cde9304d8d856a5d8c',
    mp3: null,
    file: 'epic3-migration/11-ANCHOR-groove-28-swung16-108bpm-Amaj7-APPROVED-round1.mp3',
    approval: 'listened to all of them. they are all good',
    scope:
      'Those words were one sentence over all thirteen files of epic 3’s migration ' +
      'listening pass — the eleven changed grooves and two unchanged controls — not a ' +
      'verdict given on this groove alone.',
    upstream:
      'samples/pack.json, RIDE_PATTERNS[16] or the hat punctuation pool, ' +
      'FEATHER_VELOCITY, the swung-sixteenth template’s gain, pan or humanize block',
  },
  {
    // Signed off 2026-09-05: Fred heard six renders of groove-40 and chose cell 5,
    // 5-groove-40-6hit-PROPOSAL.mp3 — the 6-hit RIDE_PATTERNS[16] member that now
    // ships — in the words below. A listening pass, not a measurement. The 8-hit
    // member it replaced was heard first and rejected: "in groove 40, the ride is
    // too loud. It get's a bit too much".
    //
    // mp3 is null on purpose, and this is the reason. The encoded hash is the only
    // assertion in this repo that re-runs the encoder, so it fails on a different
    // ffmpeg or LAME build from byte-identical audio. groove-07 already pins that,
    // with the same encoder and the same invocation, so a second encoded pin fails
    // in exactly the circumstances the first one does and detects nothing it
    // misses — it would double a known false-failure mode for no coverage. The pcm
    // hash is encoder-independent and is the one that carries the music. For the
    // record: the approved file hashes to
    // 5445c891a2fe810af53ed22675dbe7c805a99b1f9418714bac958c20ea259728, and a fresh
    // render of this tree reproduced it byte for byte on 2026-09-05.
    id: 'groove-40',
    pcm: '00d66faaa4d08d241fb1e6646c37c1c7c896fe64b59f738da6dd959ad2a5a4f7',
    mp3: null,
    file: 'epic2-listen-2/5-groove-40-6hit-PROPOSAL.mp3',
    approval: '5 sounds best, go with the proposal',
    upstream:
      'samples/pack.json, RIDE_PATTERNS[16] or the hat punctuation pool, ' +
      'FEATHER_VELOCITY, the swung-sixteenth template’s gain, pan or humanize block',
  },
  {
    // Signed off 2026-09-05 by epic 3's migration pass, in the words below. This entry
    // also closes a gap in the record: groove-34 and groove-48 were played during
    // epic 2 and answered "both sound good", and that verdict was never written into
    // the repo — .verify/epic-2.md recorded this figure as never heard by anyone.
    // Epic 3's pass played both renders again and covers them explicitly, so the
    // record is the sentence below rather than an unrecorded chat message. Pinned
    // rather than groove-34 because it is the fastest sixteenth in the catalogue
    // (114 bpm) and the busier of the two, 2.61 ride strokes/s against 2.48.
    // groove-34 draws the same figure and is approved without a hash. mp3 is null for
    // the reason given on groove-40; the approved file hashes to
    // 5d4df888c35c9b0f185403f29be3290bf989c413c85f7b52bdd1675905dd61bd (810 048 bytes).
    id: 'groove-48',
    pcm: '3ba2a4fae00d66e1e1662d77d6b6f11caeaec64ecfcc69fa97b3ec087630a5cb',
    mp3: null,
    file: 'epic3-migration/04-groove-48-swung16-114bpm-Emaj7-UNRECORDED-fastest-sixteenth.mp3',
    approval: 'listened to all of them. they are all good',
    scope:
      'Those words were one sentence over all thirteen files of epic 3’s migration ' +
      'listening pass — the eleven changed grooves and two unchanged controls — not a ' +
      'verdict given on this groove alone.',
    upstream:
      'samples/pack.json, RIDE_PATTERNS[16] or the hat punctuation pool, ' +
      'FEATHER_VELOCITY, the swung-sixteenth template’s gain, pan or humanize block',
  },
]

function voidSignOff(entry: SignOff): string {
  return [
    `${entry.id} no longer renders the audio a person heard and approved.`,
    `The words it was approved in were “${entry.approval}”.`,
    ...(entry.scope === undefined ? [] : [entry.scope]),
    `Something upstream of it moved — ${entry.upstream}.`,
    'The change may well be an improvement, but the sign-off it invalidates is a human’s ear',
    'and nothing in this repo can re-give it. The approved file was session scratch and is',
    `gone; the render is reproducible from this tree instead — npm run grooves -- --only ${entry.id}`,
    '— so render it, play it, get it approved, and only then re-pin this hash. Do not re-pin',
    'it to make the suite green.',
  ].join('\n')
}

function voidEncoderPin(entry: SignOff): string {
  return [
    voidSignOff(entry),
    '',
    'If the pcm assertion above passed and only this one failed, the music did not move —',
    `the encoder did. This hash was taken with ${SIGNED_OFF_ENCODER}; a different ffmpeg or`,
    'LAME build produces different bytes from identical audio, and re-pinning it to the new',
    'encoder is then the correct fix. Re-pin it for no other reason.',
  ].join('\n')
}

function renderGroove(id: string, pack: SamplePack = realPack) {
  const spec = readCatalogue().find((g) => g.id === id)!
  const template = templateById(spec.template)
  const { events, music, harmony } = buildEvents(spec, template)
  const passes = music.loopBars / music.bars
  const tracks = renderVoices(events, pack, SAMPLE_RATE, {
    id: spec.id,
    bars: music.loopBars,
    bpm: music.bpm,
    passes,
    overhangBars: OVERHANG_BARS,
  })
  const pcm = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
  return { pcm, events, music, harmony, template, tracks, passes }
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function pcmSha256(pcm: Pcm): string {
  const raw = interleave(pcm)
  return sha256(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength))
}

describe('the renders a person signed off — R24, AC16', () => {
  const dir = mkdtempSync(join(tmpdir(), 'groove-signoff-'))

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('still guards every sign-off this repo has been given', () => {
    expect(
      SIGN_OFFS.map((entry) => entry.id),
      'a sign-off was dropped from the table — removing one is the same as re-pinning it blind',
    ).toEqual(['groove-07', 'groove-08', 'groove-28', 'groove-40', 'groove-48'])
    for (const entry of SIGN_OFFS) {
      expect(entry.approval.length, `${entry.id} records no words it was approved in`).toBeGreaterThan(0)
      expect(entry.file.length, `${entry.id} names no file that was played`).toBeGreaterThan(0)
    }
  })

  it('pins one signed-off render per ride figure the catalogue ships', () => {
    const pinned = new Set(SIGN_OFFS.map((entry) => entry.id))
    const figures = new Map<string, string[]>()

    for (const spec of readCatalogue()) {
      const template = templateById(spec.template)
      if (!template.voices.includes('ride')) continue
      const pool = RIDE_PATTERNS[template.subdivision]
      expect(pool, `${template.id} rides but has no ride pattern pool`).toBeDefined()
      const steps = pick(rngFor(`${spec.template}:${spec.seed}:${RIDE_LABEL}`), pool!)
      const figure = `${template.id} [${steps.join(',')}]`
      figures.set(figure, [...(figures.get(figure) ?? []), spec.id])
    }

    expect(figures.size, 'no riding groove was found, so this test proves nothing').toBeGreaterThan(0)

    for (const [figure, ids] of figures) {
      expect(
        ids.some((id) => pinned.has(id)),
        [
          `${figure} ships on ${ids.join(', ')} and no entry in SIGN_OFFS pins any of them.`,
          'The table pins one render per ride figure, so a figure with no entry is a cymbal',
          'nobody has approved. Play one of those grooves, get it approved, and add it —',
          'do not delete this test.',
        ].join('\n'),
      ).toBe(true)
    }
  })

  for (const entry of SIGN_OFFS) {
    describe(`${entry.id} — “${entry.approval}”`, () => {
      const signedOff = renderGroove(entry.id)

      it('renders the exact audio that was played to a person and approved', () => {
        expect(pcmSha256(signedOff.pcm), voidSignOff(entry)).toBe(entry.pcm)
      })

      if (entry.mp3 !== null) {
        const mp3 = entry.mp3
        it('encodes that audio to the exact mp3 that was heard', async () => {
          const out = join(dir, `${entry.id}.mp3`)
          await encodeMp3(signedOff.pcm, out)
          expect(sha256(readFileSync(out)), voidEncoderPin(entry)).toBe(mp3)
        }, 30_000)
      }
    })
  }

  it('encodes the same bytes on two separate runs — AC13', async () => {
    const first = join(dir, 'twice-a.mp3')
    const second = join(dir, 'twice-b.mp3')
    await encodeMp3(renderGroove(SHUFFLE_ID).pcm, first)
    await encodeMp3(renderGroove(SHUFFLE_ID).pcm, second)
    expect(
      sha256(readFileSync(second)),
      `two renders of ${SHUFFLE_ID} encoded to different mp3 files, so the catalogue's audio is not reproducible from source`,
    ).toBe(sha256(readFileSync(first)))
  }, 60_000)
})

describe('the ride alternates as they are rendered — R4, AC13', () => {
  function ridePicks() {
    const spec = readCatalogue().find((g) => g.id === SHUFFLE_ID)!
    const template = templateById(spec.template)
    const { events, music } = buildEvents(spec, template)
    const passes = music.loopBars / music.bars

    const chosen: (Pcm | null)[] = []
    const watched: SamplePack = {
      id: realPack.id,
      describe: () => realPack.describe(),
      get(voice: VoiceName, opts): PackSample | null {
        const sample = realPack.get(voice, opts)
        chosen.push(sample?.pcm ?? null)
        return sample
      },
    }

    renderVoices(events, watched, SAMPLE_RATE, {
      id: spec.id,
      bars: music.loopBars,
      bpm: music.bpm,
      passes,
      overhangBars: OVERHANG_BARS,
    })
    expect(chosen.length, 'the pack was not asked exactly once per event').toBe(events.length)

    const passSec = ((music.loopBars / passes) * 4 * 60) / music.bpm
    const names = new Map<Pcm, string>()
    const byPass: string[][] = Array.from({ length: passes }, () => [])

    events.forEach((event, i) => {
      if (event.voice !== 'ride') return
      const pcm = chosen[i]
      expect(pcm, 'a ride event was rendered from no sample at all').not.toBeNull()
      if (!names.has(pcm!)) names.set(pcm!, `alternate-${names.size + 1}`)
      const pass = Math.max(0, Math.min(passes - 1, Math.floor(event.timeSec / passSec)))
      byPass[pass].push(names.get(pcm!)!)
    })

    return { byPass, heard: names.size }
  }

  const RIDE = ridePicks()

  it('strikes the ride often enough for a repeat to be audible', () => {
    const hits = RIDE.byPass.flat().length
    expect(hits, 'the shuffle render plays no ride at all').toBeGreaterThan(0)
    for (const [pass, seq] of RIDE.byPass.entries()) {
      expect(seq.length, `pass ${pass} plays no ride`).toBeGreaterThan(0)
    }
  })

  it('plays every alternate the pack declares, rather than resting on one file', () => {
    const declared = new Set(
      (realPack.describe().voices.ride?.layers ?? []).flatMap((layer) => layer.files),
    )
    expect(declared.size, 'the pack declares no ride files').toBeGreaterThan(1)
    expect(
      RIDE.heard,
      `the render drew on ${RIDE.heard} of the ${declared.size} ride alternates the pack ships`,
    ).toBe(declared.size)
  })

  it('never strikes the same alternate twice in a row', () => {
    for (const [pass, seq] of RIDE.byPass.entries()) {
      for (let i = 1; i < seq.length; i += 1) {
        expect(
          seq[i],
          `pass ${pass} plays ${seq[i]} on hits ${i - 1} and ${i} — the ride is machine-gunning`,
        ).not.toBe(seq[i - 1])
      }
    }
  })

  it('does not replay a pass’s ride alternates on the pass after it', () => {
    expect(RIDE.byPass.length, 'the shuffle groove renders a single pass').toBeGreaterThan(1)
    for (let pass = 0; pass + 1 < RIDE.byPass.length; pass += 1) {
      const before = RIDE.byPass[pass]
      const after = RIDE.byPass[pass + 1]
      const shared = Math.min(before.length, after.length)
      expect(shared, `passes ${pass} and ${pass + 1} have no ride hit to compare`).toBeGreaterThan(
        0,
      )
      for (let i = 0; i < shared; i += 1) {
        expect(
          after[i],
          `pass ${pass + 1} replays pass ${pass}'s ${before[i]} at ride hit ${i}, so the loop repeats itself sample for sample`,
        ).not.toBe(before[i])
      }
    }
  })
})
