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
import { LOW_REGISTER_CEILING_MIDI, lowRegisterRanking } from './lowRegister.ts'
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
  /**
   * sha256 of the interleaved f32 PCM `encodeMp3` is fed — the music and nothing else,
   * or null where the render it will pin has not shipped yet. A null is not a missing
   * hash: it is a listening that happened and a render that has not. `upstream` names
   * what it is waiting for.
   */
  pcm: string | null
  /** sha256 of the encoded file, or null where the groove is deliberately not encoder-pinned. */
  mp3: string | null
  /**
   * The file that was played to a person. All twenty entries name the committed mp3
   * under public/grooves/ that was actually auditioned; entries pinned before
   * 2026-09-06 used to name session scratch that is not in the repo and cannot be
   * opened. Kept as the record of which audition round gave the approval.
   */
  file: string
  /** What that person said about it, in their own words. */
  approval: string
  /** Where those words covered more than this groove, what they covered. */
  scope?: string
  /** What has to move for this render to change; quoted back in the failure. */
  upstream: string
}

// Two listening passes reached these renders on 2026-09-07, and the record keeps both
// verbatim rather than overwriting the first with the second. Nothing was re-rendered
// between them, so both passes heard the same audio these hashes pin.
//
// Pass 1 — one catalogue-wide listen, given as a single verdict the listener chose to
// let cover all nine feels.
const FEATURE_27_APPROVAL_CATALOGUE =
  'I listened to the newly created grooves. It sounds very good!'

// Pass 2 — one groove of each of the nine feels, asked for because R16 wants a verdict
// per feel and pass 1 was one verdict over everything. This is the one the entries rest
// on: it is the more specific listening, and it carries a comparative pass 1 did not —
// the new instrument judged against the upright it replaced, on committed-tree renders
// rather than on the scratch A/B.
const FEATURE_27_APPROVAL_PER_FEEL =
  'I played 1 groove per feel and they all sound good. better than before'

// One shared scope, because the account was the same for all twelve entries that once
// rested on it: the listening was per feel, the words were one sentence over all nine,
// and no groove was named. Twelve differently-worded scopes would have read as twelve
// verdicts, and there was one. The comment here used to say a later single-entry re-pin
// would have to split this constant. What happened instead is not a split and the
// distinction is worth keeping: feature-28 re-pinned eleven of the twelve onto its own
// five sessions, so this constant and the approval above now carry exactly one entry,
// groove-08 — the one groove whose audio survived the floor change and both gain raises
// byte for byte. Splitting the string would produce two identical strings; nothing here
// diverged, eleven entries left. Both constants stay as written because groove-08 still
// rests on them and the record below still quotes them.
//
// The sentence this table cannot do without is the third one. He played one groove of
// each feel and did not say which, so nothing here may claim that the render pinned in
// this entry is the render that reached his ear.
const FEATURE_27_SCOPE =
  'Two passes on 2026-09-07, over the same renders, after feature-27 epic 1 swapped the ' +
  'bass. Pass 2 is what this entry rests on: one groove of each of the nine feels was ' +
  'played, which is the per-feel listening R16 asks for. The words were still one ' +
  'sentence covering all nine, not nine differently-worded opinions, and “better than ' +
  'before” is the new instrument against the upright it replaced. Pass 1, earlier the ' +
  'same day, was one catalogue-wide listen given as a single verdict over all nine ' +
  'feels: “' +
  FEATURE_27_APPROVAL_CATALOGUE +
  '”. ' +
  'Which groove he played for a feel was his choice and was not recorded, so this scope ' +
  'does not claim the render pinned here is the one he heard — only that a groove of ' +
  'this feel was played and approved. Which groove anchors the feel is a measured ' +
  'choice made in this table, the sharpest test of that feel’s balance, and the pin ' +
  'rests on its sibling the way the feel’s unpinned grooves rest on it: one template ' +
  'file, one shared pack, so none of them can move without this one moving. ' +
  'Feature-28 disproved the sentence above about one template file and one shared pack: ' +
  'lowering BASS_FLOOR_MIDI moved 48 of the 54 grooves and left six untouched, so this ' +
  'scope reaches less far than it claimed. What it still covers is a groove of this feel, ' +
  'played and approved; what it never covered is the feel’s other grooves after an ' +
  'events.ts change. ' +
  'On a riding ' +
  'feel that cuts one notch further — one groove of the feel was played, so the ride ' +
  'figure a given entry anchors is not necessarily the figure that was heard. What both ' +
  'passes were about is level: the new instrument in place at Track D’s nine ' +
  're-measured gain.bass values. The instrument itself was settled earlier and ' +
  'separately, on an A/B this table cannot hold (see the note above). Two measured ' +
  'questions remain open and neither was put to him, so “they all sound good” does not ' +
  'answer either: layer flicker at the 0.74 velocity boundary, and MIDI 46’s 3.9 dB ' +
  'alternate spread. Recorded in ' +
  'specs/features/feature-27/.implement/track-f.md.'

// ── Feature-28 epic 1's five listening sessions ──────────────────────────────────────
//
// Five sessions on 2026-09-08, one listener, verbatim in
// specs/features/feature-28/.implement/gates/anchors/approvals.md. Two of the five are
// gates the epic could not proceed without; three exist because a groove had to be heard
// before it could be pinned. They are separate constants rather than one, because unlike
// feature-27's two passes these five were given on five different questions and two of
// them were given on audio that afterwards moved.

// Session 1 — gate B, the root on a phone speaker. groove-17 and groove-03.
const FEATURE_28_APPROVAL_ROOT =
  'listened to groove-17 and groove-3 on phone speakers, macbook speakers and ' +
  'headphones. I love it. The low bass is just perfect'

// Session 2 — gate A, the span. groove-20, groove-79, groove-42, groove-57, groove-72.
const FEATURE_28_APPROVAL_SPAN =
  'also listened to gate A. They all sounds great. Only thing is groove-57: the bass ' +
  'could be a little bit louder. not much.'

// Session 3 — the four anchors no gate reached. groove-14, groove-44, groove-50,
// groove-67.
const FEATURE_28_APPROVAL_ANCHORS =
  'all sound good. only for groove-50: the bass can go louder'

// Session 4 — the re-hear after the two gain raises. groove-57 at bossa-nova's −22.2,
// and swung-sixteenth's six at −19.5.
const FEATURE_28_APPROVAL_GAIN = 'all sound good now. Thanks a lot'

// Session 5 — the seven feature-27 entries the anchor rule does not make anchors.
const FEATURE_28_APPROVAL_LEGACY =
  'listened to all 7. All sound good. I think what the bass does sounds more like a ' +
  'normal bass player. very cool'

// What all five sessions share, and what none of them can be read past. Every scope
// below opens with this and then says what its own session did and did not cover.
const FEATURE_28_LISTENING =
  'Five sessions on 2026-09-08, one listener, all verbatim in ' +
  'specs/features/feature-28/.implement/gates/anchors/approvals.md. Feature-28 epic 1 ' +
  'lowered BASS_FLOOR_MIDI from 28 to 25, and two feels then took a gain their own ' +
  'listening asked for: bossa-nova’s gain.bass −23.2 → −22.2 and swung-sixteenth’s ' +
  '−20.7 → −19.5. Between them the three changes re-rendered 51 of the 54 grooves; only ' +
  'groove-08, groove-46 and groove-52 came out byte-identical, and groove-08 is the one ' +
  'of those three this table pins. Every mp3 is the same byte length before and after, ' +
  'so nothing but a hash notices a render that moved. Which of the five sessions pins ' +
  'an entry is therefore load-bearing rather than bookkeeping: two sessions were given ' +
  'before a gain landed on the feel they covered, and those verdicts are void for that ' +
  'feel rather than folded in. '

const FEATURE_28_SCOPE_ROOT =
  FEATURE_28_LISTENING +
  'This is gate B, the first of the two gates: whether the root still reads as a pitch ' +
  'rather than as a thud now that the bass sounds below the old floor. groove-17 (D ' +
  'lydian, tonic D1, MIDI 26, 36.7 Hz) and groove-03 (E♭ dorian, tonic E♭1, MIDI 27, ' +
  '38.9 Hz) are the two grooves in the catalogue that put the tonic itself on the low ' +
  'string, and both were played — on phone speakers, MacBook speakers and headphones, ' +
  'all three, which R11 makes part of the claim. So this is the one scope in this table ' +
  'that may say the render pinned here is the render that reached the ear; ' +
  'FEATURE_27_SCOPE deliberately cannot. Three things it does not cover. The question ' +
  'was whether the low note carries a pitch, not whether the bass sits at the right ' +
  'level — the balance was measured, and only bossa-nova’s and swung-sixteenth’s were ' +
  'ever heard. The floor pitch itself was heard here only in passing: MIDI 25 sounds ' +
  'four times in groove-17, every one of them the C♯1 leading tone resolving up onto ' +
  'D1, and never as a chord root; the root reading of MIDI 25 was heard in session 3, ' +
  'on groove-44. And feature-27’s two open questions were not put to him here either. ' +
  'Neither groove’s audio moved after this session — no gain touched bright-straight or ' +
  'straight-funk.'

