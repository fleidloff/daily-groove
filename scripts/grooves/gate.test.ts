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
   * The file that was played to a person. All twelve entries name the committed mp3
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

// One shared scope, because the account is the same for all twelve: the listening was
// per feel, the words were one sentence over all nine, and no groove was named. Twelve
// differently-worded scopes would read as twelve verdicts, and there was one. A later
// single-entry re-pin has to split this constant, and that visibility is deliberate.
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
  'file, one shared pack, so none of them can move without this one moving. On a riding ' +
  'feel that cuts one notch further — one groove of the feel was played, so the ride ' +
  'figure a given entry anchors is not necessarily the figure that was heard. What both ' +
  'passes were about is level: the new instrument in place at Track D’s nine ' +
  're-measured gain.bass values. The instrument itself was settled earlier and ' +
  'separately, on an A/B this table cannot hold (see the note above). Two measured ' +
  'questions remain open and neither was put to him, so “they all sound good” does not ' +
  'answer either: layer flicker at the 0.74 velocity boundary, and MIDI 46’s 3.9 dB ' +
  'alternate spread. Recorded in ' +
  'specs/features/feature-27/.implement/track-f.md.'

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
// approved. The coverage test below fails if a groove ever ships a figure no entry
// covers.
//
// For the three feels that play no ride and were added by feature-25, the compression is
// the ride rule's applied to the cause that actually moves them: one pin per feel. A
// feel's grooves render from one template file over one shared pack, so the unpinned ones
// cannot move without the pinned one moving too.
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
// as well as every ride figure. Twelve entries, nine feels, five ride figures.
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
    // changed. It spends 54.4% of its bass note-time below MIDI 32, the most of the six,
    // which is the register where a picked flatwound and a plucked upright differ most
    // and where the two largest velocity-layer steps sit; Track D measured 20 of its
    // bass events crossing a layer boundary at MIDI 28, joint worst in the catalogue
    // with groove-40. It is also the groove the instrument A/B was rendered from — the
    // one render in the catalogue whose old instrument a person heard back to back
    // against the new one — and straight-funk is the anchor feel whose bass-over-kick
    // median C7 measures boom-bap and second-line against.
    //
    // groove-22 stays unpinned although it is the loudest render in the catalogue at
    // −21.07 dBFS, 1.07 dB under the ceiling: that is a master-RMS property
    // catalogue-gate.test.ts already measures on all 54, and its bass visits the low
    // register least of the six at 15.4%. groove-02, -03, -04, -18 and -22 are covered
    // by the same verdict and unpinned; the six render from one template file over one
    // shared pack, so nothing that could move them moves without a failure here.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-01.mp3, hashes to
    // cbc4a5acef6989ce5995bcad06a034152d46d186c1132abf3dc2751dcf0c6526 (879 011 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-01',
    pcm: '88ed9ac89bd9740e286dcd684e79acd5aedfeb984aacde6d01d6f988b43cb147',
    mp3: null,
    file: 'public/grooves/groove-01.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the kick and snare alternates — KICK_PATTERNS, ' +
      'HAT_PATTERNS, BASS_PATTERNS, COMP_PATTERNS, DEFAULT_PLACEMENT, DEFAULT_FILL, or ' +
      'the straight-funk template’s gain.bass (−20.0), its other gains, pan or ' +
      'humanize block',
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
    // This is the only entry with a non-null encoded hash, re-taken on the encoder
    // SIGNED_OFF_ENCODER names, and it reproduces the file that was played,
    // public/grooves/groove-07.mp3 (1 014 430 bytes), byte for byte.
    id: 'groove-07',
    pcm: '93195b2b37eb47792c6f596d5ec5106f2849abfb721ac931a73b5fc97fe573b7',
    mp3: '5733b6540d8ea0f250d812e3b6d5ecaeec354b0a18d77b0224ebe84c40f45a7b',
    file: 'public/grooves/groove-07.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
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
    // nothing else pins. groove-19, groove-44 and groove-52 draw the same figure and are
    // unpinned; they share this feel and this template file, so nothing that could move
    // them moves without a failure here.
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
    // Pinned 2026-09-07 by feature-27 epic 1's listening pass — the first entry this
    // table has ever held for bright-straight, and one of four feels pinned here for the
    // first time.
    //
    // groove-17 anchors the feel's six because it is the most exposed bass in the feel on
    // both readings at once: 64 bass events, the most of the six, and a post-gain bass
    // sitting 2.08 dB under the kick, the narrowest gap of the six against a feel median
    // of −3.64 dB — this feel runs the quietest kick in the registry (−12), so its bass
    // is relatively forward to begin with. It is also the feel most at risk of
    // congestion rather than of a missing bass: bongos at −16/−15 and rim at −8 share
    // the midrange a pick attack now occupies, and groove-17 is the busiest low bass
    // line of the six at 126 bpm.
    //
    // groove-09, -10, -11, -12 and -21 are covered by the same verdict and unpinned; the
    // six render from one template file over one shared pack, so nothing that could move
    // them moves without a failure here.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-17.mp3, hashes to
    // 413a6966cf73f23cf8addcdfb004ee4e3e54b9d95ae9d5001f8b9830d134ab83 (732 934 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-17',
    pcm: 'd5572d54348d0b4c5d0c071844a5bfac85cb86c3cd1506f8f8ece61ef428077d',
    mp3: null,
    file: 'public/grooves/groove-17.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
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
    // than groove-50 anchors the figure. groove-50 draws the same figure and is
    // unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-28.mp3, hashes to
    // f692ba0c31bf795959a5864fe616c19ca29a884f7929ff1320e6c1fac3f141c5 (855 187 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-28',
    pcm: '1eca1ead95ce14e19edb9d0ef7ef3cf9ffbcdfee0f3846ab63a11b4f9bd726f1',
    mp3: null,
    file: 'public/grooves/groove-28.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — RIDE_PATTERNS[16] or the hat ' +
      'punctuation pool, FEATHER_VELOCITY, the swung-sixteenth template’s gain.bass ' +
      '(−20.7), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Pinned 2026-09-07 by feature-27 epic 1's listening pass — the first entry this
    // table has ever held for half-time, and one of four feels pinned here for the first
    // time.
    //
    // groove-38 anchors the feel's seven because it is the sharpest test of the one
    // question this feel puts to a bass: half-time sits under the loudest kick in the
    // registry (−7) and the risk is a bass that supports it or vanishes beneath it.
    // groove-38 has the widest post-gain bass-under-kick gap of the seven at −7.11 dB
    // (feel median −6.52), the joint-deepest register of the seven at 57.1% of bass
    // note-time below MIDI 32, and only 28 bass events at 78 bpm — so every note is long
    // and exposed, and nothing covers one that fails to speak. groove-46 is its near
    // twin (−7.08 dB, 57.1%, 28 events) and the pair is separated by 0.03 dB; groove-38
    // is taken on the wider gap, which is the measure the question is actually about.
    //
    // groove-13 stays unpinned although it is the quietest render in the catalogue
    // (−26.22 dBFS, 2.78 dB over the floor): that is a master-RMS property
    // catalogue-gate.test.ts already measures on all 54, and its bass visits the low
    // register least of the seven at 13.6%, so it tests the mix rather than the
    // instrument. groove-13, -14, -20, -46, -80 and -81 are covered by the same verdict
    // and unpinned; the seven render from one template file over one shared pack, so
    // nothing that could move them moves without a failure here.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-38.mp3, hashes to
    // 5ff7da60c4be871ea0138c920e594ac6afd4f87dd9157303c63f7d625b355daa (592 500 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-38',
    pcm: '125548fcb51acd6d9005be265cd4a77fc5863cec89e47e5dd7ca47013c1ba1f0',
    mp3: null,
    file: 'public/grooves/groove-38.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
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
    // boundary at MIDI 28 and 16 at MIDI 31, the worst in the catalogue.
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
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-40',
    pcm: '72e1e7489cd3de3f8e9b2c2c5213c3ddfe9fa37db706562282e278e5ba343985',
    mp3: null,
    file: 'public/grooves/groove-40.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — RIDE_PATTERNS[16] or the hat ' +
      'punctuation pool, FEATHER_VELOCITY, the swung-sixteenth template’s gain.bass ' +
      '(−20.7), its gain.comp, its other gains, pan or humanize block',
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
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-48',
    pcm: '6526ee231b70693cfdb8716fd03dd2e331fc45992f89264e8040524f939faf49',
    mp3: null,
    file: 'public/grooves/groove-48.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the ride’s alternates — RIDE_PATTERNS[16] or the hat ' +
      'punctuation pool, FEATHER_VELOCITY, the swung-sixteenth template’s gain.bass ' +
      '(−20.7), its gain.comp, its other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // Wave-5 pin it replaces was 352006cc…17a4. It keeps its place as bossa-nova's
    // anchor: the fastest of the six at 134 bpm, the top of the declared 122–138 range,
    // and the quietest comp against its kick, so the clave-against-comp lock shows here
    // first if it shows at all. It is also the feel that mixes its bass furthest under
    // the kick — 10.63 dB on this groove against a feel median of −9.81, the widest gap
    // in the registry by 3.3 dB — which makes it the one place a picked, muted bass
    // could read as thin rather than as supportive. groove-53 … groove-57 are covered by
    // the same verdict and unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-58.mp3, hashes to
    // da9ff088a644ac7f34d39e9c30b99a7b05447b9c33e3457778405fffc9d0af56 (689 675 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-58',
    pcm: '1b13cac08636d06f8f9cce78d553673a28722172cd3dd7d053c57e4706b8ea68',
    mp3: null,
    file: 'public/grooves/groove-58.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the rim, kick and snare alternates — the bossa clave in ' +
      'bossa-nova’s figures block, its patterns pools for kick, hatClosed, bass, comp ' +
      'and snareGhosts, FILLS[bossa-nova], DEFAULT_PLACEMENT, or the template’s ' +
      'gain.bass (−23.2), its other gains, pan or humanize block',
  },
  {
    // Re-pinned 2026-09-07 for feature-27 epic 1's bass swap, in the words below. The
    // Wave-5 pin it replaces was 13d8b7d9…cf93. It keeps its place as second-line's
    // anchor: it draws kit figure 3, the busiest of the four, at 26.750 events a bar,
    // the most of the six, and sits at the top of the tempo range at 96 bpm — the
    // densest reading of the one thing that feel's brief asks an ear to settle, whether
    // the snare reads as a figure or as clutter. It is also one of the two feels C7
    // gates: its bass-over-kick median of −5.16 dB has to stay inside 1.5 dB of
    // straight-funk's, and it measures 0.09 dB away. groove-66 … groove-70 are covered
    // by the same verdict and unpinned.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-65.mp3, hashes to
    // 38d941842a2ef963ed123dad37cf95ebe8ddedb69eda5eb067c3b515bd80feef (961 767 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-65',
    pcm: 'd568675dfa3f36b4dd0b5f92ba69204d195a2595061d4437887b49f998a7e832',
    mp3: null,
    file: 'public/grooves/groove-65.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the snare and tom alternates — second-line’s patterns.kit, ' +
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
    // "groove 71-76". groove-72 … groove-76 are covered by the same verdict and
    // unpinned.
    //
    // This entry guards the mix the player accepted, and it is the only one in the table
    // whose predecessor was explicitly rejected. Nothing pins the pre-re-gain render and
    // nothing should: it was heard and turned down. boom-bap is C7's other gated feel;
    // its bass-over-kick median of −5.19 dB sits 0.07 dB from straight-funk's.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-71.mp3, hashes to
    // 95fec4fca3aab9478f531ef82e91363e29b1227a416a72145d23c731d111daf0 (502 221 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-71',
    pcm: '5177f9e1ac93dcac09b4ec229d20f926cd961b28d1954f6a0e7bbbc9bd2f78cf',
    mp3: null,
    file: 'public/grooves/groove-71.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the kick and snare alternates — boom-bap’s patterns.kick, ' +
      'patterns.comp or patterns.snareGhosts, its swing (0.34) or tempoRange (86–92, ' +
      'the one field here that also moves the puzzle’s answer), DEFAULT_FILL, ' +
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
    // feel's quietest render at −26.07 dBFS, and the feel whose master RMS median fell
    // furthest on the swap, 0.96 dB against every other feel's 0.35 or less — a drop
    // that is consistent with less sustained energy in the loop rather than with a
    // mixing error, which is exactly what an ear has to confirm here.
    //
    // groove-49 stays unpinned although it is the feel's deepest register (66.7% of bass
    // note-time below MIDI 32, the most in the catalogue) and its widest bass-under-kick
    // gap: register is groove-01's question, decay is this feel's, and the entries are
    // chosen so the two are not both spent on the same measure. groove-49, -51, -77 and
    // -79 are covered by the same verdict and unpinned; the five render from one
    // template file over one shared pack, so nothing that could move them moves without
    // a failure here.
    //
    // mp3 stays null for the reason given on groove-40; the file that was played,
    // public/grooves/groove-78.mp3, hashes to
    // 0fcc08ca98db7e84bf6750e512be2f006caee09d4c24dd4d566a9e0ecf19f986 (710 364 bytes),
    // and this render reproduced it byte for byte on 2026-09-07.
    id: 'groove-78',
    pcm: 'a0394b6313048a5e37997093692ce796913ba1e32d05e36b017500806a6177f6',
    mp3: null,
    file: 'public/grooves/groove-78.mp3',
    approval: FEATURE_27_APPROVAL_PER_FEEL,
    scope: FEATURE_27_SCOPE,
    upstream:
      'samples/pack.json — the bass’s Pastabass tagliatelle set as much as the comp’s ' +
      'single dyn2 layer or the tom and snare alternates — KICK_PATTERNS, HAT_PATTERNS, ' +
      'BASS_PATTERNS, COMP_PATTERNS, DEFAULT_PLACEMENT, DEFAULT_FILL, or the ' +
      'open-ballad template’s gain.bass (−22.0), its other gains, pan or humanize block',
  },
]

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
      'groove-07',
      'groove-08',
      'groove-17',
      'groove-28',
      'groove-38',
      'groove-40',
      'groove-48',
      'groove-58',
      'groove-65',
      'groove-71',
      'groove-78',
    ])
    for (const entry of SIGN_OFFS) {
      expect(entry.approval.length, `${entry.id} records no words it was approved in`).toBeGreaterThan(0)
      expect(entry.file.length, `${entry.id} names no file that was played`).toBeGreaterThan(0)
      expect(
        entry.scope?.length ?? 0,
        `${entry.id} records no scope — what the listener was asked and how far their words reach is the one thing this table cannot infer from a hash`,
      ).toBeGreaterThan(0)
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