const FEATURE_28_SCOPE_SPAN =
  FEATURE_28_LISTENING +
  'This is gate A, the second gate: whether a leap of 21 semitones or more inside one ' +
  'bar reads as the bass continuing or as a second instrument entering. groove-20, ' +
  'groove-79, groove-42, groove-57 and groove-72 were played, with groove-17 carried ' +
  'over from gate B, and the verdict settles it for the catalogue: the 140 leaps of 18 ' +
  'semitones or more per pass, up from 74 at floor 28, are not a defect. BASS_LEAP_MAX ' +
  'was never introduced and epic 2 does not exist. The two entries this scope carries, ' +
  'groove-79 and groove-72, were played in this session and neither was re-rendered ' +
  'afterwards — the two raises moved bossa-nova and swung-sixteenth only — so the audio ' +
  'heard here is the audio pinned here. What it does not cover: the session’s one ' +
  'reservation was groove-57’s level, and that part of this verdict is void rather than ' +
  'folded in (see that entry); and the question was about the line, not about balance.'

const FEATURE_28_SCOPE_ANCHORS =
  FEATURE_28_LISTENING +
  'The session the every-feel anchor rule cost: groove-14, groove-44, groove-50 and ' +
  'groove-67 are the argmaxes neither gate reached, and “pins the groove that moved ' +
  'most in every registered feel” cannot go green until a person has heard them. All ' +
  'four were played. Three are pinned on these words — groove-14, groove-44, groove-67 ' +
  '— and none of the three was re-rendered afterwards, because half-time, shuffle and ' +
  'second-line took no gain. The fourth is not pinned here: the same sentence asked for ' +
  'groove-50’s bass to go louder, swung-sixteenth’s gain.bass rose 1.2 dB, and the ' +
  'render this session heard no longer exists anywhere. Session 4 is its approval. What ' +
  'this scope does not cover: four grooves’ worth of “all sound good” and no more — no ' +
  'device was recorded, no comparative was given, and neither of feature-27’s open ' +
  'questions was put.'

const FEATURE_28_SCOPE_GAIN =
  FEATURE_28_LISTENING +
  'The re-hear after both raises: groove-57 at bossa-nova’s gain.bass of −22.2, and ' +
  'swung-sixteenth’s six — groove-28, groove-34, groove-40, groove-48, groove-50 and ' +
  'groove-82 — at −19.5. Both raises were in place and neither feel is re-rendered by ' +
  'the other, so every groove in this session was heard at the values that ship. “now” ' +
  'is the load-bearing word: gate A had asked for groove-57’s bass to come up and ' +
  'session 3 for groove-50’s, and this is the verdict on the result rather than on the ' +
  'request. The per-feel reach of the knob was accepted in his own words the same day — ' +
  '“I’m fine with the gain being per feel. Change the whole feel” — so the five bossa ' +
  'grooves that moved with groove-57 and the five swung-sixteenth grooves that moved ' +
  'with groove-50 moved by decision rather than as a side effect. What it does not ' +
  'cover: five words over seven grooves, no device recorded, and no groove named beyond ' +
  'the two the requests had named.'

const FEATURE_28_SCOPE_LEGACY =
  FEATURE_28_LISTENING +
  'The last of the five: the seven entries feature-27 pinned that the anchor rule does ' +
  'not make anchors — groove-01, groove-07, groove-38, groove-58, groove-65, groove-71 ' +
  'and groove-78. Every one of them had a void pin and none of them is its feel’s ' +
  'argmax, so each needed words of its own before it could be re-pinned, and all seven ' +
  'were played and approved. Six of the seven sit in feels no gain touched. The seventh ' +
  'is groove-58, bossa-nova, and it was heard at −22.2: this session came after gate A ' +
  'asked for groove-57’s bass, after the raise was applied and rendered, and after ' +
  'session 4 approved the result. That order is the run record’s rather than a ' +
  'timestamp’s, which is worth knowing and does not weaken it — no other bossa render ' +
  'existed between session 4 and session 5. The second sentence — “what the bass does ' +
  'sounds more like a normal bass player” — is a verdict on the change and not on any ' +
  'one of the seven; the preamble above is where it is recorded as one, and no entry may ' +
  'read it as a statement about its own balance. What it does not cover: feature-27’s ' +
  'two open questions, still open and not put here either, and no device was recorded.'

// One entry per render a human has heard and approved. A hash moves only after a
// fresh ear has heard the new render — never to make the suite green. That is what
// voidSignOff says, in the failure itself, and it is the point of the whole table.
//
// The table pins one groove per ride figure the catalogue ships, not one per groove
// that was approved. Feature-24 epic 3's migration pass approved eleven renders in a
// single sentence, and those eleven draw five distinct (feel, ride figure) pairs:
//
//   shuffle          [0,2,4,6,8,10,12,14]  groove-08, 44 pinned · 19, 52 approved
//   shuffle          [0,4,6,8,12,14]       groove-07 pinned · 42 approved
//   swung-sixteenth  [0,3,4,8,11,12]       groove-40 pinned
//   swung-sixteenth  [0,4,7,8,12,15]       groove-48 pinned · 34 approved
//   swung-sixteenth  [0,4,8,12,15]         groove-28, 50 pinned
//
// Eleven pins would turn one ride change into eleven simultaneous failures, and a
// wall of red is what teaches people to re-pin in bulk without listening — the one
// thing this table exists to stop. Five fail once per thing that was separately
// approved. The coverage test below fails if a groove ever ships a figure no entry
// covers.
//
// Feature-28's anchor rule put a second pin on two of those five figures — groove-44
// beside groove-08, groove-50 beside groove-28 — because the rule picks by register and
// landed on a groove that already drew a pinned figure. One-pin-per-figure is a floor,
// not a cap: a figure with two entries fails twice, which is the cost of a rule that
// answers a different question, and it is cheaper than the alternative of not pinning a
// feel's argmax.
//
// ── What a pin covers, and how the groove it names is chosen ─────────────────────────
//
// For the feels that play no ride, the compression is the ride rule's applied to the
// cause that actually moves them: one pin per feel.
//
// The reason this table used to give for that is retracted rather than reworded — it
// was wrong, not too narrow. It read: "a feel's grooves render from one template file
// over one shared pack, so the unpinned ones cannot move without the pinned one moving
// too", and the same claim was repeated per entry as "nothing that could move them
// moves without a failure here". Feature-28 disproved it. Lowering BASS_FLOOR_MIDI from
// 28 to 25 changed one constant in events.ts — no template file, no sample, no pack
// entry — and six grooves came out byte-identical while the other 48 re-rendered:
// groove-08, groove-46, groove-48, groove-52, groove-54 and groove-82. Two of those six
// are pinned here, so groove-08's and groove-48's hashes stayed green while grooves of
// their own feel re-rendered into audio nobody had heard.
//
// What is true is narrower. A pin catches a change to the audio of the groove it names,
// and nothing more. It still catches everything reached through the feel's template
// file — a gain, a pan, a pattern override, a swing value, a humanize bound — because
// those move every groove of the feel at once, and that is what makes one entry per
// feel worth having. What it does not catch is a change to events.ts, to the shared
// pattern pools, or to the pack's note mapping: any of those can move a feel's grooves
// one at a time and leave the anchor untouched. The unpinned grooves of a feel are
// covered by the same verdict, not by the same hash, and the difference is the whole of
// what this paragraph got wrong.
//
// So which groove anchors a feel is neither a free choice nor an inherited one. It is
// one measured rule: the anchor is the groove with the largest share of its bass
// note-time sounding below MIDI 28, among that feel's grooves, as lowRegisterShare in
// ./lowRegister.ts computes it over the stream buildEvents produces today. The test
// "pins the groove that moved most in every registered feel" asserts it, and the point
// of a rule over an argument is that it re-picks: when the event streams move the
// argmax moves with them, and the test names the groove that has to be played next. A
// paragraph cannot notice that it has stopped being true. This one did not.
//
// The table grows rather than swaps. "still guards every sign-off this repo has been
// given" pins the exact list of ids and calls removing one "the same as re-pinning it
// blind": an approval is something a person gave about a particular render, and a
// render that did not move still has it. The floor change proved the case — it left six
// of the 54 renders byte-identical, two of them pinned here, groove-08 and groove-48 —
// and then the second half of the same epic took one of the two back: swung-sixteenth's
// gain.bass rose to −19.5 for groove-50's sake, groove-48 moved with its feel, and its
// pin went void after all. So groove-08 is the only surviving example, the
// unchanged-audio set is down to three (groove-08, groove-46, groove-52), and the
// argument is unaffected: an events.ts change can still move a feel's grooves one at a
// time, which is exactly why groove-08 kept a green hash while groove-19 and groove-44
// re-rendered into audio nobody had heard. Growing rather than swapping is also what
// keeps the ride-figure coverage above green, because no figure loses the entry that
// covers it.
//
// ── The price of one metric ──────────────────────────────────────────────────────────
//
// The rule is honest only while the bass is what keeps changing. It measures one thing,
// and it measures it at MIDI 28 because 28 is the boundary feature-28 moved across: the
// open low E of a four-string, and the floor the generator used to hold. A ride figure,
// a swing value or a snare line would move every groove of a feel without touching a
// bass note, and this rule would then hand the anchor to whichever groove happens to
// sit lowest — a number with nothing to do with what moved. It would be worse than the
// prose it replaces, because it would look measured. The change that hits that is the
// change that should revisit this, and revisiting it means a second metric named after
// its own question, not a wider threshold on this one.
//
// The precedent is already in this file and is left as written: the entry comments
// below quote shares below MIDI 32, not 28. That was feature-27's question — the
// register where a picked flatwound and a plucked upright differ most — and it is what
// picked feature-27's anchors. Two changes, two questions, two thresholds, and neither
// is the other's generalisation. Do not rewrite those figures to 28, and do not read
// them as this rule.
//
// ── Feature-28 epic 1, the floor at 25, and the five sessions ────────────────────────
//
// Every entry below except groove-08 was pinned or re-pinned on 2026-09-08. Feature-28
// epic 1 lowered BASS_FLOOR_MIDI from 28 to 25 — the low E of a four-string tuned down
// to C♯, MIDI 25, 34.76 Hz, the lowest note the Squier Bass VI library sampled — so the
// bass now sounds the bottom three pitch classes where it used to lift them an octave.
// 26 of the 54 grooves sound MIDI 25 at all, on 128 events between them, and groove-44
// carries 24 of those on its own.
//
// Two feels then took a gain, each asked for by an ear rather than predicted, and R14's
// mechanism is why: the pack's low samples carry less energy than their upper octave at
// the same velocity, so a groove that moved into the bottom octave lost level.
// bossa-nova went −23.2 → −22.2 for groove-57, and swung-sixteenth −20.7 → −19.5 for
// groove-50, which puts back that groove's pre-epic post-gain level to within 0.014 dB.
// The other seven feels are untouched, and "nothing to change" is their recorded
// outcome rather than an absence of one.
//
// Eight entries are new, one per feel whose argmax the rule picked and nothing pinned:
// groove-03, groove-14, groove-44, groove-50, groove-57, groove-67, groove-72 and
// groove-79. bright-straight needed none, because groove-17 was already its argmax and
// was already here. Twenty entries, nine feels, five ride figures, two of the five now
// carrying two pins.
//
// Five listening sessions, one listener, one day, and the assignment of session to entry
// is the substance of this pass rather than its filing. Gate B heard the root on a phone
// speaker; gate A heard the span; session 3 heard the four argmaxes no gate reached;
// session 4 re-heard the two feels after their gains; session 5 heard the seven entries
// the rule does not make anchors. Two verdicts inside those five are void and are not
// quoted anywhere below: gate A on groove-57, which was the pre-raise render and was a
// complaint about it, and session 3 on groove-57, where the mp3 on disk was still Track
// H's original pass and the audio those words describe exists nowhere. voidSignOff's own
// standard, applied to a verdict instead of to a hash.
//
// One sentence belongs here rather than in an entry. Asked about the seven legacy
// entries, he said: "I think what the bass does sounds more like a normal bass player.
// very cool". That is a verdict on the change and not on a render — the feature's own
// thesis returned unprompted, and docs/music.md's Voicing section calls the octave pop,
// the rest and the repeat "three things a bass player does that an arpeggiator does
// not". It is quoted in full in the entries that carry session 5, because an approval is
// recorded verbatim or not at all, and no entry reads it as a statement about its own
// groove.
//
// Eleven entries used to end their comment with "this render reproduced it byte for byte
// on 2026-09-07". Ten of the eleven now describe a file that has been overwritten. Each
// keeps that sentence and gains the render that replaced it, both hashes, rather than
// losing the first: the mp3s are the same byte length before and after, so the hash is
// the only witness either way.
//
// ── Feature-27 epic 1, and what it closed ────────────────────────────────────────────
//
// Every entry here was re-pinned on 2026-09-07, and four feels were pinned for the first
// time. Two things happened at once.
//
// The bass changed instrument. samples/pack.json dropped the 26-file pizzicato contrabass
// (VSCO 2 CE) for 81 files of Pastabass tagliatelle — a picked, muted, flatwound Squier
// Bass VI, CC0 1.0, nine notes at sounding MIDI 25–49 × three velocity layers × three
// alternates — and gain.bass was re-measured in all nine templates, from the old
// −4.0 … +1.0 to −19.0 … −23.4. Every one of the eight pins the table held went void the
// moment the catalogue re-rendered, which is exactly the behaviour they exist for: the
// audio a person had approved no longer existed anywhere in the tree.
//
// And the gap this comment used to admit is closed. Until now the table covered five
// feels of nine: straight-funk, half-time, bright-straight and open-ballad had no entry
// at all, so a move in any of those four template files voided nothing and every test in
// this repo stayed green. That was the same defect feature-25 fixed for three feels, and
// it was still true for four. Feature-27's listening covered all nine feels, so pinning
// them cost one entry each and no extra listening: groove-01, groove-17, groove-38 and
// groove-78 are the four new entries, and the table now covers **every registered feel**
// as well as every ride figure. Twelve entries, nine feels, five ride figures —
// grown to twenty by feature-28's anchor rule; see the section above.
//
// ── What was actually heard, in two passes ───────────────────────────────────────────
//
// Both passes were on 2026-09-07 and nothing was re-rendered between them, so both heard
// the audio these hashes pin. Pass 1 was one catalogue-wide listen, given as a single
// verdict the listener chose to let cover all nine feels. Pass 2 was asked for because
// R16 wants a verdict per feel: he played one groove of each of the nine and answered in
// one sentence, with a comparative pass 1 did not carry. Both quotes are verbatim in the
// two constants above; pass 2 is the one the entries' approval field names.
//
// **He did not say which groove he played for a feel.** That is the fact the scope field
// exists to carry, and it is why no entry claims its own pinned render reached his ear:
// what is claimed is that a groove of that feel was played and approved, and that the
// pinned one cannot move without the rest of the feel moving with it. On the two riding
// feels it cuts one notch further — one groove of the feel was heard, so the ride figure
// a given entry anchors is not necessarily the figure that was heard. Overstating any of
// that would be the same failure as re-pinning a hash without listening, one layer up.
// The clause about the rest of the feel moving with it is the sentence feature-28
// disproved, kept here as what that listening was recorded to claim; the preamble above
// says what a pin actually covers.
//
// ── What this listening does not cover ───────────────────────────────────────────────
//
// Three things, and none of them is folded in above. In particular, “they all sound
// good” is a verdict on the nine feels; neither of the two measured questions below was
// ever put to him, so it answers neither.
//
// 1. Layer flicker at the 0.74 velocity boundary. Both live boundaries in the bass's
//    three layers, 0.74 and 0.86, sit inside the jitter band of a VELOCITIES.bass row,
//    so some layer crossings are humanize rather than intent — the mechanism that made
//    quick-8's comp flicker. The measurement does not condemn it: the net step is
//    0.10–4.60 dB against the comp's 4.5–10.8, and the bass is monophonic, so there is
//    no chord for a mis-placed note to sit wrong inside. Sharpest cases are groove-40
//    (12 crossings at MIDI 28, 16 at MIDI 31 — the worst in the catalogue) and then
//    groove-01 (20 at MIDI 28); both are pinned above, so the two renders that carry the
//    question are the two a re-pin would have to face. Fallbacks are already measured in
//    specs/features/feature-27/.implement/audition/layers.md, and both change the pack
//    rather than a gain.
// 2. MIDI 46's vl1 alternates spread 3.9 dB, the widest in the shipped set, on the one
//    note where the pack's first-listed-alternate nominal is loosest. Sharpest on
//    groove-07, which carries 8 events there and is pinned above.
// 3. The instrument's own A/B verdict — verdict 1 of the epic's ten listening events — is
//    deliberately absent from this table and cannot be in it. That render came from a
//    scratch pack.json under a gitignored folder, carried a scratch bass trim, and was
//    made against the old committed templates, so no committed tree reproduces it and
//    voidSignOff's rule cannot be met. Its committed home is the audition section of
//    scripts/grooves/samples/README.md, which Step B9 asserts. straight-funk was
//    therefore heard on the A/B, which decided the instrument, and again in both passes
//    below, which is what groove-01's entry pins. “Better than before” in pass 2 is the
//    same comparison the A/B made, given a second time on audio this tree reproduces —
//    which is the one thing the A/B verdict could not offer.
//
// Questions 1 and 2 are open and unanswered. If either is later answered against the
// pack, these pins go void and this table is what will say so.
const SIGN_OFFS: SignOff[] = [
  {
    // Pinned 2026-09-07 by feature-27 epic 1's listening pass — the first entry this
    // table has ever held for straight-funk, and one of four feels pinned here for the
    // first time.
    //
    // groove-01 anchors the feel's six because it is the sharpest test of the thing that
    // changed. It spends 54.4% of its bass note-time below MIDI 32 — the most of the six
    // when feature-27 measured it, fourth of the six now that feature-28's floor took
    // groove-03 to 66.7%, groove-02 to 64.3% and groove-18 to 56.3%, and the figure itself
    // still measures 54.4% —
    // which is the register where a picked flatwound and a plucked upright differ most
    // and where the two largest velocity-layer steps sit; Track D measured 20 of its
    // bass events crossing a layer boundary at MIDI 28, joint worst in the catalogue
    // with groove-40. It is also the groove the instrument A/B was rendered from — the
    // one render in the catalogue whose old instrument a person heard back to back
    // against the new one — and straight-funk is the anchor feel whose bass-over-kick
    // median C7 measures boom-bap and second-line against.
    //
    // groove-22 stays unpinned although it is the loudest render in the catalogue at
    // −21.12 dBFS, 1.12 dB under the ceiling: that is a master-RMS property
    // catalogue-gate.test.ts already measures on all 54, and its bass visits the low
    // register least of the six at 15.4%. groove-02, -04, -18 and -22 are covered by the
    // same verdict and unpinned — by the verdict, not by this hash; groove-03 has its own
    // entry above, as this feel's anchor under the rule. A change to
    // the straight-funk template file moves all six and fails here; a change to
    // events.ts or a shared pattern pool can move them one at a time and leave this
    // entry green. See the preamble.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-01.mp3, hashes to
    // cbc4a5acef6989ce5995bcad06a034152d46d186c1132abf3dc2751dcf0c6526 (879 011 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // 67c10e9712c669bec565c9268b1faff14eff97cf03ca26f17b7f9ab4d716f4ce, and this render reproduces that one.
    id: 'groove-01',
    pcm: '0765f01f98d3121a83c291d43220a91ee720ee30c548b6a350cb7c25ce4e2768',
    mp3: null,
    file: 'public/grooves/groove-01.mp3',
    approval: FEATURE_28_APPROVAL_LEGACY,
    scope: FEATURE_28_SCOPE_LEGACY,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the kick and snare alternates — KICK_PATTERNS, ' +
      'HAT_PATTERNS, BASS_PATTERNS, COMP_PATTERNS, DEFAULT_PLACEMENT, DEFAULT_FILL, or ' +
      'the straight-funk template’s gain.bass (−20.0), its other gains, pan or ' +
      'humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's gate B — straight-funk's second entry,
    // and the feel's anchor under the rule the preamble states.
    //
    // groove-03 is straight-funk's argmax: 41.7% of its bass note-time sounds below MIDI
    // 28, against groove-18's 31.3% and groove-01's 7.8%, so it is the groove the floor
    // change moved furthest in this feel. 20 of its 48 bass events sit under the old
    // floor. What makes it gate B's groove as well as the rule's is where they sit: its
    // tonic is E♭1, MIDI 27, 38.9 Hz, it sounds on 16 of the 48 — a third of the line —
    // and it opens eight of the loop's sixteen bars, where the downbeat is exempt from
    // the rest, the repeat and the octave pop and therefore speaks every time round.
    // Two grooves in the catalogue put the tonic itself on the low string; this is one
    // and groove-17 is the other, and gate B played both. Its bass sits −6.82 dB under
    // its kick against a feel median of −5.55.
    //
    // groove-01 keeps its entry beside this one rather than being replaced by it: its
    // audio moved, session 5 re-heard it, and R20's table grows. groove-02, -04, -18 and
    // -22 are covered by gate B's verdict and unpinned — by the verdict, not by this
    // hash.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-03.mp3, hashes to
    // 489cfe38c154dbd40ad7582825a8fe7a6a0e7ed5a56231ecf81645dad6ec4516 (896 565 bytes),
    // and this render reproduces it byte for byte.
    id: 'groove-03',
    pcm: '74445662a4b811f104b20492ff0baa6aea197f6a9302dabfeea780e1b429c748',
    mp3: null,
    file: 'public/grooves/groove-03.mp3',
    approval: FEATURE_28_APPROVAL_ROOT,
    scope: FEATURE_28_SCOPE_ROOT,
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the comp’s single dyn2 layer — KICK_PATTERNS, HAT_PATTERNS, ' +
      'BASS_PATTERNS, COMP_PATTERNS, DEFAULT_PLACEMENT, DEFAULT_FILL, or the ' +
      'straight-funk template’s gain.bass (−20.0), its other gains, pan or humanize ' +
      'block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // quick-8 pin it replaces was e7664e75…f76e / 9c1a3bbd…9d57, void from the moment
    // the pack's contrabass became Pastabass tagliatelle and shuffle's gain.bass moved
    // +1.0 → −19.0.
    //
    // It keeps its place for the reason it was first pinned: it carries shuffle's 6-hit
    // ride figure [0,4,6,8,12,14], which nothing else pins, and groove-42 draws the same
    // figure unpinned. It also carries the sharpest case of the second open question
    // above — 8 bass events on MIDI 46, whose vl1 alternates spread 3.9 dB.
    //
    // This is the only entry with a non-null encoded hash. It was re-taken on 2026-09-08
    // for feature-28's re-render, on the encoder SIGNED_OFF_ENCODER names and with the
    // same invocation as before — moved audio, not a moved encoder — and it reproduces
    // the file that was played, public/grooves/groove-07.mp3 (1 014 430 bytes), byte for
    // byte.
    id: 'groove-07',
    pcm: '5e9c0a10cfb2a2171e9e1e1a7fab7ea10d5fc5a1872835da4420331184ae2c44',
    mp3: '20b1ddde2af6e31d116b6ce3d8502c243d0e05be30248eee640dbf3a2771e5bc',
    file: 'public/grooves/groove-07.mp3',
    approval: FEATURE_28_APPROVAL_LEGACY,
    scope: FEATURE_28_SCOPE_LEGACY,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — the ride or hat pattern pools, ' +
      'RIDE_SUSTAIN_SIXTEENTHS, RIDE_ACCENTS, the shuffle template’s gain.bass ' +
      '(−19.0), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // quick-8 pin it replaces was f0c8d5d9…439a. It keeps its place for the reason it
    // was first pinned: it carries the shuffle's all-eighths ride figure
    // [0,2,4,6,8,10,12,14], the densest cymbal in the catalogue at 2.75 strokes/s, which
    // nothing else pins on its own. groove-19 and groove-52 draw the same figure and are
    // unpinned — by the verdict, not by this hash; groove-44 draws it too and has had its
    // own entry since feature-28 made it this feel's anchor. A change to the shuffle
    // template file
    // moves all four and fails here; a change to events.ts or a shared pattern pool can
    // move them one at a time and leave this entry green, and that is not hypothetical:
    // feature-28's floor change left this render byte-identical while groove-19 and
    // groove-44 moved. See the preamble.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-08.mp3, hashes to
    // eb947c1ef3a3f5831a7514d7d3427abc58a82a269db86cac40573aa5d1f58b49 (1 014 430
    // bytes), and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-08',
    pcm: '0507f8fa0ae90196f85c991e447fb00d17c5bc0138f7a4e4575c108055fe6213',
    mp3: null,
    file: 'public/grooves/groove-08.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — the ride or hat pattern pools, ' +
      'RIDE_SUSTAIN_SIXTEENTHS, RIDE_ACCENTS, the shuffle template’s gain.bass ' +
      '(−19.0), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's third listening session — half-time's
    // second entry, and the feel's anchor under the rule.
    //
    // groove-14 is half-time's argmax of seven: 27.8% of its bass note-time below MIDI
    // 28, against groove-80's and groove-81's 14.6% and groove-46's nothing at all. 10
    // of its 36 bass events sit under the old floor. It is also the clearest case in the
    // table of what the floor bought: two of those events are MIDI 25 itself, and both
    // are the C♯1 approach note resolving up a semitone onto D1, the tonic. At floor 28
    // that C♯ was lifted to 37 and the approach came from above instead, which is the
    // one thing the approach rule gives way on — below gives way to above when a
    // semitone below would fall under the floor, and the pitch class that cannot be
    // approached from below moved from E to C♯ when the floor did. This groove is where
    // that reads. Half-time is also the feel with the fewest bass notes and the longest:
    // 36 events at 72 bpm, 0.417 s each, so nothing covers a low note that fails to
    // speak.
    //
    // groove-38 keeps its entry beside this one — decay under the registry's loudest
    // kick was feature-27's question for this feel and it is not this rule's.
    // groove-13, -20, -46, -80 and -81 are covered by session 3's verdict and unpinned —
    // by the verdict, not by this hash.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-14.mp3, hashes to
    // 5eb8c63ed99c13b18284f41ab3261f874388554d2463e5aa6f6504493718f1b3 (641 401 bytes),
    // and this render reproduces it byte for byte.
    id: 'groove-14',
    pcm: 'fc6c0bda2d767369f6d5396fd477ce406c98f1b5681a26310bd06c97cec6486d',
    mp3: null,
    file: 'public/grooves/groove-14.mp3',
    approval: FEATURE_28_APPROVAL_ANCHORS,
    scope: FEATURE_28_SCOPE_ANCHORS,
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the tom and snare alternates — KICK_PATTERNS, HAT_PATTERNS, ' +
      'BASS_PATTERNS, COMP_PATTERNS, PLACEMENTS[half-time] (the backbeat alone on step ' +
      '8), FILLS[half-time], or the half-time template’s gain.bass (−20.2), its swing ' +
      '(0.28), its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-07 by feature-27 epic 1's listening pass — the first entry this
    // table has ever held for bright-straight, and one of four feels pinned here for the
    // first time.
    //
    // groove-17 anchors the feel's six because it is the groove the floor change moved
    // furthest here and the groove gate B was played on, and those are the same fact. It
    // is bright-straight's argmax: 50.0% of its bass note-time sounds below MIDI 28,
    // against groove-21's 27.3% and groove-10's 26.7%, and 32 of its 64 bass events sit
    // under the old floor — 64 being the most of the six, so the feel's busiest low bass
    // line is also its deepest. Its tonic is D1, MIDI 26, 36.7 Hz, and it sounds on 28 of
    // those 64 events, 43.7% of the line; MIDI 25 itself sounds four more times, every one
    // of them the C♯1 leading tone resolving up onto that D1, which is the only place in
    // gate B's listening where the floor pitch was heard at all. Two grooves in the
    // catalogue put the tonic itself on the low string and this is one of them; groove-03
    // is the other, and gate B played both.
    //
    // Its post-gain bass sits −4.34 dB under its kick against a feel median of −4.59,
    // which is unremarkable inside the feel and is not why it is here. The sentence that
    // used to stand in this place claimed 2.08 dB and called it the narrowest gap of the
    // six; that was measured at floor 28 and is false at floor 25, where groove-11 (−4.23)
    // and groove-12 (−4.26) both sit closer. What the feel does carry is a risk of
    // congestion rather than of a missing bass: it runs the registry's joint-quietest kick
    // (−12, with second-line), so its bass is relatively forward to begin with, and bongos
    // at −16/−15 and rim at −8 share the midrange a pick attack now occupies.
    //
    // groove-09, -10, -11, -12 and -21 are covered by the same verdict and unpinned — by
    // the verdict, not by this hash. A change to the bright-straight template file moves
    // all six and fails here; a change to events.ts or a shared pattern pool can move
    // them one at a time and leave this entry green. See the preamble.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-17.mp3, hashes to
    // 413a6966cf73f23cf8addcdfb004ee4e3e54b9d95ae9d5001f8b9830d134ab83 (732 934 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // 020190352b5dd4b9cd37bc4ecf84b20e607497a82c89056872a15acef7856987, and this render reproduces that one.
    id: 'groove-17',
    pcm: '1b3f19c9c797db5ecb7d14473dc1a2a96f2673d0d131df622b9e78737ee6b9d2',
    mp3: null,
    file: 'public/grooves/groove-17.mp3',
    approval: FEATURE_28_APPROVAL_ROOT,
    scope: FEATURE_28_SCOPE_ROOT,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the bongo and rim alternates — KICK_PATTERNS, HAT_PATTERNS, ' +
      'BASS_PATTERNS, COMP_PATTERNS, BONGO_PATTERNS, BONGO_ACCENTS, ' +
      'PLACEMENTS[bright-straight] (the rim on step 14, bar 3 only), DEFAULT_FILL, or ' +
      'the bright-straight template’s gain.bass (−22.8), its other gains, pan or ' +
      'humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // quick-8 pin it replaces was fb658dcc…36e5. It keeps its place as the anchor for
    // its ride figure: before quick-8 it was the only entry carrying two independent
    // approvals, epic 2's round 1 and epic 3's migration pass, which is why it rather
    // than groove-50 anchors the figure. That reason still holds and is not the same as
    // the register rule: groove-50 has had its own entry since feature-28 made it
    // swung-sixteenth's anchor, so the figure now carries two pins, and groove-82 draws
    // it unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-28.mp3, hashes to
    // f692ba0c31bf795959a5864fe616c19ca29a884f7929ff1320e6c1fac3f141c5 (855 187 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // 01511bb00db5066e2f852056385955935c02a8206a05eb7897563d5c72b3d8be, and this render reproduces that one.
    id: 'groove-28',
    pcm: '13664c213c63c56b3a4098d02adc4338e6435ef597cd6c66c005d6aae8c985ca',
    mp3: null,
    file: 'public/grooves/groove-28.mp3',
    approval: FEATURE_28_APPROVAL_GAIN,
    scope: FEATURE_28_SCOPE_GAIN,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — RIDE_PATTERNS[16] or the hat ' +
      'punctuation pool, FEATHER_VELOCITY, the swung-sixteenth template’s gain.bass ' +
      '(−19.5), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-07 by feature-27 epic 1's listening pass — the first entry this
    // table has ever held for half-time, and one of four feels pinned here for the first
    // time.
    //
    // groove-38 anchors the feel's seven because it is the sharpest test of the one
    // question this feel puts to a bass: half-time sits under the loudest kick in the
    // registry (−7) and the risk is a bass that supports it or vanishes beneath it.
    // groove-38 has the widest post-gain bass-under-kick gap of the seven at −7.18 dB
    // (feel median −6.88), a register 64.3% of whose bass note-time sounds below MIDI 32
    // — second of the seven now, behind groove-14's 66.7%, where feature-27 measured it
    // joint-deepest at 57.1% before the floor moved — and only 28 bass events at 78 bpm,
    // so every note is long and exposed and nothing covers one that fails to speak.
    // groove-46 is still its near twin (−7.08 dB, 57.1%, 28 events) and the pair is now
    // separated by 0.10 dB rather than 0.03; groove-38 is taken on the wider gap, which
    // is the measure the question is actually about.
    //
    // groove-13 stays unpinned although it is the quietest render in the catalogue
    // (−26.29 dBFS, 2.71 dB over the floor): that is a master-RMS property
    // catalogue-gate.test.ts already measures on all 54, and its bass visits the low
    // register least of the seven at 13.6%, so it tests the mix rather than the
    // instrument. groove-13, -20, -46, -80 and -81 are covered by the same verdict and
    // unpinned — by the verdict, not by this hash; groove-14 has its own entry above, as
    // this feel's anchor under the rule. A change to the half-time template
    // file moves all seven and fails here; a change to events.ts or a shared pattern pool
    // can move them one at a time and leave this entry green. See the preamble.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-38.mp3, hashes to
    // 5ff7da60c4be871ea0138c920e594ac6afd4f87dd9157303c63f7d625b355daa (592 500 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // 796c35aac5c3836462ef4c33af560349b84f6bf40f8a86d6e20e53ee380da505, and this render reproduces that one.
    id: 'groove-38',
    pcm: '997e21e7a6e101f14ce4a045c0bb4f64731f0224f3181d03f3f6c44792058ae6',
    mp3: null,
    file: 'public/grooves/groove-38.mp3',
    approval: FEATURE_28_APPROVAL_LEGACY,
    scope: FEATURE_28_SCOPE_LEGACY,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the tom and snare alternates — KICK_PATTERNS, HAT_PATTERNS, ' +
      'BASS_PATTERNS, COMP_PATTERNS, PLACEMENTS[half-time] (the backbeat alone on step ' +
      '8), FILLS[half-time], or the half-time template’s gain.bass (−20.2), its swing ' +
      '(0.28), its other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // quick-8 pin it replaces was 126621dd…2584. It keeps its place as the only entry
    // carrying RIDE_PATTERNS[16]'s 6-hit member — the one Fred chose in epic 2 over the
    // 8-hit one he had rejected as "a bit too much" — and it is now also the sharpest
    // case of the first open question above: 12 bass events cross a velocity-layer
    // boundary at MIDI 28 and 16 at MIDI 31, the worst in the catalogue. Both counts were
    // re-measured on the floor-25 streams and both reproduce, as does 28 events over the
    // two notes being the catalogue's highest. MIDI 28 there is a sampled note and a
    // layer boundary, not the bass floor — it was the floor when this was written and the
    // floor is 25 now — and the crossing count itself is feature-27's Track D
    // measurement, which nothing in feature-28 re-derived.
    //
    // mp3 is still null on purpose, and the reason has not changed. The encoded hash is
    // the only assertion in this repo that re-runs the encoder, so it fails on a
    // different ffmpeg or LAME build from byte-identical audio. groove-07 already pins
    // that, with the same encoder and the same invocation, so a second encoded pin fails
    // in exactly the circumstances the first one does and detects nothing it misses — it
    // would double a known false-failure mode for no coverage. The pcm hash is
    // encoder-independent and is the one that carries the music. For the record: the
    // file that was played, public/grooves/groove-40.mp3, hashes to
    // 79093bfb5b02ba003e2f8f517a7d1ce3014532181fda651b9844400692a0302d (839 514 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // 22ee612e74e6a4ade1a8b007a889e79239285b7149d77d454f28b02497bbcc7f, and this render reproduces that one.
    id: 'groove-40',
    pcm: '42aac080bf7c246acd72fbd54147da315e923ef2d3ac5762e8f78bf79fc80926',
    mp3: null,
    file: 'public/grooves/groove-40.mp3',
    approval: FEATURE_28_APPROVAL_GAIN,
    scope: FEATURE_28_SCOPE_GAIN,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — RIDE_PATTERNS[16] or the hat ' +
      'punctuation pool, FEATHER_VELOCITY, the swung-sixteenth template’s gain.bass ' +
      '(−19.5), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's third listening session — shuffle's third
    // entry, and the feel's anchor under the rule.
    //
    // groove-44 is the deepest bass in the catalogue on the metric this rule uses: 53.7%
    // of its bass note-time sounds below MIDI 28, against groove-42's 26.8% and the next
    // feel's best of 50.0%. 32 of its 60 bass events sit under the old floor, and 24 of
    // them are MIDI 25 itself — the floor, C♯1, 34.76 Hz, 40% of the line, and 24 of the
    // 128 MIDI-25 events in the whole catalogue. They are not passing notes: C♯ is the
    // root of C♯7, the second and fourth chord of F♯7–C♯7–B7–C♯7, and it opens eight of
    // the loop's sixteen bars. So this is the one render in the table where the floor
    // pitch is heard as a chord root on a downbeat, which is precisely the reading gate B
    // could not reach — none of its grooves is rooted C♯. Session 3 played it. Its bass
    // sits −1.69 dB under its kick, which is the feel's own median of −1.71; shuffle runs
    // the loudest bass in the registry at −19.0 and the low octave is forward here.
    //
    // It draws shuffle's all-eighths ride figure [0,2,4,6,8,10,12,14], which groove-08
    // also pins. That figure now carries two entries, which is R20's growth and not a
    // replacement: groove-08's approval is on audio that never moved, and this one's is
    // on audio that did. groove-19 and groove-52 draw the figure unpinned — by the
    // verdict, not by either hash.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-44.mp3, hashes to
    // 9c31e39f08ef3e7948bff37d0e5c1ad80a80a0da65ba5f2ccccc8bbe0285d465 (1 139 190
    // bytes), and this render reproduces it byte for byte.
    id: 'groove-44',
    pcm: 'fd554dda1d97b1be26bc22a5c1eb24e911136e28f72e8226a724e950c000d6d1',
    mp3: null,
    file: 'public/grooves/groove-44.mp3',
    approval: FEATURE_28_APPROVAL_ANCHORS,
    scope: FEATURE_28_SCOPE_ANCHORS,
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the ride’s alternates — the ride or hat pattern pools, ' +
      'RIDE_SUSTAIN_SIXTEENTHS, RIDE_ACCENTS, the shuffle template’s gain.bass (−19.0), ' +
      'its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // quick-8 pin it replaces was 20607f33…07fb. It keeps its place as the fastest
    // sixteenth in the catalogue (114 bpm) and the busier of the two grooves drawing its
    // ride figure, 2.61 ride strokes/s against groove-34's 2.48. groove-34 draws the
    // same figure and is unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-48.mp3, hashes to
    // 58658a1afe5123a690e235673d1032aa3047154d94d35978b6c97bb6e97fb63f (810 048 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // f2557a44b67e42465c79ba5ed39bdc429af817093f4e92f74a9aa701447bf4fd, and this render reproduces that one
    // — and it is worth naming which change did it: the floor change left this render
    // byte-identical, and the swung-sixteenth raise for groove-50's sake took it a
    // second time.
    id: 'groove-48',
    pcm: 'a29715ba3ba88fc2c5c1958307c03dd9546056053edea537ae6e31c64fa668dd',
    mp3: null,
    file: 'public/grooves/groove-48.mp3',
    approval: FEATURE_28_APPROVAL_GAIN,
    scope: FEATURE_28_SCOPE_GAIN,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — RIDE_PATTERNS[16] or the hat ' +
      'punctuation pool, FEATHER_VELOCITY, the swung-sixteenth template’s gain.bass ' +
      '(−19.5), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's fourth listening session, after the gain
    // raise its own hearing asked for — swung-sixteenth's fourth entry, and the feel's
    // anchor under the rule.
    //
    // groove-50 is swung-sixteenth's argmax: 32.6% of its bass note-time below MIDI 28,
    // against groove-40's 25.7%, and 20 of its 60 bass events under the old floor. It is
    // the only entry in this table whose *tonic* is the floor pitch. The groove is C♯
    // phrygian dominant, C♯1 is MIDI 25, and it opens three of the loop's four cycles on
    // it. Five grooves in the catalogue are rooted C♯ — groove-09, -19, -50, -51, -73 —
    // and this is the only one pinned, so it is the one render guarding the floor pitch
    // as a puzzle answer's own root rather than as a passing note.
    //
    // It is also the groove the second gain raise exists for. Session 3 played it and
    // asked for more bass; swung-sixteenth's gain.bass went −20.7 → −19.5, which restores
    // this groove's post-gain bass to −41.00 dBFS against the −40.986 it had before the
    // floor moved — 0.014 dB, and the whole reason the number is 1.2 and not a round
    // one. Even after the raise its bass sits −7.18 dB under its kick, the furthest under
    // of the six against a feel median of −4.88, which is why it was the groove that
    // asked. Session 4 is its approval; session 3's words describe a render that no
    // longer exists.
    //
    // It draws the ride figure [0,4,8,12,15], which groove-28 also pins; groove-82 draws
    // it unpinned. Two pins on one figure is the growth R20 describes, and groove-28
    // keeps its place for the reason it was first pinned — two independent approvals,
    // which this entry does not have.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-50.mp3, hashes to
    // 322dd91d96f71f23917f30fd49e5910333bc11af67a1be39f818d27a320e5c80 (810 048 bytes),
    // and this render reproduces it byte for byte.
    id: 'groove-50',
    pcm: '62e13fbc527c5af2b47db187f9224ae2924719d54a70ce5381df1a83d76e7fa2',
    mp3: null,
    file: 'public/grooves/groove-50.mp3',
    approval: FEATURE_28_APPROVAL_GAIN,
    scope:
      FEATURE_28_SCOPE_GAIN +
      ' Session 3 played this groove too and its verdict on it is not quoted here: “the ' +
      'bass can go louder” is the request this raise answered, so the words above are ' +
      'the verdict on the result and the earlier ones are void against a render that ' +
      'no longer exists.',
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the ride’s alternates — RIDE_PATTERNS[16] or the hat ' +
      'punctuation pool, FEATHER_VELOCITY, the swung-sixteenth template’s gain.bass ' +
      '(−19.5), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's fourth listening session, after the gain
    // raise its own hearing asked for — bossa-nova's second entry, and the feel's anchor
    // under the rule.
    //
    // groove-57 is bossa-nova's argmax: 30.0% of its bass note-time below MIDI 28,
    // against groove-58's 23.1%, and 12 of its 40 bass events under the old floor, the
    // lowest of them MIDI 25. What makes it the feel's sharpest case twice over is the
    // mix. bossa-nova puts its bass further under its kick than any other feel — a
    // median of −9.23 dB against half-time's −6.88, the next widest, so the gap is 2.35
    // dB wider than anywhere else in the registry — and groove-57 is the extreme of that
    // extreme at −10.72 dB, the widest single bass-under-kick gap in the catalogue. A
    // bass that has just dropped an octave, on the pack's quietest samples, under the
    // deepest kick in the registry: if the low register were going to disappear
    // anywhere, it is here.
    //
    // It is the groove that produced the epic's one balance change. Gate A heard it and
    // asked for a little more bass; bossa-nova's gain.bass went −23.2 → −22.2, all six
    // bossa grooves re-rendered, and session 4 approved the result. Gate A's words about
    // it are not quoted anywhere and cannot be: they were a complaint about the render
    // they were given on, and that render is gone. Session 3 played it as well, but the
    // mp3 on disk was still Track H's pre-raise pass, so those words describe audio that
    // exists nowhere either. Session 4 is the only valid approval for this entry.
    //
    // groove-58 keeps its entry beside this one — the clave-against-comp lock at 134 bpm
    // was its reason and is not this rule's. groove-53, -54, -55 and -56 are covered by
    // session 4's verdict and unpinned, and they moved with this groove because the knob
    // is per feel and the listener accepted that in writing.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-57.mp3, hashes to
    // 4ca2a621b6641396e373b3c28b0b5ad57b4e1419766ee5af95ca6576c27ee722 (716 007 bytes),
    // and this render reproduces it byte for byte.
    id: 'groove-57',
    pcm: 'ecdda52be74afe7328b2d0a239182140582e6611447310f22a6135c135b252ed',
    mp3: null,
    file: 'public/grooves/groove-57.mp3',
    approval: FEATURE_28_APPROVAL_GAIN,
    scope:
      FEATURE_28_SCOPE_GAIN +
      ' Two earlier verdicts on this groove exist and neither is quoted: gate A’s, which ' +
      'was the complaint this raise answered, and session 3’s, given while the file on ' +
      'disk was still the pre-raise render. An approval is something a person gave about ' +
      'a particular render, and both of those renders are gone.',
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the rim, kick and snare alternates — the bossa clave in ' +
      'bossa-nova’s figures block, its patterns pools for kick, hatClosed, bass, comp ' +
      'and snareGhosts, FILLS[bossa-nova], DEFAULT_PLACEMENT, or the template’s ' +
      'gain.bass (−22.2), its other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // Wave-5 pin it replaces was 352006cc…17a4. It keeps its place as bossa-nova's
    // anchor: the fastest of the six at 134 bpm, the top of the declared 122–138 range,
    // and the quietest comp against its kick, so the clave-against-comp lock shows here
    // first if it shows at all. It is also the feel that mixes its bass furthest under
    // the kick — −9.94 dB on this groove against a feel median of −9.23, the widest gap
    // in the registry by 2.35 dB over half-time's −6.88 — which makes it the one place a
    // picked, muted bass could read as thin rather than as supportive. Both figures moved
    // with feature-28: the floor took them down and the −22.2 raise brought them back up
    // 1.0 dB, and the numbers here are the second measurement, on the render pinned
    // below. groove-53, -54, -55 and -56 are covered by the same verdict and unpinned;
    // groove-57 has its own entry above, as this feel's anchor under the rule.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-58.mp3, hashes to
    // da9ff088a644ac7f34d39e9c30b99a7b05447b9c33e3457778405fffc9d0af56 (689 675 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it twice — once by the floor, once by bossa-nova's −22.2. The file played on
    // 2026-09-08, at the same path and the same byte length, is
    // 7cc6b04f74e339c9cf94f29b8027ce0733b9d36c938babea60afe301f574cd2b, and this render reproduces
    // that one.
    id: 'groove-58',
    pcm: 'fb261c62a2da452debf6c47f3037443610eb8cc3548768beaac6ba26c8d7f2f7',
    mp3: null,
    file: 'public/grooves/groove-58.mp3',
    approval: FEATURE_28_APPROVAL_LEGACY,
    scope: FEATURE_28_SCOPE_LEGACY,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the rim, kick and snare alternates — the bossa clave in ' +
      'bossa-nova’s figures block, its patterns pools for kick, hatClosed, bass, comp ' +
      'and snareGhosts, FILLS[bossa-nova], DEFAULT_PLACEMENT, or the template’s ' +
      'gain.bass (−22.2), its other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // Wave-5 pin it replaces was 13d8b7d9…cf93. It keeps its place as second-line's
    // anchor: it draws kit figure 3, the busiest of the four, at 26.750 events a bar,
    // the most of the six, and sits at the top of the tempo range at 96 bpm — the
    // densest reading of the one thing that feel's brief asks an ear to settle, whether
    // the snare reads as a figure or as clutter. It is also one of the two feels C7
    // gates: its bass-over-kick median of −5.59 dB has to stay inside 1.5 dB of
    // straight-funk's −5.55, and it measures 0.04 dB away. groove-66, -68, -69 and -70
    // are covered by the same verdict and unpinned; groove-67 has its own entry above, as
    // this feel's anchor under the rule.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-65.mp3, hashes to
    // 38d941842a2ef963ed123dad37cf95ebe8ddedb69eda5eb067c3b515bd80feef (961 767 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // 507966f1c02a15de4b66856087793aa2f9becc0dd2c8ef5f76e714515d7d154a, and this render reproduces that one.
    id: 'groove-65',
    pcm: 'f9a8601b0b6ef3b940c595f7ec1f167915075b14ae9d69922c4d03c341e668d9',
    mp3: null,
    file: 'public/grooves/groove-65.mp3',
    approval: FEATURE_28_APPROVAL_LEGACY,
    scope: FEATURE_28_SCOPE_LEGACY,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the snare and tom alternates — second-line’s patterns.kit, ' +
      'patterns.kick, patterns.bass or patterns.comp, FILLS[second-line], ' +
      'PLACEMENTS[second-line], or the template’s gain.bass (−22.2), its swing, its ' +
      'other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's third listening session — second-line's
    // second entry, and the feel's anchor under the rule.
    //
    // groove-67 is second-line's argmax: 36.8% of its bass note-time below MIDI 28,
    // against groove-69's 27.6%, and 16 of its 44 bass events under the old floor. It is
    // also the deepest bass in the whole catalogue on feature-27's threshold — 81.6% of
    // its note-time below MIDI 32, more than any other groove — so the two questions, the
    // register a picked flatwound differs in and the register this epic opened, pick the
    // same groove here. They rarely do, and the preamble says why they are not each
    // other's generalisation. Its bass is also the quietest post-gain in the feel at
    // −45.61 dBFS and sits −6.75 dB under its kick, the widest of the six against a feel
    // median of −5.59: deepest, quietest and most buried of the six at once.
    //
    // second-line is one of the two feels C7 gates. Its bass-over-kick median has to stay
    // inside 1.5 dB of straight-funk's, and it measures 0.04 dB away.
    //
    // groove-65 keeps its entry beside this one — kit figure 3's density at 96 bpm was
    // its reason and is not this rule's. groove-66, -68, -69 and -70 are covered by
    // session 3's verdict and unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-67.mp3, hashes to
    // fe6a3bfe8929b16215a7f86552ecaaf3e231151fcd1532d4026deee72c42dd7d (1 003 145
    // bytes), and this render reproduces it byte for byte.
    id: 'groove-67',
    pcm: '576a769ce17b0487f927ceba8aec464d3f6a44b6d17eaef68ab78157653e319a',
    mp3: null,
    file: 'public/grooves/groove-67.mp3',
    approval: FEATURE_28_APPROVAL_ANCHORS,
    scope: FEATURE_28_SCOPE_ANCHORS,
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the snare and tom alternates — second-line’s patterns.kit, ' +
      'patterns.kick, patterns.bass or patterns.comp, FILLS[second-line], ' +
      'PLACEMENTS[second-line], or the template’s gain.bass (−22.2), its swing, its ' +
      'other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // Wave-5 pin it replaces was fe7d8556…ef51. It keeps its place as boom-bap's anchor:
    // B phrygian lives or dies on a ♭2 that only the comp states, and this is the groove
    // feature-25's harmony re-gain was aimed at after the player said the comp was too
    // quiet. It is also the first of the six that earlier comp verdict was given on —
    // "groove 71-76". groove-73, -74, -75 and -76 are covered by the same verdict and
    // unpinned; groove-72 has its own entry below, as this feel's anchor under the rule.
    //
    // This entry guards the mix the player accepted, and it is the only one in the table
    // whose predecessor was explicitly rejected. Nothing pins the pre-re-gain render and
    // nothing should: it was heard and turned down. boom-bap is C7's other gated feel;
    // its bass-over-kick median of −5.51 dB sits 0.04 dB from straight-funk's −5.55.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-71.mp3, hashes to
    // 95fec4fca3aab9478f531ef82e91363e29b1227a416a72145d23c731d111daf0 (502 221 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // b270f88c9c7be6b6bda0fab430e10bb1a1b38439cfad7008ab599adcd02294be, and this render reproduces that one.
    id: 'groove-71',
    pcm: '119795914a2e14d21446a22d6511e7c06b45c7842b15a420ee27dd57b17bb6e1',
    mp3: null,
    file: 'public/grooves/groove-71.mp3',
    approval: FEATURE_28_APPROVAL_LEGACY,
    scope: FEATURE_28_SCOPE_LEGACY,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the kick and snare alternates — boom-bap’s patterns.kick, ' +
      'patterns.comp or patterns.snareGhosts, its swing (0.34) or tempoRange (86–92, ' +
      'the one field here that also moves the puzzle’s answer), DEFAULT_FILL, ' +
      'DEFAULT_PLACEMENT, or the template’s gain.bass (−23.4), its other gains, pan or ' +
      'humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's gate A — boom-bap's second entry, and the
    // feel's anchor under the rule.
    //
    // groove-72 is boom-bap's argmax and by the widest margin of any feel: 32.1% of its
    // bass note-time below MIDI 28 against groove-71's 14.3%, so no other groove of this
    // feel is close to the same test. 12 of its 38 bass events sit under the old floor.
    // boom-bap runs the quietest bass in the registry at −23.4, which makes the low
    // octave the place a note could simply fail to arrive — and yet this groove's bass
    // sits only −3.76 dB under its kick, the narrowest gap of the six against a feel
    // median of −5.51, so the register is more forward here than anywhere else in the
    // feel. It also carries six leaps of 18 semitones or more and one of 21, which is
    // what put it on gate A's list.
    //
    // Gate A played it, and nothing re-rendered it afterwards: neither gain raise touched
    // boom-bap, so the audio that answered the span question is the audio pinned here.
    //
    // groove-71 keeps its entry beside this one, and its reason is one this rule cannot
    // replace: it is the render whose predecessor was explicitly rejected, and the mix
    // the player accepted after feature-25's harmony re-gain. groove-73, -74, -75 and -76
    // are covered by gate A's verdict and unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-72.mp3, hashes to
    // 17e4ceac2362e694c877da135c42963c232e55bb41c6340b1e73df66a603b71c (519 148 bytes),
    // and this render reproduces it byte for byte.
    id: 'groove-72',
    pcm: '05f7fcdde819b2d755942cc98e9c964d0eae99eec61bca89e953cd79d24cd82c',
    mp3: null,
    file: 'public/grooves/groove-72.mp3',
    approval: FEATURE_28_APPROVAL_SPAN,
    scope: FEATURE_28_SCOPE_SPAN,
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the kick and snare alternates — boom-bap’s patterns.kick, ' +
      'patterns.comp or patterns.snareGhosts, its swing (0.34) or tempoRange (86–92, the ' +
      'one field here that also moves the puzzle’s answer), DEFAULT_FILL, ' +
      'DEFAULT_PLACEMENT, or the template’s gain.bass (−23.4), its other gains, pan or ' +
      'humanize block',
  },
  {
    // Pinned 2026-09-07 by feature-27 epic 1's listening pass — the first entry this
    // table has ever held for open-ballad, the last of the nine feels to get one, and
    // one of four feels pinned here for the first time.
    //
    // groove-78 anchors the feel's five because open-ballad is the one feel where the
    // instrument change may genuinely cost something, and this groove is the extreme of
    // it. A picked, muted flatwound decays faster than a plucked upright, so the
    // question is whether a long note still sustains or now stops short and leaves a
    // hole — and groove-78 carries the longest bass note in the whole catalogue at
    // 0.462 s, the fewest bass events of any groove at 20, and the slowest tempo at
    // 65 bpm. Nothing in the catalogue leaves a bass note more alone. It is also the
    // feel's quietest render at −26.09 dBFS, and the feel whose master RMS median fell
    // furthest on the swap, 0.96 dB against every other feel's 0.35 or less — a drop
    // that is consistent with less sustained energy in the loop rather than with a
    // mixing error, which is exactly what an ear has to confirm here.
    //
    // groove-49 stays unpinned although its register is deep (66.7% of bass note-time
    // below MIDI 32 — the most in the catalogue when feature-27 measured it, since
    // overtaken by groove-67's 81.6%, and no longer even this feel's widest
    // bass-under-kick gap, which is groove-51's −7.83 against groove-49's −6.67):
    // register is groove-01's question, decay is this feel's, and the entries are
    // chosen so the two are not both spent on the same measure. groove-49, -51 and -77
    // are covered by the same verdict and unpinned — by the verdict, not by this
    // hash. A change to the open-ballad template file moves all five and fails here; a
    // change to events.ts or a shared pattern pool can move them one at a time and leave
    // this entry green. See the preamble.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-78.mp3, hashes to
    // 0fcc08ca98db7e84bf6750e512be2f006caee09d4c24dd4d566a9e0ecf19f986 (710 364 bytes),
    // and that render reproduced it byte for byte on 2026-09-07. Feature-28 re-rendered
    // it: the file played on 2026-09-08, at the same path and the same byte length, is
    // 914649abe5576e9b277e91acf2fa86dff3ba004b69b93fbfbb151a7d36419487, and this render reproduces that one.
    id: 'groove-78',
    pcm: 'c30c0e2cdeb45514f658f583d0c54efdbde47e34f2c91c46b8af624a0c094ba1',
    mp3: null,
    file: 'public/grooves/groove-78.mp3',
    approval: FEATURE_28_APPROVAL_LEGACY,
    scope: FEATURE_28_SCOPE_LEGACY,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the tom and snare alternates — KICK_PATTERNS, HAT_PATTERNS, ' +
      'BASS_PATTERNS, COMP_PATTERNS, DEFAULT_PLACEMENT, DEFAULT_FILL, or the ' +
      'open-ballad template’s gain.bass (−22.0), its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-08 by feature-28 epic 1's gate A — open-ballad's second entry, and
    // the feel's anchor under the rule.
    //
    // groove-79 is open-ballad's argmax: 45.5% of its bass note-time below MIDI 28,
    // against groove-51's 36.4%, and 10 of its 22 bass events under the old floor. What
    // this feel does to a low note is leave it alone: 22 events at 68 bpm with a longest
    // note of 0.441 s, the second-longest in the catalogue, so nothing covers one that
    // stops short. Its low register is reached by degrees rather than by the tonic —
    // A♭1 is MIDI 32 — which is why it answers a different question from groove-78's: not
    // whether a long note still sustains, but whether the line still reads as one
    // instrument when it drops that far. It carries the widest leap in the catalogue,
    // 23 semitones inside one bar, tied with groove-20, and that is what put it on gate
    // A's list.
    //
    // Gate A played it, and nothing re-rendered it afterwards: neither gain raise touched
    // open-ballad, so the audio that answered the span question is the audio pinned here.
    //
    // groove-78 keeps its entry beside this one, on the decay question this feel put to
    // the new instrument. groove-49, -51 and -77 are covered by gate A's verdict and
    // unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-79.mp3, hashes to
    // 5cbf8cc890c942abc2bddeae42f9a14de50424437abb0a02731142cbc1e0fe4b (679 017 bytes),
    // and this render reproduces it byte for byte.
    id: 'groove-79',
    pcm: '295ebd0715b33a4d3f08f3becd3d3e35a0f47a86727d409e305ac24d11fd918a',
    mp3: null,
    file: 'public/grooves/groove-79.mp3',
    approval: FEATURE_28_APPROVAL_SPAN,
    scope: FEATURE_28_SCOPE_SPAN,
    upstream:
      'events.ts’s BASS_FLOOR_MIDI (25) — the constant feature-28 moved, and the first ' +
      'place to look when this fails — as much as samples/pack.json’s Pastabass ' +
      'tagliatelle set or the tom and snare alternates — KICK_PATTERNS, HAT_PATTERNS, ' +
      'BASS_PATTERNS, COMP_PATTERNS, DEFAULT_PLACEMENT, DEFAULT_FILL, or the ' +
      'open-ballad template’s gain.bass (−22.0), its other gains, pan or humanize block',
  },
]

// The entries whose pcm is deliberately null, in table order, and why. A pcm goes null
// only when the render that will ship does not exist yet — never to make this suite
// green over audio that moved. Empty on main: docs/architecture.md's "review only" is
// what holds that, because this repo has no CI and no pre-push hook and no test can know
// which branch it is on. Feature-28 R27.
const PENDING_SIGN_OFFS: readonly string[] = []

function voidSignOff(entry: SignOff): string {
  return [
    `${entry.id} no longer renders the audio a person heard and approved.`,
    `The words it was approved in were “${entry.approval}”.`,
    ...(entry.scope === undefined ? [] : [entry.scope]),
    `Something upstream of it moved — ${entry.upstream}.`,
    'The change may well be an improvement, but the sign-off it invalidates is a human’s ear',
    'and nothing in this repo can re-give it. Whatever sits at public/grooves/ may already have',
    'been overwritten by a re-render, so do not trust it as the approved audio; the render is',
    `reproducible from this tree instead — npm run grooves -- --only ${entry.id}`,
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

function pendingSignOff(entry: SignOff): string {
  return [
    `${entry.id} is a pending sign-off: it was played to a person and approved, and no`,
    'hash in this table stands behind its audio yet.',
    `The words it was approved in were “${entry.approval}”.`,
    ...(entry.scope === undefined ? [] : [entry.scope]),
    `It is waiting for ${entry.upstream}.`,
    'This is not a void pin. A void pin is a hash that no longer reproduces; this is a',
    'render nobody has hashed, because the render that will ship does not exist yet.',
    'Pinning it from the tree as it stands today would put a hash in this table for audio',
    'no player will ever hear, which is the one thing the table is for. When the render',
    `that ships exists — npm run grooves -- --only ${entry.id} — hash that, and fill this`,
    'field in. Nothing has to be listened to again; the approval above already covers it.',
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
    ).toEqual([
      'groove-01',
      'groove-03',
      'groove-07',
      'groove-08',
      'groove-14',
      'groove-17',
      'groove-28',
      'groove-38',
      'groove-40',
      'groove-44',
      'groove-48',
      'groove-50',
      'groove-57',
      'groove-58',
      'groove-65',
      'groove-67',
      'groove-71',
      'groove-72',
      'groove-78',
      'groove-79',
    ])
    for (const entry of SIGN_OFFS) {
      expect(entry.approval.length, `${entry.id} records no words it was approved in`).toBeGreaterThan(0)
      expect(entry.file.length, `${entry.id} names no file that was played`).toBeGreaterThan(0)
      expect(
        entry.scope?.length ?? 0,
        `${entry.id} records no scope — what the listener was asked and how far their words reach is the one thing this table cannot infer from a hash`,
      ).toBeGreaterThan(0)
      expect(
        entry.pcm === null || /^[0-9a-f]{64}$/.test(entry.pcm),
        `${entry.id}'s pcm is neither a sha256 nor null — a truncated or re-typed hash pins nothing`,
      ).toBe(true)
      if (entry.pcm === null) {
        expect(
          entry.mp3,
          `${entry.id} has no pcm hash but claims an encoded one — you cannot pin the bytes of a render whose audio was never hashed`,
        ).toBeNull()
      }
    }
  })

  it('names what every unpinned sign-off is waiting for', () => {
    const pending = SIGN_OFFS.filter((entry) => entry.pcm === null)

    expect(
      pending.map((entry) => entry.id),
      [
        'PENDING_SIGN_OFFS declares which entries are deliberately unpinned and the table',
        'disagrees with it. A pcm that went null without a line in that list is a hash that',
        'was deleted rather than deferred; a name in that list whose entry now carries a hash',
        'is a deferral that closed and was not written down. Reconcile the two — do not edit',
        'the list to match the table without knowing which of the two happened.',
      ].join('\n'),
    ).toEqual([...PENDING_SIGN_OFFS])

    for (const entry of pending) {
      expect(entry.upstream.length, `${entry.id} has a null pcm and names nothing it awaits`).toBeGreaterThan(0)
      expect(
        entry.upstream,
        `${entry.id}'s upstream does not name the feature whose render it awaits, so nothing here says when this null closes`,
      ).toMatch(/feature/i)
      process.stderr.write(`${pendingSignOff(entry)}\n`)
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

  // The guard the four feels pinned in feature-27 went without. The test above walks
  // riding templates only, so bossa-nova, second-line and boom-bap were unguarded until
  // feature-25 and straight-funk, half-time, bright-straight and open-ballad until
  // feature-27 — four template files a change to which voided no pin and failed nothing.
  // A tenth feel would arrive in the same state, so this asserts what the comment above
  // SIGN_OFFS now claims: every registered feel has a render somebody has heard.
  it('pins one signed-off render per registered feel', () => {
    const pinnedFeels = new Set(
      SIGN_OFFS.map((entry) => readCatalogue().find((g) => g.id === entry.id)!.template),
    )
    for (const template of allTemplates()) {
      expect(
        pinnedFeels.has(template.id),
        [
          `${template.id} is a registered feel and no entry in SIGN_OFFS pins one of its grooves.`,
          'So a change to its template file — a gain, a pattern, its swing — voids no',
          'sign-off and fails no test, which is the one property this table exists to',
          'hold. Play one of its grooves, get it approved, and add an entry — do not',
          'delete this test.',
        ].join('\n'),
      ).toBe(true)
    }
  })

  // Which groove of a feel is the one to pin, as a rule rather than as an argument. The
  // preamble above says why the argument it replaces was retracted: a pin covers the
  // audio of the groove it names and nothing else, so the anchor has to be the groove the
  // change under way moves furthest — and that is a measurement, not a choice.
  it('pins the groove that moved most in every registered feel', () => {
    const pinned = new Set(SIGN_OFFS.map((entry) => entry.id))

    for (const template of allTemplates()) {
      const ranking = lowRegisterRanking(template.id)

      expect(
        ranking.length,
        `${template.id} is a registered feel with no grooves in the catalogue, so this rule proves nothing about it`,
      ).toBeGreaterThan(0)

      expect(
        ranking[0].share,
        `${template.id}: every groove scores 0.0% of bass note-time below MIDI ${LOW_REGISTER_CEILING_MIDI} — this rule discriminates nothing, so the anchor below is picked by history rather than by the metric`,
      ).toBeGreaterThan(0)

      const runnersUp = ranking
        .slice(1, 4)
        .map((row) => `${row.id} at ${(row.share * 100).toFixed(1)}%`)
        .join(', ')

      expect(
        pinned.has(ranking[0].id),
        [
          `${ranking[0].id}, at ${(ranking[0].share * 100).toFixed(1)}% of its bass note-time below MIDI ${LOW_REGISTER_CEILING_MIDI},`,
          `is the groove that moved most in ${template.id} by the metric in ./lowRegister.ts,`,
          `and no entry in SIGN_OFFS pins it. Behind it: ${runnersUp}.`,
          'Play it, get it approved, and add an entry — do not delete this test, and do not',
          'soften it to "some pinned groove of this feel scores above zero": that is the',
          'prose feature-28 deleted, written as a test.',
        ].join('\n'),
      ).toBe(true)
    }
  })

  for (const entry of SIGN_OFFS) {
    describe(`${entry.id} — “${entry.approval}”`, () => {
      const signedOff = renderGroove(entry.id)

      if (entry.pcm !== null) {
        const pcm = entry.pcm
        it('renders the exact audio that was played to a person and approved', () => {
          expect(pcmSha256(signedOff.pcm), voidSignOff(entry)).toBe(pcm)
        })
      } else {
        it(`awaits the render that will ship — ${entry.upstream}`, () => {
          expect(entry.upstream.length, pendingSignOff(entry)).toBeGreaterThan(0)
        })
      }

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
