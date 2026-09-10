import { describe, expect, it } from 'vitest'
import type { FeelTemplate, GrooveSpec, MusicMeta, NoteEvent, VoiceName } from './types.ts'
import type { Harmony } from './theory/harmony.ts'
import {
  BACKING_VOICES,
  BARS_PER_PASS,
  BONGO_LABEL,
  COMP_REGISTER_CEILING,
  COMP_REGISTER_LOW,
  DEFAULT_FILL,
  DEFAULT_PLACEMENT,
  FILLS,
  FILL_DURATIONS,
  GHOST_LABEL,
  GHOST_VELOCITY_THRESHOLD,
  HAT_ACCENTS,
  HAT_PUNCTUATION_PATTERNS,
  KIT_LABEL,
  MUSIC_LABEL,
  PATTERN_RESOLUTION,
  PLACEMENTS,
  RHYTHM_LABEL,
  RIDE_ACCENTS,
  RIDE_LABEL,
  RIDE_PATTERNS,
  RIDE_SUSTAIN_SIXTEENTHS,
  COMP_ACCENTS,
  VELOCITIES,
  assertFill,
  buildEvents,
  figureBars,
  gridSteps,
  middlePassOf,
  playedVoicing,
  voiceLead,
} from './events.ts'
import { FIGURE_BARS_PER_PASS, PATTERN_GRID } from './patterns.ts'
import { fixtureKey, readFixture, serialiseEvent, serialiseGroove } from './eventsFixture.ts'
import { intBetween, pick, rngFor } from './rng.ts'
import { readCatalogue } from './catalogue.ts'
import { ROOTS, pitchClassOf } from '../../src/lib/theory/roots.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { buildHarmony, pitchClassesOf } from './theory/harmony.ts'
import { pitchesOf, scaleName } from '../../src/lib/theory/scales.ts'
import { offScalePitches } from './theory/pitches.ts'

const template = templateById('straight-funk')
const UUID = '2368f779-9931-44ec-9c62-3146bf20736f'

const spec: GrooveSpec = { id: 'g1', uuid: UUID, template: 'straight-funk', seed: 1 }

const PITCHED = new Set(['bass', 'comp'])

// events.ts keeps this private. It is the step each comp voice below the top sits
// under the one above it.
const COMP_VOICE_DROP = 0.12

function isApproachNote(
  event: NoteEvent,
  music: MusicMeta,
  harmony: Harmony,
  feel: Pick<FeelTemplate, 'subdivision' | 'bassType'>,
): boolean {
  if (event.voice !== 'bass' || event.midi === undefined) return false
  const { subdivision } = feel
  const grid = Math.round(event.timeSec / (((60 / music.bpm) * 4) / subdivision))
  const approachStep =
    feel.bassType === 'walking-bass' ? (subdivision * 3) / 4 : subdivision - 1
  if (grid % subdivision !== approachStep) return false
  const chords = harmony.progressionMidi
  const bar = Math.floor(grid / subdivision)
  const rootAt = (b: number) => chords[(b % music.bars) % chords.length][0]
  if (rootAt(bar + 1) === rootAt(bar)) return false
  const distance = (((event.midi - rootAt(bar + 1)) % 12) + 12) % 12
  return Math.min(distance, 12 - distance) === 1
}

function compPitchClasses(chordMidi: number[], bassPitchClasses: Set<number>): number[] {
  const pc = (midi: number) => ((midi % 12) + 12) % 12
  const tones = [...new Set(chordMidi.map(pc))].sort((a, b) => a - b)
  const root = pc(chordMidi[0])
  if (tones.length >= 4 && bassPitchClasses.has(root)) return tones.filter((t) => t !== root)
  return tones
}

function stepSecFor(bpm: number): number {
  return ((60 / bpm) * 4) / template.subdivision
}

function barOf(event: NoteEvent, bpm: number): number {
  const step = Math.round(event.timeSec / stepSecFor(bpm))
  return Math.floor(step / template.subdivision)
}

function pairUp(
  a: NoteEvent[],
  b: NoteEvent[],
): { before: NoteEvent; after: NoteEvent }[] {
  const key = (e: NoteEvent) => `${e.voice}:${e.midi ?? '-'}`
  const groups = new Map<string, NoteEvent[]>()
  for (const event of b) {
    const list = groups.get(key(event)) ?? []
    list.push(event)
    groups.set(key(event), list)
  }
  const taken = new Map<string, number>()
  return a.map((before) => {
    const k = key(before)
    const index = taken.get(k) ?? 0
    taken.set(k, index + 1)
    const after = groups.get(k)?.[index]
    if (!after) throw new Error(`pairUp: nothing matches ${k}`)
    return { before, after }
  })
}

function isGhost(event: NoteEvent): boolean {
  return event.voice === 'snare' && event.velocity < GHOST_VELOCITY_THRESHOLD
}

function phraseBars(feel: FeelTemplate): Set<number> {
  const bars = new Set([(feel.passes - 1) * 4 + 3])
  const middle = middlePassOf(feel.passes)
  if (middle !== null) bars.add(middle * 4 + 3)
  return bars
}

function driftBoundFor(
  template: { humanize: { driftDepth: number } },
  music: { bpm: number; bars: number },
): number {
  const passSec = (music.bars * 4 * 60) / music.bpm
  return (template.humanize.driftDepth * passSec) / (2 * Math.PI)
}

describe('buildEvents — the grid', () => {
  it('keeps every onset inside its own subdivision of the stated tempo — AC13', () => {
    const { events, music } = buildEvents(spec, template)
    const step = stepSecFor(music.bpm)
    expect(events.length).toBeGreaterThan(0)
    const barsSeen = new Set<number>()
    for (const event of events) {
      expect(event.timeSec).toBeGreaterThanOrEqual(0)
      const steps = event.timeSec / step
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(0.5)
      barsSeen.add(Math.floor(Math.round(steps) / template.subdivision))
    }
    expect([...barsSeen].sort((a, b) => a - b)).toEqual(
      Array.from({ length: music.loopBars }, (_, bar) => bar),
    )
  })

  it('keeps every event inside the loop, and fills it to the last bar', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { events, music } = buildEvents({ ...spec, seed }, template)
      const loopSec = (60 / music.bpm) * 4 * music.loopBars
      const barSec = (60 / music.bpm) * 4
      const end = Math.max(...events.map((e) => e.timeSec + e.durationSec))
      expect(end, `seed ${seed} spills past the loop`).toBeLessThanOrEqual(loopSec + 1e-9)
      expect(end, `seed ${seed} stops before its last bar`).toBeGreaterThan(loopSec - barSec)
    }
  })

  it('fits inside its loop at the chosen tempo', () => {
    const { events, music } = buildEvents(spec, template)
    expect(music.bars).toBe(4)
    const barSec = (60 / music.bpm) * 4
    const loopSec = barSec * music.loopBars
    const last = Math.max(...events.map((e) => e.timeSec))
    expect(last).toBeLessThan(loopSec)
    expect(last).toBeGreaterThan(loopSec - barSec)
  })

  it('chooses a tempo inside the template’s range', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { music } = buildEvents({ ...spec, seed }, template)
      expect(music.bpm).toBeGreaterThanOrEqual(template.tempoRange[0])
      expect(music.bpm).toBeLessThanOrEqual(template.tempoRange[1])
      expect(Number.isInteger(music.bpm)).toBe(true)
    }
  })

  it('spans a range of velocities, all inside 0..1 — R6, AC6', () => {
    const { events } = buildEvents(spec, template)
    const velocities = new Set(events.map((e) => e.velocity))
    expect(velocities.size).toBeGreaterThan(1)
    for (const velocity of velocities) {
      expect(velocity).toBeGreaterThan(0)
      expect(velocity).toBeLessThanOrEqual(1)
    }
  })

  it('gives every event a positive duration', () => {
    const { events } = buildEvents(spec, template)
    for (const event of events) expect(event.durationSec).toBeGreaterThan(0)
  })

  it('is sorted by time', () => {
    const { events } = buildEvents(spec, template)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].timeSec).toBeGreaterThanOrEqual(events[i - 1].timeSec)
    }
  })
})

describe('buildEvents — the instrumentation', () => {
  it('plays drums, a bass and a comp', () => {
    const { events } = buildEvents(spec, template)
    for (const voice of ['kick', 'bass', 'comp'] as const) {
      expect(events.some((e) => e.voice === voice)).toBe(true)
    }
  })

  it('plays every voice the template declares, and no other', () => {
    const { events } = buildEvents(spec, template)
    const played = new Set(events.map((e) => e.voice))
    for (const voice of template.voices) expect(played).toContain(voice)
    for (const voice of played) expect(template.voices).toContain(voice)
  })

  it('gives a midi pitch to pitched voices only', () => {
    const { events } = buildEvents(spec, template)
    for (const event of events) {
      if (PITCHED.has(event.voice)) {
        expect(typeof event.midi).toBe('number')
      } else {
        expect(event.midi).toBeUndefined()
      }
    }
  })

  it('keeps pitched notes inside the sample pack’s sampled range', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { events } = buildEvents({ ...spec, seed }, template)
      for (const event of events) {
        if (event.voice === 'bass') {
          expect(event.midi).toBeGreaterThanOrEqual(25)
          expect(event.midi).toBeLessThanOrEqual(48)
        }
        if (event.voice === 'comp') {
          expect(event.midi).toBeGreaterThanOrEqual(48)
          expect(event.midi).toBeLessThanOrEqual(84)
        }
      }
    }
  })

  it('bottoms out on the pack’s lowest sampled note, and still lifts C — R1, R2, AC1', () => {
    const bassMidis = readCatalogue().flatMap((groove) =>
      buildEvents(groove, templateById(groove.template))
        .events.filter((event) => event.voice === 'bass')
        .map((event) => event.midi as number),
    )
    expect(Math.min(...bassMidis), 'the floor is not the lowest sampled note').toBe(25)
    expect(
      bassMidis.filter((midi) => midi % 12 === 0 && midi < 36),
      'C no longer comes up an octave',
    ).toEqual([])
    expect(bassMidis, 'C2 is never played').toContain(36)
  })

  it('puts a C♯, D or E♭ root on the low string — R4, AC3', () => {
    const LOW_ROOTED = new Set(['C♯', 'D', 'E♭'])
    const found: string[] = []
    for (const groove of readCatalogue()) {
      const { events, music } = buildEvents(groove, templateById(groove.template))
      if (!LOW_ROOTED.has(music.root)) continue
      found.push(groove.id)
      const downbeat = events
        .filter((event) => event.voice === 'bass')
        .reduce((first, event) => (event.timeSec < first.timeSec ? event : first))
      const where = `${groove.id} rooted ${music.root}`
      expect(downbeat.midi, where).toBe(24 + pitchClassOf(music.root))
      expect(downbeat.midi, where).toBeGreaterThanOrEqual(25)
      expect(downbeat.midi, where).toBeLessThanOrEqual(27)
    }
    expect(found, 'the twelve low-rooted grooves').toEqual([
      'groove-03',
      'groove-09',
      'groove-14',
      'groove-17',
      'groove-18',
      'groove-19',
      'groove-40',
      'groove-42',
      'groove-50',
      'groove-51',
      'groove-53',
      'groove-73',
    ])
  })
})

describe('buildEvents — determinism', () => {
  it('builds the same events twice', () => {
    const first = buildEvents(spec, template)
    const second = buildEvents(spec, template)
    expect(first.events).toEqual(second.events)
    expect(first.music).toEqual(second.music)
  })

  it('builds different music for a different seed', () => {
    const a = buildEvents({ ...spec, seed: 1 }, template)
    const b = buildEvents({ ...spec, seed: 2 }, template)
    const differs =
      a.music.scale !== b.music.scale ||
      JSON.stringify(a.events) !== JSON.stringify(b.events)
    expect(differs).toBe(true)
  })

  it('derives the music from { template, seed }, not from the id', () => {
    const a = buildEvents({ id: 'groove-01', uuid: UUID, template: 'straight-funk', seed: 7 }, template)
    const b = buildEvents({ id: 'anything-else', uuid: UUID, template: 'straight-funk', seed: 7 }, template)
    expect(a).toEqual(b)
  })

  it('spreads eight seeds over more than one answer', () => {
    const answers = new Set(
      Array.from({ length: 8 }, (_, i) => {
        const { music } = buildEvents({ ...spec, seed: i + 1 }, template)
        return `${music.root} ${music.flavour}`
      }),
    )
    expect(answers.size).toBeGreaterThan(1)
  })

  it('reaches every flavour a template offers, across enough seeds', () => {
    for (const feel of allTemplates()) {
      const flavours = new Set(
        Array.from(
          { length: 200 },
          (_, i) =>
            buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed: i + 1 }, feel).music.flavour,
        ),
      )
      expect([...flavours].sort(), feel.id).toEqual([...feel.flavours].sort())
    }
  })
})

describe('buildEvents — the words match the notes', () => {
  const seeds = Array.from({ length: 24 }, (_, i) => i + 1)

  it('plays only pitches from the scale it names', () => {
    for (const seed of seeds) {
      const { events, music, harmony } = buildEvents({ ...spec, seed }, template)
      const scale = pitchesOf(music.root, music.flavour)
      expect(offScalePitches(events, music, harmony)).toEqual([])
      for (const event of events) {
        if (event.midi === undefined) continue
        if (isApproachNote(event, music, harmony, template)) continue
        expect(scale).toContain(event.midi % 12)
      }
    }
  })

  it('comps the named chord in bar 1', () => {
    for (const seed of seeds) {
      const { events, music, harmony } = buildEvents({ ...spec, seed }, template)
      const inBarOne = (e: NoteEvent) => barOf(e, music.bpm) === 0
      const barOne = events.filter((e: NoteEvent) => e.voice === 'comp' && inBarOne(e))
      expect(barOne.length).toBeGreaterThan(0)
      const played = [...new Set(barOne.map((e) => (e.midi as number) % 12))].sort(
        (a, b) => a - b,
      )
      expect(pitchClassesOf(music.chord)).toEqual(
        [...new Set(harmony.chordMidi.map((m) => m % 12))].sort((a, b) => a - b),
      )
      const bass = new Set(
        events
          .filter((e: NoteEvent) => e.voice === 'bass' && inBarOne(e))
          .map((e) => (e.midi as number) % 12),
      )
      expect(played).toEqual(compPitchClasses(harmony.chordMidi, bass))
    }
  })

  it('names the scale the way the app displays it', () => {
    const { music } = buildEvents(spec, template)
    expect(music.scale).toBe(scaleName(music.root, music.flavour))
    expect(music.chord.startsWith(music.root)).toBe(true)
    expect(music.progression.split('–')[0]).toBe(music.chord)
  })

  it('carries the degrees its progression was built from — R4, AC5', () => {
    for (const feel of allTemplates()) {
      const { music, harmony } = buildEvents({ ...spec, seed: 7 }, feel)
      expect(music.progressionDegrees, feel.id).toEqual(harmony.progressionDegrees)
      expect(music.progressionDegrees.length, feel.id).toBe(
        music.progression.split('–').length,
      )
      expect(music.progressionDegrees[0], feel.id).toBe(0)
    }
  })

  it('walks the bass through the progression’s chord tones', () => {
    for (const seed of seeds) {
      const { events, music, harmony } = buildEvents({ ...spec, seed }, template)
      const chords = music.progression.split('–')
      for (const event of events) {
        if (event.voice !== 'bass') continue
        if (isApproachNote(event, music, harmony, template)) continue
        const chord = chords[(barOf(event, music.bpm) % music.bars) % chords.length]
        expect(pitchClassesOf(chord)).toContain((event.midi as number) % 12)
      }
    }
  })

  it('chooses a flavour the template offers', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 40; seed++) {
        const { music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
        expect(feel.flavours, `${feel.id}:${seed}`).toContain(music.flavour)
      }
    }
  })
})

describe('buildEvents — the feel', () => {
  const straight = {
    ...template,
    swing: 0,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  }
  const swung = {
    ...template,
    swing: 0.35,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  }

  it('accents the backbeat and ghosts the off-beat sixteenths — R6, AC6', () => {
    const { events } = buildEvents(spec, template)
    const hats = events.filter((e) => e.voice === 'hatClosed')
    const snares = events.filter(
      (e) => e.voice === 'snare' && e.velocity >= GHOST_VELOCITY_THRESHOLD,
    )
    expect(hats.length).toBeGreaterThan(0)
    expect(snares.length).toBeGreaterThan(0)

    const meanHat = hats.reduce((sum, e) => sum + e.velocity, 0) / hats.length
    for (const snare of snares) {
      expect(snare.velocity, 'the backbeat is louder than the hats around it').toBeGreaterThan(
        meanHat,
      )
    }
    expect(
      hats.some((e) => e.velocity < GHOST_VELOCITY_THRESHOLD),
      'at least one hat is a ghost note',
    ).toBe(true)
  })

  it('displaces off-beat subdivisions later and leaves on-beats alone — R4, AC3', () => {
    const a = buildEvents(spec, straight)
    const b = buildEvents(spec, swung)
    expect(a.music.bpm).toBe(b.music.bpm)
    expect(a.events).toHaveLength(b.events.length)

    const step = stepSecFor(a.music.bpm)
    let moved = 0
    for (const { before, after } of pairUp(a.events, b.events)) {
      const onGrid = Math.round(before.timeSec / step)
      if (onGrid % 2 === 0) {
        expect(after.timeSec, `step ${onGrid} is on the beat`).toBeCloseTo(before.timeSec, 9)
      } else {
        expect(after.timeSec, `step ${onGrid} is off the beat`).toBeGreaterThan(before.timeSec)
        moved++
      }
    }
    expect(moved, 'the groove has off-beats to swing').toBeGreaterThan(0)
  })

  it('humanizes within the template’s declared bounds — R5, R7, AC5', () => {
    const flat = buildEvents(spec, { ...template, humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 } })
    const loose = buildEvents(spec, template)
    const bound = template.humanize.timingMs / 1000

    expect(bound, 'the shipped template declares real humanization').toBeGreaterThan(0)
    expect(template.humanize.velocity).toBeGreaterThan(0)

    let nudged = 0
    for (const { before, after } of pairUp(flat.events, loose.events)) {
      const timing = after.timeSec - before.timeSec
      const velocity = after.velocity - before.velocity
      const lean = Math.abs(template.humanize.lean[before.voice] ?? 0) / 1000
      const drift = driftBoundFor(template, loose.music)
      expect(Math.abs(timing)).toBeLessThanOrEqual(bound + lean + drift + 1e-9)
      expect(Math.abs(velocity)).toBeLessThanOrEqual(template.humanize.velocity + 1e-9)
      expect(after.velocity).toBeGreaterThan(0)
      expect(after.velocity).toBeLessThanOrEqual(1)
      if (timing !== 0) nudged++
    }
    expect(nudged).toBeGreaterThan(flat.events.length / 2)
  })

  it('draws its deviation from the seed, so the feel is reproducible — AC4', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const a = buildEvents({ ...spec, seed }, template)
      const b = buildEvents({ ...spec, seed }, template)
      expect(a.events).toEqual(b.events)
    }
  })
})

describe('buildEvents — the arrangement', () => {
  it('plays a backing band and nothing else — R8', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { events } = buildEvents({ ...spec, seed }, template)
      for (const event of events) {
        expect(BACKING_VOICES).toContain(event.voice)
      }
    }
  })

  it('keeps the comp below the soloist’s register and the bass below the comp — R8, R10', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const { events } = buildEvents({ ...spec, seed }, template)
      const comp = events.filter((e) => e.voice === 'comp')
      const bass = events.filter((e) => e.voice === 'bass')
      expect(comp.length).toBeGreaterThan(0)
      expect(bass.length).toBeGreaterThan(0)

      for (const event of comp) {
        expect(event.midi as number).toBeLessThan(COMP_REGISTER_CEILING)
      }
      const lowestComp = Math.min(...comp.map((e) => e.midi as number))
      for (const event of bass) {
        expect(event.midi as number).toBeLessThan(lowestComp)
      }
    }
  })
})

describe('buildEvents — every template renders', () => {
  const seeds = Array.from({ length: 8 }, (_, i) => i + 1)

  for (const feel of allTemplates()) {
    describe(feel.id, () => {
      it('renders a non-empty groove in its own flavours and tempo range', () => {
        for (const seed of seeds) {
          const { events, music } = buildEvents(
            { id: `groove-${seed}`, uuid: UUID, template: feel.id, seed },
            feel,
          )
          expect(events.length, `${feel.id}:${seed}`).toBeGreaterThan(0)
          expect(feel.flavours, `${feel.id}:${seed}`).toContain(music.flavour)
          expect(music.bpm, `${feel.id}:${seed}`).toBeGreaterThanOrEqual(feel.tempoRange[0])
          expect(music.bpm, `${feel.id}:${seed}`).toBeLessThanOrEqual(feel.tempoRange[1])
          expect(music.bars).toBe(4)
        }
      })

      it('plays every voice it declares, and no other', () => {
        for (const seed of seeds) {
          const { events } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          const played = new Set(events.map((e) => e.voice))
          for (const voice of feel.voices) expect(played, `${feel.id}:${seed}`).toContain(voice)
          for (const voice of played) expect(feel.voices, `${feel.id}:${seed}`).toContain(voice)
        }
      })

      it('keeps every event inside the loop, and fills it to the last bar', () => {
        for (const seed of seeds) {
          const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          const loopSec = (60 / music.bpm) * 4 * music.loopBars
          const barSec = (60 / music.bpm) * 4
          const end = Math.max(...events.map((e) => e.timeSec + e.durationSec))
          expect(end, `${feel.id}:${seed} spills past the loop`).toBeLessThanOrEqual(
            loopSec + 1e-9,
          )
          expect(end, `${feel.id}:${seed} stops before its last bar`).toBeGreaterThan(
            loopSec - barSec,
          )
        }
      })

      it('keeps every onset on its own grid, inside every bar of the loop', () => {
        for (const seed of seeds) {
          const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          const step = ((60 / music.bpm) * 4) / feel.subdivision
          const bars = new Set<number>()
          for (const event of events) {
            expect(event.timeSec, `${feel.id}:${seed}`).toBeGreaterThanOrEqual(0)
            expect(event.durationSec, `${feel.id}:${seed}`).toBeGreaterThan(0)
            const steps = event.timeSec / step
            expect(
              Math.abs(steps - Math.round(steps)),
              `${feel.id}:${seed} onset ${event.timeSec}`,
            ).toBeLessThan(0.5)
            bars.add(Math.floor(Math.round(steps) / feel.subdivision))
          }
          expect([...bars].sort((a, b) => a - b), `${feel.id}:${seed}`).toEqual(
            Array.from({ length: music.loopBars }, (_, bar) => bar),
          )
        }
      })

      it('keeps pitched notes inside the sample pack’s sampled range', () => {
        for (const seed of seeds) {
          const { events } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          for (const event of events) {
            if (event.voice === 'bass') {
              expect(event.midi, feel.id).toBeGreaterThanOrEqual(25)
              expect(event.midi, feel.id).toBeLessThanOrEqual(48)
            }
            if (event.voice === 'comp') {
              expect(event.midi, feel.id).toBeGreaterThanOrEqual(48)
              expect(event.midi, feel.id).toBeLessThanOrEqual(84)
            }
          }
        }
      })

      it('plays the harmony its metadata names', () => {
        for (const seed of seeds) {
          const { events, music, harmony } = buildEvents(
            { id: 'g', uuid: UUID, template: feel.id, seed },
            feel,
          )
          const chords = music.progression.split('–')
          const step = ((60 / music.bpm) * 4) / feel.subdivision
          const barOfEvent = (time: number) =>
            Math.floor(Math.round(time / step) / feel.subdivision)

          const barOneComp = events.filter(
            (e) => e.voice === 'comp' && barOfEvent(e.timeSec) === 0,
          )
          expect(barOneComp.length, `${feel.id}:${seed}`).toBeGreaterThan(0)
          const played = [...new Set(barOneComp.map((e) => (e.midi as number) % 12))].sort(
            (a, b) => a - b,
          )
          expect(pitchClassesOf(music.chord), `${feel.id}:${seed}`).toEqual(
            [...new Set(harmony.chordMidi.map((m) => m % 12))].sort((a, b) => a - b),
          )
          const barOneBass = new Set(
            events
              .filter((e) => e.voice === 'bass' && barOfEvent(e.timeSec) === 0)
              .map((e) => (e.midi as number) % 12),
          )
          expect(played, `${feel.id}:${seed}`).toEqual(
            compPitchClasses(harmony.chordMidi, barOneBass),
          )

          for (const event of events) {
            if (event.voice !== 'bass') continue
            if (isApproachNote(event, music, harmony, feel)) continue
            const chord =
              chords[(barOfEvent(event.timeSec) % music.bars) % chords.length]
            expect(
              pitchClassesOf(chord),
              `${feel.id}:${seed} bass over ${chord}`,
            ).toContain((event.midi as number) % 12)
          }
        }
      })

      it('is deterministic in { template, seed }', () => {
        const a = buildEvents({ id: 'one', uuid: UUID, template: feel.id, seed: 3 }, feel)
        const b = buildEvents({ id: 'another', uuid: UUID, template: feel.id, seed: 3 }, feel)
        expect(a).toEqual(b)
      })
    })
  }
})

describe('buildEvents — per-template placement', () => {
  function stepsOf(voice: string, feelId: string, seed: number) {
    const feel = templateById(feelId)
    const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feelId, seed }, feel)
    const step = ((60 / music.bpm) * 4) / feel.subdivision
    const phrased = phraseBars(feel)
    return events
      .filter((e) => e.voice === voice && e.velocity >= GHOST_VELOCITY_THRESHOLD)
      .map((e) => Math.round(e.timeSec / step))
      .filter((grid) => !phrased.has(Math.floor(grid / feel.subdivision)))
      .map((grid) => grid % feel.subdivision)
  }

  it('gives half-time a wide backbeat — one snare on beat three', () => {
    for (let seed = 1; seed <= 6; seed++) {
      expect([...new Set(stepsOf('snare', 'half-time', seed))], `seed ${seed}`).toEqual([8])
    }
  })

  it('keeps the straight feels on two and four', () => {
    for (const feelId of ['straight-funk', 'shuffle', 'bright-straight']) {
      const feel = templateById(feelId)
      const beats = [...new Set(stepsOf('snare', feelId, 1))].map(
        (step) => (step * 16) / feel.subdivision / 4,
      )
      expect(beats.sort(), feelId).toEqual([1, 3])
    }
  })

  it('never stacks two hits of one voice on the same step of a coarser grid', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 8; seed++) {
        const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
        const step = ((60 / music.bpm) * 4) / feel.subdivision
        const seen = new Set<string>()
        for (const event of events) {
          if (event.voice === 'comp') continue
          const key = `${event.voice}@${Math.round(event.timeSec / step)}`
          expect(seen.has(key), `${feel.id}:${seed} ${key}`).toBe(false)
          seen.add(key)
        }
      }
    }
  })
})

describe('buildEvents — the music stream is not the rhythm stream — R6, AC6', () => {
  it('labels the music stream with the frozen string "events"', () => {
    expect(MUSIC_LABEL).toBe('events')
  })

  it('draws the rhythm from a different label', () => {
    expect(RHYTHM_LABEL).not.toBe(MUSIC_LABEL)
  })

  it('gives the two labels unrelated sequences for the same spec', () => {
    const music = rngFor(`${spec.template}:${spec.seed}:${MUSIC_LABEL}`)
    const rhythm = rngFor(`${spec.template}:${spec.seed}:${RHYTHM_LABEL}`)
    const pairs = Array.from({ length: 10 }, () => [music(), rhythm()])
    for (const [a, b] of pairs) expect(a).not.toBe(b)
  })

  it('takes bpm, root, flavour and harmony from the music stream, in that order', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const feel = template
      const rng = rngFor(`${feel.id}:${seed}:${MUSIC_LABEL}`)
      const bpm = intBetween(rng, feel.tempoRange[0], feel.tempoRange[1])
      const root = pick(rng, ROOTS)
      const flavour = pick(rng, feel.flavours)
      const harmony = buildHarmony(root, flavour, rng)

      const { music } = buildEvents({ ...spec, seed }, feel)
      expect(music.bpm, `seed ${seed}`).toBe(bpm)
      expect(music.root, `seed ${seed}`).toBe(root)
      expect(music.flavour, `seed ${seed}`).toBe(flavour)
      expect(music.chord, `seed ${seed}`).toBe(harmony.chordName)
      expect(music.progression, `seed ${seed}`).toBe(harmony.progressionName)
    }
  })
})

describe('buildEvents — a groove is several passes of one figure — R3, R5, AC2, AC3, AC5', () => {
  function stepsOfLoop(events: NoteEvent[], bpm: number, subdivision: number) {
    const step = ((60 / bpm) * 4) / subdivision
    return events.map((e) => Math.round(e.timeSec / step))
  }

  // The figure a pass repeats is a rhythm and a harmony, and the two travel
  // together: every voice, the bass and the comp included, repeats its pitch bar
  // for bar as well as its position.
  function expectFigureRepeats(feel: FeelTemplate) {
    const isPitched = (key: string) => PITCHED.has(key.split('@')[0])
    const keyOf = (event: NoteEvent, step: number) =>
      `${event.voice}@${step}:${event.midi ?? '-'}`

    for (let seed = 1; seed <= 6; seed++) {
      const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
      const steps = stepsOfLoop(events, music.bpm, feel.subdivision)
      const phrased = phraseBars(feel)

      const byBar = new Map<number, string[]>()
      events.forEach((event, i) => {
        if (isGhost(event)) return
        const bar = Math.floor(steps[i] / feel.subdivision)
        const list = byBar.get(bar) ?? []
        list.push(keyOf(event, steps[i] % feel.subdivision))
        byBar.set(bar, list)
      })

      expect([...byBar.keys()].sort((a, b) => a - b), `${feel.id}:${seed}`).toEqual(
        Array.from({ length: music.loopBars }, (_, bar) => bar),
      )

      for (let bar = 4; bar < music.loopBars; bar++) {
        const where = `${feel.id}:${seed} bar ${bar}`
        const figure = [...(byBar.get(bar % 4) as string[])].sort()
        const here = [...(byBar.get(bar) as string[])].sort()
        if (!phrased.has(bar)) {
          expect(here, where).toEqual(figure)
          continue
        }
        expect(here, `${where} carries no phrase`).not.toEqual(figure)
        expect(here.filter(isPitched), `${where} drops the harmony`).toEqual(
          figure.filter(isPitched),
        )
      }
    }
  }

  for (const feel of allTemplates()) {
    describe(feel.id, () => {
      it('spans its template’s declared pass count times four bars — AC2', () => {
        for (let seed = 1; seed <= 6; seed++) {
          const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          expect(music.bars, feel.id).toBe(4)
          expect(music.loopBars, feel.id).toBe(4 * feel.passes)

          const barSec = (60 / music.bpm) * 4
          const loopSec = barSec * music.loopBars
          const end = Math.max(...events.map((e) => e.timeSec + e.durationSec))
          expect(end, `${feel.id}:${seed} spills past the loop`).toBeLessThanOrEqual(
            loopSec + 1e-9,
          )
          expect(end, `${feel.id}:${seed} stops before its last bar`).toBeGreaterThan(
            loopSec - barSec,
          )
        }
      })

      it('plays the same figure in every bar but the ones a phrase replaces — AC3', () => {
        expectFigureRepeats(feel)
      })

      it('fills between the backbeats differently from bar to bar', () => {
        for (let seed = 1; seed <= 6; seed++) {
          const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          const steps = stepsOfLoop(events, music.bpm, feel.subdivision)

          const byBar = new Map<number, string[]>()
          events.forEach((event, i) => {
            if (!isGhost(event)) return
            const bar = Math.floor(steps[i] / feel.subdivision)
            const list = byBar.get(bar) ?? []
            list.push(String(steps[i] % feel.subdivision))
            byBar.set(bar, list)
          })

          const shapes = [...byBar.values()].map((list) => [...list].sort().join(','))
          expect(shapes.length, `${feel.id}:${seed} has no ghosts at all`).toBeGreaterThan(0)
          expect(
            new Set(shapes).size,
            `${feel.id}:${seed} plays one ghost figure in every bar`,
          ).toBeGreaterThan(1)
        }
      })

      it('repeats the harmony every four bars, so bar 5 carries bar 1’s chord — R5, AC5', () => {
        for (let seed = 1; seed <= 6; seed++) {
          const { events, music, harmony } = buildEvents(
            { id: 'g', uuid: UUID, template: feel.id, seed },
            feel,
          )
          const steps = stepsOfLoop(events, music.bpm, feel.subdivision)
          const barIn = (i: number) => Math.floor(steps[i] / feel.subdivision)

          const compIn = (bar: number) =>
            [
              ...new Set(
                events
                  .filter((_, i) => barIn(i) === bar && events[i].voice === 'comp')
                  .map((e) => (e.midi as number) % 12),
              ),
            ].sort((a, b) => a - b)

          const bassIn = (bar: number) =>
            new Set(
              events
                .filter((_, i) => barIn(i) === bar && events[i].voice === 'bass')
                .map((e) => (e.midi as number) % 12),
            )

          const barOne = compIn(0)
          expect(barOne.length, `${feel.id}:${seed}`).toBeGreaterThan(0)
          expect(barOne, `${feel.id}:${seed}`).toEqual(
            compPitchClasses(harmony.chordMidi, bassIn(0)),
          )
          for (let pass = 1; pass < feel.passes; pass++) {
            expect(compIn(pass * 4), `${feel.id}:${seed} bar ${pass * 4 + 1}`).toEqual(barOne)
          }
        }
      })
    })
  }
})

describe('buildEvents — every pass is a different take — R4, AC4', () => {
  function takesOf(feelId: string, seed: number) {
    const feel = templateById(feelId)
    const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feelId, seed }, feel)
    const step = ((60 / music.bpm) * 4) / feel.subdivision
    const stepsPerPass = feel.subdivision * 4

    const rows = Array.from(
      { length: feel.passes },
      () => [] as { key: string; timing: number; velocity: number }[],
    )
    for (const event of events) {
      if (isGhost(event)) continue
      const onGrid = Math.round(event.timeSec / step)
      if (Math.floor((onGrid % stepsPerPass) / feel.subdivision) === 3) continue
      rows[Math.floor(onGrid / stepsPerPass)].push({
        key: `${event.voice}@${onGrid % stepsPerPass}:${event.midi ?? '-'}`,
        timing: event.timeSec - onGrid * step,
        velocity: event.velocity,
      })
    }

    return rows.map((row) => {
      const sorted = [...row].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      return {
        grid: sorted.map((r) => r.key),
        timing: sorted.map((r) => r.timing),
        velocity: sorted.map((r) => r.velocity),
      }
    })
  }

  it('puts every pass on the same grid but plays none of them the same way', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 4; seed++) {
        const takes = takesOf(feel.id, seed)
        expect(takes.length, feel.id).toBe(feel.passes)

        for (let pass = 1; pass < takes.length; pass++) {
          const where = `${feel.id}:${seed} pass ${pass}`
          expect(takes[pass].grid, where).toEqual(takes[0].grid)
          expect(takes[pass].timing, where).not.toEqual(takes[0].timing)
          expect(takes[pass].velocity, where).not.toEqual(takes[0].velocity)
        }
      }
    }
  })

  it('draws each pass from its own generator, reproducibly', () => {
    for (const feel of allTemplates()) {
      const a = buildEvents({ id: 'one', uuid: UUID, template: feel.id, seed: 5 }, feel)
      const b = buildEvents({ id: 'another', uuid: UUID, template: feel.id, seed: 5 }, feel)
      expect(a.events, feel.id).toEqual(b.events)
    }
  })

  it('keeps every pass’s deviations inside the template’s declared bounds', () => {
    for (const feel of allTemplates()) {
      const flat = buildEvents(
        { id: 'g', uuid: UUID, template: feel.id, seed: 3 },
        { ...feel, humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 } },
      )
      const loose = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed: 3 }, feel)
      const bound = feel.humanize.timingMs / 1000
      expect(flat.events, feel.id).toHaveLength(loose.events.length)

      for (const { before, after } of pairUp(flat.events, loose.events)) {
        const lean = Math.abs(feel.humanize.lean[before.voice] ?? 0) / 1000
        const drift = driftBoundFor(feel, loose.music)
        expect(Math.abs(after.timeSec - before.timeSec), feel.id).toBeLessThanOrEqual(
          bound + lean + drift + 1e-9,
        )
        expect(
          Math.abs(after.velocity - before.velocity),
          feel.id,
        ).toBeLessThanOrEqual(feel.humanize.velocity + 1e-9)
      }
    }
  })
})

describe('buildEvents — ghosts and accents — R10, R11, R12', () => {
  const dry = (feel = template) => ({
    ...feel,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  })

  function placed(feel = dry(), seed = 1) {
    const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
    const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
    return events.map((event) => {
      const grid = Math.round(event.timeSec / stepSec)
      return {
        ...event,
        bar: Math.floor(grid / feel.subdivision),
        sixteenth: ((grid % feel.subdivision) * 16) / feel.subdivision,
      }
    })
  }

  it('plays snare ghost notes on off-beat sixteenths, below the ghost threshold — R10, AC9', () => {
    const ghosts = placed().filter(
      (e) =>
        e.voice === 'snare' && e.sixteenth % 2 === 1 && e.velocity < GHOST_VELOCITY_THRESHOLD,
    )
    expect(ghosts.length, 'the snare plays ghost notes between the backbeats').toBeGreaterThan(1)
  })

  it('keeps every backbeat snare louder than every ghost — R10, R12, AC9, AC11', () => {
    for (const feel of [template, dry()]) {
      const snares = placed(feel).filter((e) => e.voice === 'snare')
      const ghosts = snares.filter((e) => e.velocity < GHOST_VELOCITY_THRESHOLD)
      const backbeats = snares.filter((e) => e.velocity >= GHOST_VELOCITY_THRESHOLD)
      expect(ghosts.length).toBeGreaterThan(1)
      expect(backbeats.length).toBeGreaterThan(1)
      expect(Math.min(...backbeats.map((e) => e.velocity))).toBeGreaterThan(
        Math.max(...ghosts.map((e) => e.velocity)),
      )
    }
  })

  it('shapes the hats with an accent pattern, not metric position alone — R11, AC10', () => {
    const hats = placed().filter((e) => e.voice === 'hatClosed' && e.bar === 0)
    expect(hats.length).toBeGreaterThan(3)

    const classOf = (s: number) => (s % 4 === 0 ? 'strong' : s % 2 === 0 ? 'medium' : 'weak')
    const byClass = new Map<string, Set<number>>()
    for (const hat of hats) {
      const key = classOf(hat.sixteenth)
      if (!byClass.has(key)) byClass.set(key, new Set())
      byClass.get(key)!.add(hat.velocity)
    }
    const varied = [...byClass.values()].some((velocities) => velocities.size > 1)
    expect(varied, 'hats of one metric class carry more than one velocity').toBe(true)
  })

  it('leaves kick, snare and bass reading from metric position — R12, AC11', () => {
    for (const feel of allTemplates()) {
      const events = placed(dry(feel))
      for (const voice of ['kick', 'snare', 'bass'] as const) {
        const byStep = new Map<number, Set<number>>()
        for (const event of events) {
          if (event.voice !== voice) continue
          if (event.velocity < GHOST_VELOCITY_THRESHOLD) continue
          if (!byStep.has(event.sixteenth)) byStep.set(event.sixteenth, new Set())
          byStep.get(event.sixteenth)!.add(event.velocity)
        }
        for (const [step, velocities] of byStep) {
          expect(velocities.size, `${feel.id} ${voice}@${step}`).toBe(1)
        }
      }

      const struck = new Map<string, number[]>()
      for (const event of events) {
        if (event.voice !== 'comp') continue
        const key = `${event.bar}:${event.sixteenth}`
        struck.set(key, [...(struck.get(key) ?? []), event.velocity])
      }
      expect(struck.size, `${feel.id} never comps`).toBeGreaterThan(0)

      for (const [key, velocities] of struck) {
        const shape = [...velocities].sort((a, b) => a - b)
        expect(shape.length, `${feel.id} comp@${key}`).toBeGreaterThan(1)
        expect(new Set(shape).size, `${feel.id} comp@${key} is flat`).toBe(shape.length)
        const top = shape[shape.length - 1]
        const relative = shape.map((velocity) => velocity / top)
        const expected = shape.map((_, i) => 1 - COMP_VOICE_DROP * (shape.length - 1 - i))
        for (let i = 0; i < relative.length; i += 1) {
          expect(relative[i], `${feel.id} comp@${key} voice ${i + 1}`).toBeCloseTo(expected[i], 9)
        }
      }

      const bars = new Set(events.map((e) => e.bar))
      for (const bar of bars) {
        const snares = events.filter((e) => e.voice === 'snare' && e.bar === bar)
        expect(snares.length, `${feel.id} bar ${bar}`).toBeGreaterThan(1)
        const loudest = snares.reduce((a, b) => (b.velocity > a.velocity ? b : a))
        for (const snare of snares) {
          const where = `${feel.id} bar ${bar} @${snare.sixteenth}`
          if (snare.velocity === loudest.velocity) {
            expect(snare.sixteenth % 4, where).toBe(0)
          } else {
            expect(snare.velocity, where).toBeLessThan(loudest.velocity)
            expect(snare.sixteenth % 4, where).not.toBe(0)
          }
        }
      }
    }
  })
})

describe('buildEvents — hands and fingers — R3, R4, R5, R6, R7, R8, R8a', () => {
  const still = (feel = template) => ({
    ...feel,
    swing: 0,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  })

  const foldIndependently = (chord: number[]) =>
    chord
      .map((midi) => {
        let folded = midi
        while (folded >= COMP_REGISTER_CEILING) folded -= 12
        while (folded < COMP_REGISTER_LOW) folded += 12
        return folded
      })
      .sort((a, b) => a - b)

  const motion = (a: number[], b: number[]) => {
    const x = [...a].sort((p, q) => p - q)
    const y = [...b].sort((p, q) => p - q)
    let total = 0
    for (let i = 0; i < Math.min(x.length, y.length); i += 1) total += Math.abs(x[i] - y[i])
    return total
  }

  const pc = (midi: number) => ((midi % 12) + 12) % 12

  const interval = (a: number, b: number) => {
    const distance = pc(a - b)
    return Math.min(distance, 12 - distance)
  }

  function played(feel = still(), seed = 1) {
    const { events, music, harmony } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
    const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
    return {
      music,
      harmony,
      events: events.map((event) => {
        const grid = Math.round(event.timeSec / stepSec)
        return {
          ...event,
          bar: Math.floor(grid / feel.subdivision),
          step: grid % feel.subdivision,
        }
      }),
    }
  }

  function compChords(events: { voice: string; bar: number; step: number }[]) {
    const groups = new Map<string, typeof events>()
    for (const event of events) {
      if (event.voice !== 'comp') continue
      const key = `${event.bar}:${event.step}`
      const list = groups.get(key) ?? []
      list.push(event)
      groups.set(key, list)
    }
    return [...groups.values()]
  }

  it('seeds a voicing with the independent fold, so bar one is still the named chord — R3, AC4', () => {
    const cm7 = [60, 63, 67, 70]
    expect(voiceLead(null, cm7)).toEqual(foldIndependently(cm7))
    expect(voiceLead([], cm7)).toEqual(foldIndependently(cm7))
  })

  it('folds each tone to the octave nearest the previous voicing — R3, AC4', () => {
    const cm7 = [60, 63, 67, 70]
    const bFlat7 = [70, 74, 77, 80]
    const previous = voiceLead(null, cm7)
    const led = voiceLead(previous, bFlat7)

    expect(motion(previous, led)).toBeLessThan(motion(previous, foldIndependently(bFlat7)))
    expect(new Set(led.map(pc))).toEqual(new Set(bFlat7.map(pc)))
    for (const midi of led) {
      expect(midi).toBeGreaterThanOrEqual(COMP_REGISTER_LOW)
      expect(midi).toBeLessThan(COMP_REGISTER_CEILING)
    }
  })

  it('never moves further than the independent fold would, and moves less somewhere — R3, AC4', () => {
    let improved = false
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const { music, harmony } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
        const chords = harmony.progressionMidi
        let previous = voiceLead(null, chords[0])
        for (let bar = 1; bar < music.bars; bar += 1) {
          const chord = chords[bar % chords.length]
          const led = voiceLead(previous, chord)
          const independent = foldIndependently(chord)
          expect(
            motion(previous, led),
            `${feel.id}:${seed} bar ${bar + 1}`,
          ).toBeLessThanOrEqual(motion(previous, independent))
          if (motion(previous, led) < motion(previous, independent)) improved = true
          previous = led
        }
      }
    }
    expect(improved, 'voice-leading never beat the independent fold anywhere').toBe(true)
  })

  it('spreads a chord like a hand rather than stamping it — R4, AC5', () => {
    for (const feel of allTemplates()) {
      const { events } = played(still(feel))
      const chords = compChords(events as never)
      expect(chords.length, feel.id).toBeGreaterThan(0)
      for (const chord of chords as unknown as NoteEvent[][]) {
        expect(chord.length, feel.id).toBeGreaterThan(1)
        const times = chord.map((e) => e.timeSec)
        expect(new Set(times).size, `${feel.id} stamps a chord`).toBe(times.length)
        const span = Math.max(...times) - Math.min(...times)
        expect(span, feel.id).toBeGreaterThan(0)
        expect(span, `${feel.id} spreads a chord too far`).toBeLessThanOrEqual(0.015 + 1e-9)
        const byPitch = [...chord].sort((a, b) => (a.midi as number) - (b.midi as number))
        for (let i = 1; i < byPitch.length; i += 1) {
          expect(byPitch[i].timeSec, feel.id).toBeGreaterThan(byPitch[i - 1].timeSec)
        }
      }
    }
  })

  it('shapes a chord so the top voice sings and the inner voices sit under it — R5, AC6', () => {
    for (const feel of allTemplates()) {
      const { events } = played(still(feel))
      const chords = compChords(events as never)
      for (const chord of chords as unknown as NoteEvent[][]) {
        const byPitch = [...chord].sort((a, b) => (a.midi as number) - (b.midi as number))
        const velocities = byPitch.map((e) => e.velocity)
        expect(new Set(velocities).size, `${feel.id} plays a chord flat`).toBeGreaterThan(1)
        const top = velocities[velocities.length - 1]
        for (const velocity of velocities.slice(0, -1)) {
          expect(velocity, `${feel.id} buries its top voice`).toBeLessThan(top)
        }
      }
    }
  })

  it('drops the root of a four-note chord the bass is already sounding — R6, AC7', () => {
    const seventh = [60, 64, 67, 70]
    const voicing = voiceLead(null, seventh)
    expect(playedVoicing(voicing, seventh, [36])).toEqual(voicing.filter((m) => m % 12 !== 0))
    expect(playedVoicing(voicing, seventh, [40])).toEqual(voicing)
  })

  it('keeps a triad’s root — a triad minus its root is two notes — R6, AC7', () => {
    const triad = [60, 64, 67]
    const voicing = voiceLead(null, triad)
    expect(playedVoicing(voicing, triad, [36])).toEqual(voicing)
  })

  it('voices the whole loop rootless where the bass has the root, and never adds a tone — R6, AC7', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const { events, music, harmony } = played(still(feel), seed)
        const chords = harmony.progressionMidi
        for (let bar = 0; bar < music.loopBars; bar += 1) {
          const chord = chords[(bar % music.bars) % chords.length]
          const tones = new Set(chord.map(pc))
          const rootPc = pc(chord[0])
          const comp = new Set(
            events.filter((e) => e.voice === 'comp' && e.bar === bar).map((e) => pc(e.midi!)),
          )
          const bass = new Set(
            events.filter((e) => e.voice === 'bass' && e.bar === bar).map((e) => pc(e.midi!)),
          )
          const where = `${feel.id}:${seed} bar ${bar + 1}`
          for (const tone of comp) expect(tones, where).toContain(tone)
          if (tones.size >= 4 && bass.has(rootPc)) {
            expect(comp.has(rootPc), `${where} doubles the bass’s root`).toBe(false)
          } else {
            expect(comp.has(rootPc), `${where} lost its root`).toBe(true)
          }
        }
        expect(music.chord, feel.id).toBe(harmony.chordName)
        expect(music.progression, feel.id).toBe(harmony.progressionName)
      }
    }
  })

  it('plays a line, not an arpeggio: repeats, octaves and rests — R7, AC8', () => {
    for (const feel of allTemplates().filter((f) => f.bassType !== 'walking-bass')) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const { events, music, harmony } = played(still(feel), seed)
        const bass = events.filter((e) => e.voice === 'bass')
        const pitches = bass.map((e) => e.midi as number)
        const where = `${feel.id}:${seed}`

        expect(
          pitches.some((midi, i) => i > 0 && midi === pitches[i - 1]),
          `${where} never repeats a note`,
        ).toBe(true)
        expect(
          Math.max(...pitches) - Math.min(...pitches),
          `${where} stays inside one octave`,
        ).toBeGreaterThan(12)

        const chords = harmony.progressionMidi
        const rootAt = (b: number) => chords[(b % music.bars) % chords.length][0]
        const written = bass.filter(
          (e) => !(e.step === feel.subdivision - 1 && rootAt(e.bar + 1) !== rootAt(e.bar)),
        )
        const steps = new Set(written.map((e) => e.step))
        expect(written.length, `${where} rests nowhere`).toBeLessThan(
          steps.size * music.loopBars,
        )
      }
    }
  })

  it('walks into every chord change with a chromatic approach note — R8, AC9', () => {
    for (const feel of allTemplates()) {
      const approachStep =
        feel.bassType === 'walking-bass' ? (feel.subdivision * 3) / 4 : feel.subdivision - 1
      for (let seed = 1; seed <= 12; seed += 1) {
        const { events, music, harmony } = played(still(feel), seed)
        const chords = harmony.progressionMidi
        const rootAt = (bar: number) => chords[(bar % music.bars) % chords.length][0]
        const bass = events.filter((e) => e.voice === 'bass')
        let found = 0

        for (let bar = 0; bar < music.loopBars; bar += 1) {
          if (rootAt(bar + 1) === rootAt(bar)) continue
          const where = `${feel.id}:${seed} bar ${bar + 1}`
          const inBar = bass.filter((e) => e.bar === bar)
          expect(inBar.length, where).toBeGreaterThan(0)
          const last = inBar[inBar.length - 1]
          const nextRoot = rootAt(bar + 1)

          expect(last.step, `${where} approaches off the last step`).toBe(approachStep)
          expect(interval(last.midi as number, nextRoot), `${where} is not a semitone away`).toBe(1)

          const after = bass.find((e) => e.timeSec > last.timeSec) ?? bass[0]
          expect(pc(after.midi as number), `${where} resolves nowhere`).toBe(pc(nextRoot))
          found += 1
        }

        expect(found, `${feel.id}:${seed} never walks into a change`).toBeGreaterThan(0)
      }
    }
  })

  it('writes no approach note where the loop boundary is not a chord change — R8a', () => {
    let checked = 0
    for (let seed = 1; seed <= 24 && checked < 3; seed += 1) {
      const { events, music, harmony } = played(still(), seed)
      if (harmony.progressionDegrees[3] !== 0) continue
      checked += 1
      const chord = harmony.progressionMidi[0]
      const tones = new Set(chord.map(pc))
      const lastBar = music.loopBars - 1
      for (const event of events) {
        if (event.voice !== 'bass' || event.bar !== lastBar) continue
        expect(tones, `seed ${seed} bar ${lastBar + 1}`).toContain(pc(event.midi as number))
      }
    }
    expect(checked, 'no progression ending on the tonic in the first 24 seeds').toBeGreaterThan(0)
  })

  it('keeps the approach note inside the loop — R8a, AC9a', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
        const loopSec = (60 / music.bpm) * 4 * music.loopBars
        for (const event of events) {
          expect(event.timeSec, `${feel.id}:${seed}`).toBeLessThan(loopSec)
          expect(event.timeSec + event.durationSec, `${feel.id}:${seed}`).toBeLessThanOrEqual(
            loopSec + 1e-9,
          )
        }
      }
    }
  })

  it('plays no pitch its scale forbids but the one the approach note buys — R9, AC10', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const { events, music, harmony } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
        expect(offScalePitches(events, music, harmony), `${feel.id}:${seed}`).toEqual([])
      }
    }
  })
})

describe('buildEvents — the last pass ends with a fill — R5, R6, R7, R8, R9, R10', () => {
  const DRUMS = new Set<VoiceName>([
    'kick',
    'snare',
    'hatClosed',
    'hatOpen',
    'rim',
    'tomHigh',
    'tomLow',
  ])

  const TOMS = new Set<VoiceName>(['tomHigh', 'tomLow'])

  function drumBars(feel: FeelTemplate, seed = 1): string[][] {
    const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
    const step = ((60 / music.bpm) * 4) / feel.subdivision
    const bars: string[][] = Array.from({ length: music.loopBars }, () => [])
    for (const event of events) {
      if (!DRUMS.has(event.voice) || isGhost(event)) continue
      const grid = Math.round(event.timeSec / step)
      bars[Math.floor(grid / feel.subdivision)].push(`${event.voice}@${grid % feel.subdivision}`)
    }
    return bars.map((bar) => [...bar].sort())
  }

  function pitchedBars(feel: FeelTemplate, seed = 1): string[][] {
    const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
    const step = ((60 / music.bpm) * 4) / feel.subdivision
    const bars: string[][] = Array.from({ length: music.loopBars }, () => [])
    for (const event of events) {
      if (!PITCHED.has(event.voice)) continue
      const grid = Math.round(event.timeSec / step)
      bars[Math.floor(grid / feel.subdivision)].push(
        `${event.voice}@${grid % feel.subdivision}:${event.midi}`,
      )
    }
    return bars.map((bar) => [...bar].sort())
  }

  function distance(a: string[], b: string[]): number {
    const left = new Set(a)
    const right = new Set(b)
    return (
      [...left].filter((s) => !right.has(s)).length +
      [...right].filter((s) => !left.has(s)).length
    )
  }

  function voicesIn(bar: string[]): Set<string> {
    return new Set(bar.map((key) => key.split('@')[0]))
  }

  function tomStepsIn(bar: string[]): number[] {
    return [
      ...new Set(
        bar
          .filter((key) => TOMS.has(key.split('@')[0] as VoiceName))
          .map((key) => Number(key.split('@')[1])),
      ),
    ].sort((a, b) => a - b)
  }

  // The tom line one kit figure declares, resolved onto the feel's own grid.
  function kitTomSteps(feel: FeelTemplate, figure: { tomHigh?: number[]; tomLow?: number[] }) {
    return [
      ...new Set([
        ...gridSteps(figure.tomHigh ?? [], feel.subdivision),
        ...gridSteps(figure.tomLow ?? [], feel.subdivision),
      ]),
    ].sort((a, b) => a - b)
  }

  const fourPass = allTemplates().filter((feel) => feel.passes === 4)
  const twoPass = allTemplates().filter((feel) => feel.passes === 2)

  describe('middlePassOf — R8, AC6', () => {
    it('has no middle pass to mark below three passes', () => {
      expect(middlePassOf(0)).toBeNull()
      expect(middlePassOf(1)).toBeNull()
      expect(middlePassOf(2)).toBeNull()
    })

    it('marks the half-way pass, taking the earlier candidate on an even count', () => {
      expect(middlePassOf(3)).toBe(1)
      expect(middlePassOf(4)).toBe(1)
      expect(middlePassOf(5)).toBe(2)
      expect(middlePassOf(6)).toBe(2)
      expect(middlePassOf(7)).toBe(3)
    })

    it('never names the last pass, which carries the fill instead', () => {
      for (let passes = 3; passes <= 12; passes += 1) {
        const middle = middlePassOf(passes) as number
        expect(middle, `passes ${passes}`).toBeGreaterThanOrEqual(0)
        expect(middle, `passes ${passes}`).toBeLessThan(passes - 1)
      }
    })
  })

  describe('the fill — R5, R7, R10, AC4', () => {
    it('puts the fill in the last bar of the last pass and nowhere else', () => {
      for (const feel of fourPass) {
        const bars = drumBars(feel)
        const last = bars.length - 1
        const middleBar = (middlePassOf(feel.passes) as number) * 4 + 3

        expect(distance(bars[last], bars[3]), `${feel.id} last bar`).toBeGreaterThan(0)
        for (let bar = 0; bar < bars.length; bar += 1) {
          if (bar === last || bar === middleBar) continue
          expect(bars[bar], `${feel.id} bar ${bar}`).toEqual(bars[bar % 4])
        }
      }
    })

    // feature-25: the first claim is scoped to the kits that carry toms. bossa-nova
    // carries none — its turnaround is a push on the hands, not a tom roll — so a tom
    // in its fill would be the error, not the guarantee.
    //
    // The second claim used to be registry-wide: a tom sounds in the fill bar and
    // nowhere else. That was what "the toms are what marks a fill" looked like before a
    // style existed whose ordinary figure carries them. It is now scoped to the
    // templates it was written for — the ones that declare no tom line in patterns.kit
    // — and the third claim covers the rest positively: a template that declares one
    // plays exactly it in every ordinary bar and none at all in the variation. So a
    // leaked tom still fails, and so does a dropped or moved one.
    it('plays toms in the fill, and elsewhere only where a kit figure declares them — R10, R5', () => {
      const withToms = allTemplates().filter((feel) =>
        feel.voices.some((voice) => TOMS.has(voice)),
      )
      expect(
        withToms.length,
        'no template carries toms, so the fill claim checks nothing',
      ).toBeGreaterThan(0)

      for (const feel of withToms) {
        const bars = drumBars(feel)
        const last = bars.length - 1
        const toms = [...voicesIn(bars[last])].filter((voice) => TOMS.has(voice as VoiceName))
        expect(toms.sort(), `${feel.id} fill plays no tom`).toEqual(['tomHigh', 'tomLow'])
      }

      const declaresKitToms = (feel: FeelTemplate) =>
        (feel.patterns?.kit ?? []).some(
          (figure) => (figure.tomHigh ?? []).length + (figure.tomLow ?? []).length > 0,
        )

      for (const feel of allTemplates().filter((feel) => !declaresKitToms(feel))) {
        const bars = drumBars(feel)
        const last = bars.length - 1
        for (let bar = 0; bar < last; bar += 1) {
          for (const voice of voicesIn(bars[bar])) {
            expect(TOMS.has(voice as VoiceName), `${feel.id} bar ${bar} plays ${voice}`).toBe(
              false,
            )
          }
        }
      }

      for (const feel of allTemplates().filter(declaresKitToms)) {
        const bars = drumBars(feel)
        const last = bars.length - 1
        const middle = middlePassOf(feel.passes)
        const variation = middle === null ? -1 : middle * BARS_PER_PASS + BARS_PER_PASS - 1
        const declared = feel
          .patterns!.kit!.map((figure) => kitTomSteps(feel, figure).join(','))
          .filter((line) => line !== '')
        const sounded = tomStepsIn(bars[0]).join(',')
        expect(declared, `${feel.id} bar 0 sounds ${sounded}, which it never declared`).toContain(
          sounded,
        )

        for (let bar = 0; bar < last; bar += 1) {
          if (bar === variation) {
            expect(tomStepsIn(bars[bar]), `${feel.id} variation bar ${bar}`).toEqual([])
            continue
          }
          expect(tomStepsIn(bars[bar]).join(','), `${feel.id} bar ${bar}`).toBe(sounded)
        }
      }
    })

    it('leaves the bass and the comp playing, so the bar is still its chord — R5', () => {
      for (const feel of allTemplates()) {
        const bars = pitchedBars(feel)
        const last = bars.length - 1
        expect(bars[last].length, `${feel.id} drops the harmony in its fill bar`).toBeGreaterThan(
          0,
        )
        expect(bars[last], `${feel.id}`).toEqual(bars[last % 4])
      }
    })

    it('gives a template with no declaration of its own the default fill — R7, AC4', () => {
      const unknown: FeelTemplate = { ...templateById('straight-funk'), id: 'no-such-fill' }
      expect(FILLS[unknown.id]).toBeUndefined()
      expect(unknown.subdivision, 'the default is written on the sixteenth grid').toBe(16)

      const bars = drumBars(unknown)
      const played = new Map<string, number[]>()
      for (const key of bars[bars.length - 1]) {
        const [voice, step] = key.split('@')
        played.set(voice, [...(played.get(voice) ?? []), Number(step)])
      }
      for (const [voice, steps] of Object.entries(DEFAULT_FILL)) {
        expect([...(played.get(voice) ?? [])].sort((a, b) => a - b), voice).toEqual(steps)
      }
      expect([...played.keys()].sort()).toEqual(Object.keys(DEFAULT_FILL).sort())
    })
  })

  describe('assertFill — a fill may not name a pitched voice — quick-14', () => {
    it('rejects bass and comp, and takes every drum', () => {
      for (const voice of ['bass', 'comp'] as VoiceName[]) {
        expect(() => assertFill('t', 'fill', { [voice]: [0] }), voice).toThrow(
          new RegExp(`FILLS\\.fill names ${voice}`),
        )
        expect(() => assertFill('t', 'variation', { snare: [0], [voice]: [0] }), voice).toThrow(
          /root pitch/,
        )
      }
      const everyDrum = Object.fromEntries(
        (Object.keys(FILL_DURATIONS) as VoiceName[])
          .filter((voice) => voice !== 'bass' && voice !== 'comp')
          .map((voice) => [voice, [0]]),
      )
      expect(Object.keys(everyDrum).length, 'FILL_DURATIONS stopped naming every voice').toBe(13)
      expect(() => assertFill('t', 'fill', everyDrum)).not.toThrow()
    })

    it('guards every phrase the registry declares, and the default', () => {
      expect(() => assertFill('default', 'fill', DEFAULT_FILL)).not.toThrow()
      for (const [id, declared] of Object.entries(FILLS)) {
        expect(() => assertFill(id, 'fill', declared.fill), id).not.toThrow()
        const variation = declared.variation
        if (variation) {
          expect(() => assertFill(id, 'variation', variation), id).not.toThrow()
        }
      }
    })

    // The two above test the guard. This one tests that it is installed: buildEvents
    // reads FILLS by template id, so a phrase reaches the emission site through this
    // table and nowhere else. Without this, deleting both call sites keeps the suite
    // green and the trap stays open.
    it('stops buildEvents, not just a direct call', () => {
      const feel = templateById('bossa-nova')
      const spec: GrooveSpec = { id: 'g', uuid: UUID, template: feel.id, seed: 1 }
      const kept = FILLS[feel.id]
      expect(kept.variation, 'bossa-nova stopped declaring both phrases').toBeDefined()

      const cases = [
        { name: 'fill.comp', entry: { ...kept, fill: { ...kept.fill, comp: [0] } } },
        { name: 'variation.bass', entry: { ...kept, variation: { ...kept.variation, bass: [0] } } },
      ]

      for (const { name, entry } of cases) {
        try {
          FILLS[feel.id] = entry
          expect(() => buildEvents(spec, feel), name).toThrow(/may not name a pitched voice/)
        } finally {
          FILLS[feel.id] = kept
        }
      }

      expect(() => buildEvents(spec, feel), 'the table was not restored').not.toThrow()
    })
  })

  describe('every template fills — R6, AC5', () => {
    for (const feel of allTemplates()) {
      it(`${feel.id} ends on a phrase of its own`, () => {
        for (let seed = 1; seed <= 6; seed += 1) {
          const bars = drumBars(feel, seed)
          const last = bars.length - 1
          expect(bars[last].length, `${feel.id}:${seed} fills with nothing`).toBeGreaterThan(0)
          expect(
            distance(bars[last], bars[last % 4]),
            `${feel.id}:${seed} last bar is an ordinary bar`,
          ).toBeGreaterThan(0)
        }
      })
    }

    it('gives the sparsest feel the sparsest fill — R6', () => {
      const half = drumBars(templateById('half-time'))
      const funk = drumBars(templateById('straight-funk'))
      expect(half[half.length - 1].length).toBeLessThan(funk[funk.length - 1].length)
    })

    it('writes every declared phrase on the sixteenth grid, in ascending order', () => {
      const phrases = [DEFAULT_FILL, ...Object.values(FILLS).flatMap((e) => [e.fill, e.variation])]
      for (const phrase of phrases) {
        if (!phrase) continue
        for (const [voice, steps] of Object.entries(phrase)) {
          expect(BACKING_VOICES, `${voice} is not a voice`).toContain(voice)
          expect(steps.length, voice).toBeGreaterThan(0)
          expect([...steps].sort((a, b) => a - b), voice).toEqual(steps)
          expect(new Set(steps).size, voice).toBe(steps.length)
          for (const step of steps) {
            expect(step, voice).toBeGreaterThanOrEqual(0)
            expect(step, voice).toBeLessThan(16)
          }
        }
      }
    })
  })

  describe('the middle pass — R8, R10, AC6, AC8', () => {
    it('marks the last bar of the middle pass more lightly than the fill', () => {
      for (const feel of fourPass) {
        for (let seed = 1; seed <= 4; seed += 1) {
          const bars = drumBars(feel, seed)
          const last = bars.length - 1
          const middleBar = (middlePassOf(feel.passes) as number) * 4 + 3
          const ordinary = bars[middleBar % 4]

          const toFill = distance(bars[last], ordinary)
          const toVariation = distance(bars[middleBar], ordinary)
          expect(toVariation, `${feel.id}:${seed} does not mark its middle`).toBeGreaterThan(0)
          expect(
            toVariation,
            `${feel.id}:${seed} marks its middle as heavily as it fills`,
          ).toBeLessThan(toFill)
        }
      }
    })

    it('takes the toms out of the variation, which is what makes it lighter — R10', () => {
      for (const feel of fourPass) {
        const bars = drumBars(feel)
        const middleBar = (middlePassOf(feel.passes) as number) * 4 + 3
        for (const voice of voicesIn(bars[middleBar])) {
          expect(TOMS.has(voice as VoiceName), `${feel.id} variation plays ${voice}`).toBe(false)
        }
      }
    })

    it('adds nothing in its place when there is no middle pass — R8, AC6', () => {
      expect(twoPass.length, 'no two-pass template to check').toBeGreaterThan(0)
      for (const feel of twoPass) {
        expect(middlePassOf(feel.passes), feel.id).toBeNull()
        const bars = drumBars(feel)
        const last = bars.length - 1
        for (let bar = 0; bar < last; bar += 1) {
          expect(bars[bar], `${feel.id} bar ${bar}`).toEqual(bars[bar % 4])
        }
      }
    })
  })

  describe('nothing is written past the loop — R9, R13, AC7', () => {
    it('keeps every fill event inside the loop', () => {
      for (const feel of allTemplates()) {
        for (let seed = 1; seed <= 8; seed += 1) {
          const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          const loopSec = (60 / music.bpm) * 4 * music.loopBars
          for (const event of events) {
            expect(event.timeSec, `${feel.id}:${seed} ${event.voice}`).toBeLessThan(loopSec)
            expect(
              event.timeSec + event.durationSec,
              `${feel.id}:${seed} ${event.voice}`,
            ).toBeLessThanOrEqual(loopSec + 1e-9)
          }
        }
      }
    })

    it('has no crash to write there — the vocabulary holds none', () => {
      for (const voice of BACKING_VOICES) expect(voice).not.toMatch(/crash|cymbal/)
      for (const feel of allTemplates()) {
        const { events } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed: 1 }, feel)
        for (const event of events) expect(event.voice).not.toMatch(/crash|cymbal/)
      }
      const phrases = [DEFAULT_FILL, ...Object.values(FILLS).flatMap((e) => [e.fill, e.variation])]
      for (const phrase of phrases) {
        for (const voice of Object.keys(phrase ?? {})) {
          expect(voice).not.toMatch(/crash|cymbal/)
        }
      }
    })

    it('lets the ride onto the backing track, and nothing else new — R13, AC2', () => {
      expect(BACKING_VOICES).toContain('ride')
      for (const voice of ['rideBell', 'claves', 'cowbell'] as VoiceName[]) {
        expect(BACKING_VOICES, `${voice} is played by no template`).not.toContain(voice)
      }
    })
  })
})

describe('the feels Epic 6 added — R1, AC1', () => {
  const SAMPLE_RATE = 44100
  const OVERHANG_BARS = 1
  const NEW_FEELS = ['open-ballad', 'swung-sixteenth']

  it('registers both of them', () => {
    for (const id of NEW_FEELS) expect(templateById(id).id).toBe(id)
  })

  for (const id of NEW_FEELS) {
    describe(id, () => {
      const feel = templateById(id)

      it('renders a groove the gate accepts', async () => {
        const { loadPack } = await import('./pack.ts')
        const { renderVoices } = await import('./voices.ts')
        const { mixTracks } = await import('./mix.ts')
        const { gateCandidate } = await import('./gate.ts')
        const { fileURLToPath } = await import('node:url')
        const pack = await loadPack(fileURLToPath(new URL('./samples', import.meta.url)))

        for (const seed of [1, 2, 3]) {
          const spec: GrooveSpec = { id: `${id}-${seed}`, uuid: UUID, template: id, seed }
          const { events, music, harmony } = buildEvents(spec, feel)
          expect(events.length, `${id}:${seed} renders nothing`).toBeGreaterThan(0)

          const tracks = renderVoices(events, pack, SAMPLE_RATE, {
            id: spec.id,
            bars: music.loopBars,
            bpm: music.bpm,
            passes: music.loopBars / music.bars,
            overhangBars: OVERHANG_BARS,
          })
          const pcm = mixTracks(tracks, feel, { loopBars: music.loopBars, bpm: music.bpm })
          const failure = gateCandidate({ pcm, events, music, harmony, template: feel })
          expect(failure && `${failure.check}: ${failure.detail}`, `${id}:${seed}`).toBeNull()
        }
      })
    })
  }
})

describe('every template’s density band admits its own grooves', () => {
  for (const feel of allTemplates()) {
    it(`${feel.id} renders inside its declared band`, () => {
      let lowest = Infinity
      let highest = -Infinity
      for (let seed = 1; seed <= 120; seed += 1) {
        const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
        const perBar = events.length / music.loopBars
        lowest = Math.min(lowest, perBar)
        highest = Math.max(highest, perBar)
      }
      expect(lowest, `${feel.id} renders sparser than its floor`).toBeGreaterThanOrEqual(
        feel.density.minPerBar,
      )
      expect(highest, `${feel.id} renders denser than its ceiling`).toBeLessThanOrEqual(
        feel.density.maxPerBar,
      )
    })
  }
})

// quick-15 D1. Nothing else pins the decode: the bossa tests check that the pool holds
// two-bar figures and that bar 2 differs from bar 1, all of which a wrong bucketing —
// `step % 2`, say — would still satisfy.
describe('figureBars — a flat figure splits into the bars it names — quick-15', () => {
  it('reads bar from step >> 4 and position from step & 15', () => {
    expect(figureBars([0, 6, 12, 18, 22, 26], 8)).toEqual([
      [0, 3, 6],
      [1, 3, 5],
    ])
    expect(figureBars([2, 6, 12, 16, 28], 8)).toEqual([
      [1, 3, 6],
      [0, 6],
    ])
  })

  it('leaves a single-bar figure exactly as gridSteps left it', () => {
    for (const figure of [[0, 6, 12], [2, 8, 12], [0, 4, 8, 12], [3, 11]]) {
      expect(figureBars(figure, 8), `${figure}`).toEqual([gridSteps(figure, 8)])
      expect(figureBars(figure, 16), `${figure} at 16`).toEqual([gridSteps(figure, 16)])
    }
  })

  it('keeps the written order irrelevant and the bar count derived from the highest step', () => {
    expect(figureBars([26, 0, 18, 6], 8)).toEqual(figureBars([0, 6, 18, 26], 8))
    expect(figureBars([0, 16, 32, 48], 8)).toHaveLength(4)
    expect(figureBars([0, 15], 16)).toHaveLength(1)
    expect(figureBars([0, 16], 16)).toHaveLength(2)
  })

  it('grids each bar on its own, so a squashed collision cannot cross a barline', () => {
    // 5 and 6 both round to eighth-step 3 and dedupe; 21 and 22 are that pair one bar
    // up, and must dedupe within their own bar rather than against bar one's.
    expect(figureBars([5, 6, 21, 22], 8)).toEqual([[3], [3]])
  })
})

describe('buildEvents — the comp stops being perfect — R1, R2, R3, R4, R5, R6, R7, R8', () => {
  const dry = (feel: FeelTemplate = template): FeelTemplate => ({
    ...feel,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  })

  type Chord = {
    bar: number
    pass: number
    sixteenth: number
    notes: { midi: number; timeSec: number; velocity: number }[]
  }

  function compChords(feel: FeelTemplate = dry(), seed = 1): Chord[] {
    const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
    const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
    const groups = new Map<string, Chord>()

    for (const event of events) {
      if (event.voice !== 'comp') continue
      const grid = Math.round(event.timeSec / stepSec)
      const bar = Math.floor(grid / feel.subdivision)
      const step = grid % feel.subdivision
      const key = `${bar}:${step}`
      const chord =
        groups.get(key) ??
        ({
          bar,
          pass: Math.floor(bar / 4),
          sixteenth: (step * 16) / feel.subdivision,
          notes: [],
        } satisfies Chord)
      chord.notes.push({ midi: event.midi as number, timeSec: event.timeSec, velocity: event.velocity })
      groups.set(key, chord)
    }

    for (const chord of groups.values()) chord.notes.sort((a, b) => a.midi - b.midi)
    return [...groups.values()].sort((a, b) => a.bar - b.bar || a.sixteenth - b.sixteenth)
  }

  const topOf = (chord: Chord) => chord.notes[chord.notes.length - 1].velocity

  const classOf = (sixteenth: number) => sixteenth % 4

  // quick-15 D5. The cycle is five long and indexes the hit's position in the whole
  // phrase, so a two-bar figure gives its second bar a different shape from its first.
  // A per-bar restart would give both bars the same one, which is what this catches.
  it('runs COMP_ACCENTS across the whole phrase, not from zero each bar — quick-15', () => {
    const twoBar: FeelTemplate = {
      ...dry(),
      id: 'two-bar-comp',
      subdivision: 8,
      patterns: { comp: [[0, 4, 8, 16, 20, 24]] },
    }
    const chords = compChords(twoBar, 1).filter((chord) => chord.bar < 2)
    expect(chords, 'the phrase did not sound six chords over its two bars').toHaveLength(6)

    // All six sit on a quarter, so velocityFor hands every one the same `strong` base
    // and the ratios below are the accent and nothing else.
    expect(
      new Set(chords.map((chord) => chord.sixteenth % 4)),
      'the six hits do not share one metric class, so these ratios are not accents alone',
    ).toEqual(new Set([0]))

    const ratios = chords.map((chord) => topOf(chord) / topOf(chords[0]))
    for (const [i, ratio] of ratios.entries()) {
      expect(ratio, `hit ${i} takes COMP_ACCENTS[${i % COMP_ACCENTS.length}]`).toBeCloseTo(
        COMP_ACCENTS[i % COMP_ACCENTS.length] / COMP_ACCENTS[0],
        6,
      )
    }
    // The fifth hit is where the two readings part. Bar two's opening hit cannot tell
    // them apart — COMP_ACCENTS[3] and COMP_ACCENTS[0] are both 1.12 — but its second
    // hit is 0.88 continued against 1 restarted.
    expect(ratios[4], 'bar two restarted the cycle at COMP_ACCENTS[1]').not.toBeCloseTo(
      COMP_ACCENTS[1] / COMP_ACCENTS[0],
      6,
    )
  })

  it('leaves a one-bar comp figure indexing from zero in every bar — quick-15', () => {
    const oneBar: FeelTemplate = {
      ...dry(),
      id: 'one-bar-comp',
      subdivision: 8,
      patterns: { comp: [[0, 4, 8]] },
    }
    const chords = compChords(oneBar, 1)
    const barOne = chords.filter((chord) => chord.bar === 0).map(topOf)
    expect(barOne).toHaveLength(3)
    expect(
      chords.filter((chord) => chord.bar === 1).map(topOf),
      'a one-bar figure stopped repeating its accent shape bar to bar',
    ).toEqual(barOne)
  })

  it('strikes two chords of one step class differently — R1, R2, AC1, AC2', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const byClass = new Map<number, Set<number>>()
        for (const chord of compChords(dry(feel), seed)) {
          const key = classOf(chord.sixteenth)
          if (!byClass.has(key)) byClass.set(key, new Set())
          byClass.get(key)!.add(topOf(chord))
        }

        expect(byClass.size, `${feel.id}:${seed} never comps`).toBeGreaterThan(0)
        for (const [step, struck] of byClass) {
          expect(
            struck.size,
            `${feel.id}:${seed} strikes every comp chord at sixteenth ≡${step} the same way`,
          ).toBeGreaterThan(1)
        }
      }
    }
  })

  it('keeps the metric accent underneath the curve — R5, AC5', () => {
    const mean = { 0: [0, 0], 1: [0, 0] } as Record<0 | 1, [number, number]>
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        for (const chord of compChords(dry(feel), seed)) {
          const bucket = chord.sixteenth % 4 === 0 ? 0 : chord.sixteenth % 2 === 1 ? 1 : null
          if (bucket === null) continue
          mean[bucket][0] += topOf(chord)
          mean[bucket][1] += 1
        }
      }
    }

    expect(mean[0][1], 'no comp chord ever lands on a downbeat').toBeGreaterThan(0)
    expect(mean[1][1], 'no comp chord ever lands on an off-sixteenth').toBeGreaterThan(0)
    expect(
      mean[0][0] / mean[0][1],
      'the curve has replaced the metric accent rather than modulating it',
    ).toBeGreaterThan(mean[1][0] / mean[1][1])
  })

  it('reads the phrase from a different point in every pass — R4, R4a, AC4', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 6; seed += 1) {
        const chords = compChords(dry(feel), seed)
        const takes = Array.from({ length: feel.passes }, () => [] as number[])
        for (const chord of chords) takes[chord.pass].push(topOf(chord))

        expect(takes[0].length, `${feel.id}:${seed} plays no comp in pass 1`).toBeGreaterThan(0)
        for (let pass = 1; pass < feel.passes; pass += 1) {
          expect(
            takes[pass].join(','),
            `${feel.id}:${seed} plays pass ${pass + 1} exactly as it played pass ${pass}`,
          ).not.toBe(takes[pass - 1].join(','))
        }
      }
    }
  })

  it('renders the same velocities for the same template and seed — R3, AC3', () => {
    for (const feel of allTemplates()) {
      const velocities = (id: string) =>
        buildEvents({ id, uuid: UUID, template: feel.id, seed: 5 }, feel)
          .events.filter((event) => event.voice === 'comp')
          .map((event) => event.velocity)

      expect(velocities('again'), feel.id).toEqual(velocities('once'))
    }
  })

  it('draws the rotation from the pass index, not from a generator — R4a, AC3', () => {
    const original = Math.random
    Math.random = () => {
      throw new Error('buildEvents must not call Math.random')
    }
    try {
      for (const feel of allTemplates()) {
        expect(() =>
          buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed: 3 }, feel),
        ).not.toThrow()
      }
    } finally {
      Math.random = original
    }
  })

  const PRE_EPIC_COMP: Record<string, string> = {
    'groove-01': `
      0.285552/64/0.571429 0.286533/67/0.571429 0.294199/70/0.571429 1.582443/64/0.571429
      1.588972/67/0.571429 1.597130/70/0.571429 2.571989/62/0.571429 2.576707/67/0.571429
      2.584438/70/0.571429 3.864413/62/0.571429 3.870854/67/0.571429 3.877295/70/0.571429
      4.848683/62/0.571429 4.861803/65/0.571429 4.870749/69/0.571429 6.149957/62/0.571429
      6.154649/65/0.571429 6.160537/69/0.571429 7.132169/64/0.571429 7.135677/69/0.571429
      7.141287/72/0.571429 8.432420/64/0.571429 8.441472/69/0.571429 8.455354/72/0.571429
      9.427778/64/0.571429 9.439054/67/0.571429 9.441806/70/0.571429 10.738620/64/0.571429
      10.745413/67/0.571429 10.754196/70/0.571429 11.727640/62/0.571429 11.731584/67/0.571429
      11.734532/70/0.571429 13.013102/62/0.571429 13.027325/67/0.571429 13.030179/70/0.571429
      13.996767/62/0.571429 14.004748/65/0.571429 14.012691/69/0.571429 15.290332/62/0.571429
      15.299103/65/0.571429 15.305148/69/0.571429 16.281017/64/0.571429 16.293239/69/0.571429
      16.298546/72/0.571429 17.582964/64/0.571429 17.591935/69/0.571429 17.595311/72/0.571429
      18.578041/64/0.571429 18.578928/67/0.571429 18.582756/70/0.571429 19.876307/64/0.571429
      19.883188/67/0.571429 19.887746/70/0.571429 20.864387/62/0.571429 20.868356/67/0.571429
      20.875838/70/0.571429 22.162194/62/0.571429 22.168506/67/0.571429 22.175352/70/0.571429
      23.145851/62/0.571429 23.153261/65/0.571429 23.154924/69/0.571429 24.435445/62/0.571429
      24.444057/65/0.571429 24.452367/69/0.571429 25.423041/64/0.571429 25.432560/69/0.571429
      25.441063/72/0.571429 26.731155/64/0.571429 26.737156/69/0.571429 26.742265/72/0.571429
      27.717879/64/0.571429 27.724485/67/0.571429 27.735654/70/0.571429 29.026403/64/0.571429
      29.033197/67/0.571429 29.041293/70/0.571429 30.016127/62/0.571429 30.022553/67/0.571429
      30.026286/70/0.571429 31.304887/62/0.571429 31.309488/67/0.571429 31.315496/70/0.571429
      32.282015/62/0.571429 32.290534/65/0.571429 32.297205/69/0.571429 33.578451/65/0.571429
      33.579412/62/0.571429 33.587897/69/0.571429 34.560506/64/0.571429 34.564034/69/0.571429
      34.570933/72/0.571429 35.857904/64/0.571429 35.867043/69/0.571429 35.874373/72/0.571429
    `,
    'groove-13': `
      0.384345/66/0.759494 0.385894/75/0.759494 0.388263/71/0.759494 1.146819/66/0.759494
      1.149309/75/0.759494 1.154350/71/0.759494 1.907121/66/0.759494 1.909208/71/0.759494
      1.919955/75/0.759494 3.427186/68/0.759494 3.435567/73/0.759494 3.436062/64/0.759494
      4.193042/64/0.759494 4.194258/68/0.759494 4.202796/73/0.759494 4.956091/64/0.759494
      4.956977/68/0.759494 4.961363/73/0.759494 6.466356/64/0.759494 6.466732/69/0.759494
      6.470614/73/0.759494 7.218001/64/0.759494 7.224097/69/0.759494 7.226081/73/0.759494
      7.970871/64/0.759494 7.980302/69/0.759494 7.983273/73/0.759494 9.492969/64/0.759494
      9.497327/68/0.759494 9.500611/73/0.759494 10.250154/68/0.759494 10.256560/64/0.759494
      10.259078/73/0.759494 11.013776/68/0.759494 11.014182/64/0.759494 11.014512/73/0.759494
      12.537271/71/0.759494 12.539263/66/0.759494 12.548154/75/0.759494 13.304834/71/0.759494
      13.308253/66/0.759494 13.315976/75/0.759494 14.067153/66/0.759494 14.071964/75/0.759494
      14.075983/71/0.759494 15.583700/64/0.759494 15.593965/68/0.759494 15.599279/73/0.759494
      16.351719/64/0.759494 16.353995/68/0.759494 16.357000/73/0.759494 17.107990/64/0.759494
      17.109683/73/0.759494 17.110626/68/0.759494 18.606926/73/0.759494 18.609309/64/0.759494
      18.610682/69/0.759494 19.362522/64/0.759494 19.368339/69/0.759494 19.378850/73/0.759494
      20.121384/64/0.759494 20.125616/69/0.759494 20.126401/73/0.759494 21.636553/64/0.759494
      21.638992/68/0.759494 21.644882/73/0.759494 22.390063/73/0.759494 22.390148/64/0.759494
      22.393117/68/0.759494 23.149834/68/0.759494 23.152783/64/0.759494 23.152803/73/0.759494
    `,
    // groove-49's block regenerated by quick-18, which changed this feel's comp figures.
    // The claim is unaffected — these are timings, pitches and durations, and the test
    // asserts humanize leaves all three alone — but the literal is a record of what the
    // generator builds, so it moves whenever the notes do.
    'groove-49': `
      0.000000/66/0.845070 0.000648/70/0.845070 0.009736/74/0.845070 1.274008/66/0.845070
      1.275408/70/0.845070 1.286699/74/0.845070 2.118434/66/0.845070 2.126552/70/0.845070
      2.136596/74/0.845070 3.819445/67/0.845070 3.831104/70/0.845070 3.838223/74/0.845070
      4.671248/67/0.845070 4.673208/70/0.845070 4.683769/74/0.845070 5.511563/67/0.845070
      5.516405/70/0.845070 5.522061/74/0.845070 6.770528/64/0.845070 6.775368/67/0.845070
      6.775968/70/0.845070 8.019642/64/0.845070 8.022232/67/0.845070 8.028190/70/0.845070
      8.855027/64/0.845070 8.858151/67/0.845070 8.865786/70/0.845070 10.546083/66/0.845070
      10.547695/70/0.845070 10.552547/74/0.845070 11.386336/66/0.845070 11.394849/70/0.845070
      11.401991/74/0.845070 12.232884/66/0.845070 12.239134/70/0.845070 12.245384/74/0.845070
      13.519844/66/0.845070 13.524719/70/0.845070 13.527481/74/0.845070 14.794445/66/0.845070
      14.797770/70/0.845070 14.807575/74/0.845070 15.646584/66/0.845070 15.657123/70/0.845070
      15.667777/74/0.845070 17.351811/67/0.845070 17.358010/70/0.845070 17.364209/74/0.845070
      18.192645/67/0.845070 18.200460/70/0.845070 18.206641/74/0.845070 19.028916/67/0.845070
      19.039980/70/0.845070 19.046910/74/0.845070 20.285580/64/0.845070 20.290752/67/0.845070
      20.300994/70/0.845070 21.544579/64/0.845070 21.556826/67/0.845070 21.562994/70/0.845070
      22.388861/64/0.845070 22.396825/67/0.845070 22.403366/70/0.845070 24.072931/66/0.845070
      24.081544/70/0.845070 24.091077/74/0.845070 24.926102/66/0.845070 24.932549/70/0.845070
      24.937111/74/0.845070 25.774709/70/0.845070 25.776157/66/0.845070 25.783205/74/0.845070
    `,
  }

  it('moves the velocity and nothing else — R6, AC6', () => {
    const catalogue = readCatalogue()
    for (const [id, committed] of Object.entries(PRE_EPIC_COMP)) {
      const spec = catalogue.find((candidate) => candidate.id === id)
      expect(spec, `${id} has left the catalogue`).toBeDefined()
      const { events } = buildEvents(spec!, templateById(spec!.template))
      const rendered = events
        .filter((event) => event.voice === 'comp')
        .map(
          (event) =>
            `${event.timeSec.toFixed(6)}/${event.midi}/${event.durationSec.toFixed(6)}`,
        )

      expect(rendered.join(' '), id).toBe(committed.trim().split(/\s+/).join(' '))
    }
  })

  it('still rolls the chord and lets the top voice sing — R8, AC8', () => {
    for (const feel of allTemplates()) {
      for (const chord of compChords(dry(feel))) {
        const where = `${feel.id} bar ${chord.bar + 1} @${chord.sixteenth}`
        expect(chord.notes.length, where).toBeGreaterThan(1)

        for (let i = 1; i < chord.notes.length; i += 1) {
          expect(chord.notes[i].velocity, `${where} buries voice ${i + 1}`).toBeGreaterThan(
            chord.notes[i - 1].velocity,
          )
          expect(chord.notes[i].timeSec, `${where} stamps the chord`).toBeGreaterThan(
            chord.notes[i - 1].timeSec,
          )
        }
      }
    }
  })

  const PRE_EPIC_MUSIC: Record<string, string> = {
    'groove-01': 'C|mixolydian|C mixolydian|C7|C7–Em7♭5–B♭maj7–Fmaj7',
    'groove-02': 'E|dorian|E dorian|Em7|Em7–Bm7–C♯m7♭5',
    'groove-03': 'E♭|dorian|E♭ dorian|E♭m7|E♭m7–A♭7–Fm7',
    'groove-04': 'E|mixolydian|E mixolydian|E7|E7–Amaj7–Bm7–Amaj7',
    'groove-07': 'G|aeolian|G aeolian|Gm7|Gm7–B♭maj7–Cm7',
    'groove-08': 'F♯|aeolian|F♯ aeolian|F♯m7|F♯m7–Amaj7–A♭m7♭5',
    'groove-09': 'C♯|lydian|C♯ lydian|C♯maj7|C♯maj7–E♭7–Fm7–B♭m7',
    'groove-10': 'F|lydian|F lydian|Fmaj7|Fmaj7–Am7–G7–Dm7',
    'groove-11': 'B|ionian|B ionian|Bmaj7|Bmaj7–Emaj7–C♯m7',
    'groove-12': 'A|ionian|A ionian|Amaj7|Amaj7–A♭m7♭5–F♯m7',
    'groove-13': 'A♭|phrygian|A♭ phrygian|A♭m7|A♭m7–Amaj7–F♯m7–Amaj7',
    'groove-14': 'D|phrygian|D phrygian|Dm7|Dm7–Gm7–E♭maj7',
    'groove-17': 'D|lydian|D lydian|Dmaj7|Dmaj7–Bm7–E7',
    'groove-18': 'D|mixolydian|D mixolydian|D7|D7–Bm7–F♯m7♭5',
    'groove-19': 'C♯|aeolian|C♯ aeolian|C♯m7|C♯m7–A♭m7–B7',
    'groove-20': 'E|phrygian|E phrygian|Em7|Em7–Am7–Fmaj7–Dm7',
    'groove-21': 'C|ionian|C ionian|Cmaj7|Cmaj7–Bm7♭5–Dm7–Bm7♭5',
    'groove-22': 'A|dorian|A dorian|Am7|Am7–Cmaj7–D7',
    'groove-28': 'A|harmonic-major|A harmonic major|Amaj7|Amaj7–A♭dim7–Fdim7',
    'groove-34': 'B|phrygian-dominant|B phrygian dominant|B7|B7–EmMaj7–Am7',
    'groove-38': 'E|harmonic-minor|E harmonic minor|EmMaj7|EmMaj7–B7–Gmaj7♯5',
    'groove-40': 'E♭|phrygian-dominant|E♭ phrygian dominant|E♭7|E♭7–Bmaj7♯5–C♯m7–Gdim7',
    'groove-42': 'E♭|blues|E♭ blues|E♭7|E♭7–B♭7–A♭7–B♭7',
    'groove-44': 'F♯|blues|F♯ blues|F♯7|F♯7–C♯7–B7–C♯7',
    'groove-46': 'F♯|harmonic-minor|F♯ harmonic minor|F♯mMaj7|F♯mMaj7–A♭m7♭5–Fdim7',
    'groove-48': 'E|harmonic-major|E harmonic major|Emaj7|Emaj7–AmMaj7–Cdim7–F♯m7♭5',
    'groove-49': 'G|melodic-minor|G melodic minor|GmMaj7|GmMaj7–Em7♭5–C7',
    'groove-50': 'C♯|phrygian-dominant|C♯ phrygian dominant|C♯7|C♯7–Amaj7♯5–A♭m7♭5–Dmaj7',
    'groove-51': 'C♯|lydian-dominant|C♯ lydian dominant|C♯7|C♯7–Fm7♭5–Bmaj7♯5',
    'groove-52': 'F|blues|F blues|F7|F7–C7–B♭7–C7',
    'groove-53': 'E♭|melodic-minor|E♭ melodic minor|E♭mMaj7|E♭mMaj7–Cm7♭5–B♭7–Cm7♭5',
    'groove-54': 'C|melodic-minor|C melodic minor|CmMaj7|CmMaj7–F7–Am7♭5–F7',
    'groove-55': 'A♭|ionian|A♭ ionian|A♭maj7|A♭maj7–Gm7♭5–B♭m7–E♭7',
    'groove-56': 'E|lydian|E lydian|Emaj7|Emaj7–C♯m7–E♭m7–Emaj7',
    'groove-57': 'F|dorian|F dorian|Fm7|Fm7–Gm7–Dm7♭5–Fm7',
    'groove-58': 'E|melodic-minor|E melodic minor|EmMaj7|EmMaj7–Gmaj7♯5–E♭m7♭5–EmMaj7',
    'groove-65': 'A♭|harmonic-major|A♭ harmonic major|A♭maj7|A♭maj7–Cm7–B♭m7♭5–A♭maj7',
    'groove-66': 'G|harmonic-major|G harmonic major|Gmaj7|Gmaj7–CmMaj7–Bm7–CmMaj7',
    'groove-67': 'A♭|mixolydian|A♭ mixolydian|A♭7|A♭7–E♭m7–F♯maj7–E♭m7',
    'groove-68': 'E|blues|E blues|E7|E7–A7–B7–A7',
    'groove-69': 'G|ionian|G ionian|Gmaj7|Gmaj7–D7–Am7–Cmaj7',
    'groove-70': 'B|harmonic-major|B harmonic major|Bmaj7|Bmaj7–EmMaj7–C♯m7♭5–Gdim7',
    'groove-71': 'B|phrygian|B phrygian|Bm7|Bm7–F♯m7♭5–Gmaj7–Bm7',
    'groove-72': 'C|dorian|C dorian|Cm7|Cm7–Gm7–Am7♭5–Gm7',
    'groove-73': 'C♯|phrygian|C♯ phrygian|C♯m7|C♯m7–Amaj7–E7–Amaj7',
    'groove-74': 'A♭|dorian|A♭ dorian|A♭m7|A♭m7–F♯maj7–B♭m7–A♭m7',
    'groove-75': 'F|aeolian|F aeolian|Fm7|Fm7–E♭7–A♭maj7–Gm7♭5',
    'groove-76': 'F♯|phrygian|F♯ phrygian|F♯m7|F♯m7–Gmaj7–Bm7–A7',
    'groove-77': 'E|lydian-dominant|E lydian dominant|E7|E7–F♯7–BmMaj7–A♭m7♭5',
    'groove-78': 'F|lydian-dominant|F lydian dominant|F7|F7–Am7♭5–E♭maj7♯5–F7',
    'groove-79': 'A♭|lydian-dominant|A♭ lydian dominant|A♭7|A♭7–Dm7♭5–Cm7♭5–Dm7♭5',
    'groove-80': 'C|harmonic-minor|C harmonic minor|CmMaj7|CmMaj7–Bdim7–Fm7–E♭maj7♯5',
    'groove-81': 'A|harmonic-minor|A harmonic minor|AmMaj7|AmMaj7–Cmaj7♯5–Bm7♭5–Dm7',
    'groove-82': 'G|phrygian-dominant|G phrygian dominant|G7|G7–Fm7–CmMaj7–Fm7',
  }

  it('names the same music for every groove in the catalogue — R6, AC14', () => {
    const catalogue = readCatalogue()
    expect(catalogue.map((spec) => spec.id).sort()).toEqual(Object.keys(PRE_EPIC_MUSIC).sort())

    const perBar = (words: string) => {
      const parts = words.split('|')
      const chords = parts[4].split('–')
      parts[4] = Array.from({ length: 4 }, (_, bar) => chords[bar % chords.length]).join('–')
      return parts.join('|')
    }
    for (const spec of catalogue) {
      const { music } = buildEvents(spec, templateById(spec.template))
      const words = [music.root, music.flavour, music.scale, music.chord, music.progression]
      expect(perBar(words.join('|')), spec.id).toBe(perBar(PRE_EPIC_MUSIC[spec.id]))
    }
  })

  // The six feels that existed before feature-22 changed how the comp's velocity is
  // drawn. A feel registered after that change has no pre-epic mean and is skipped
  // below; the list is pinned by name so dropping one of the six still fails here.
  const PRE_EPIC_FEELS = [
    'bright-straight',
    'half-time',
    'open-ballad',
    'shuffle',
    'straight-funk',
    'swung-sixteenth',
  ]

  const PRE_EPIC_MEAN_VELOCITY: Record<string, number> = {
    'straight-funk': 0.498027,
    shuffle: 0.546318,
    'bright-straight': 0.589771,
    'half-time': 0.544377,
    // Re-measured for quick-18, which gave the feel its own comp pool — and read the
    // consequence rather than the number: this entry no longer checks what the others
    // do. The rest compare today's mean against the mean before feature-22, so they
    // would catch that change raising the comp. open-ballad's comp figures moved for an
    // unrelated reason, the old value fails by 5.0% against a 2% tolerance, and
    // re-pinning makes the comparison self-satisfied. It is kept as a tripwire on the
    // feel's centre, not as evidence for R7/AC7 — that guarantee is restated as a
    // dry-versus-humanized property in open-ballad.test.ts, which no pool change can
    // hollow out. The same treatment would retire all six pins; that is quick-16's.
    'open-ballad': 0.574226,
    'swung-sixteenth': 0.545409,
  }

  const MEAN_TOLERANCE = 0.02

  it('varies the comp around its centre rather than raising it — R7, AC7', () => {
    expect(
      Object.keys(PRE_EPIC_MEAN_VELOCITY).sort(),
      'a feel that predates feature-22 lost its committed mean',
    ).toEqual([...PRE_EPIC_FEELS].sort())

    for (const feel of allTemplates()) {
      const before = PRE_EPIC_MEAN_VELOCITY[feel.id]
      if (before === undefined) continue

      const comp = buildEvents(
        { id: 'g', uuid: UUID, template: feel.id, seed: 1 },
        feel,
      ).events.filter((event) => event.voice === 'comp')
      expect(comp.length, `${feel.id} never comps`).toBeGreaterThan(0)
      const after = comp.reduce((sum, event) => sum + event.velocity, 0) / comp.length

      expect(
        Math.abs(after / before - 1),
        `${feel.id} comps at ${after.toFixed(4)} where it used to comp at ${before}`,
      ).toBeLessThan(MEAN_TOLERANCE)
    }
  })
})

describe('the bongo — feature-13', () => {
  const BONGO_VOICES: VoiceName[] = ['bongoHigh', 'bongoLow']

  // Which feels carry bongos is a reading of their declared `voices`, never a list of
  // ids, so a second feel that takes them must cost no edit here. `bright-straight` is
  // the only one today: feature-25's son-montuno would have been the second and was
  // declined before it registered.
  const carriesBongo = (feel: FeelTemplate) =>
    BONGO_VOICES.some((voice) => feel.voices.includes(voice))

  // `eventsFor` renders a *committed* spec, so it can only be asked about a template
  // that has minted grooves. A feel registered ahead of its mint is not evidence of
  // anything either way, and the floor below stops that filter emptying the case.
  const minted = () => new Set(readCatalogue().map((groove) => groove.template))

  const BONGO_FEEL = 'bright-straight'

  function eventsFor(templateId: string) {
    const spec = readCatalogue().find((g) => g.template === templateId)!
    const template = templateById(templateId)
    return { ...buildEvents(spec, template), template, spec }
  }

  it('sounds on a feel that carries it, on both drums', () => {
    expect(carriesBongo(templateById(BONGO_FEEL)), `${BONGO_FEEL} dropped its bongos`).toBe(true)
    const { events } = eventsFor(BONGO_FEEL)
    const high = events.filter((e) => e.voice === 'bongoHigh')
    const low = events.filter((e) => e.voice === 'bongoLow')
    expect(high.length, 'no high bongo').toBeGreaterThan(0)
    expect(low.length, 'no low bongo').toBeGreaterThan(0)
    const total = high.length + low.length
    expect(high.length / total).toBeLessThan(0.8)
    expect(low.length / total).toBeLessThan(0.8)
  })

  it('costs the feels that do not carry it exactly nothing', () => {
    const committed = minted()
    const silent = allTemplates().filter(
      (feel) => !carriesBongo(feel) && committed.has(feel.id),
    )
    expect(
      silent.length,
      'no registered feel without bongos has a minted groove to render',
    ).toBeGreaterThan(0)

    for (const template of silent) {
      const { events } = eventsFor(template.id)
      expect(
        events.some((e) => e.voice === 'bongoHigh' || e.voice === 'bongoLow'),
        `${template.id} grew a bongo it never asked for`,
      ).toBe(false)
    }
  })

  it('is a colour rather than a pulse', () => {
    const { events, template } = eventsFor(BONGO_FEEL)
    const bongo = events.filter((e) => e.voice === 'bongoHigh' || e.voice === 'bongoLow')
    const bars = new Set(bongo.map((e) => Math.floor(e.timeSec / (240 / template.tempoRange[0] / 4))))
    expect(bongo.length / Math.max(bars.size, 1)).toBeLessThan(template.subdivision / 2)

    const stepSec = 60 / 100 / 4
    const onStrong = bongo.filter((e) => Math.round(e.timeSec / stepSec) % 4 === 0).length
    expect(onStrong).toBeLessThan(bongo.length - onStrong)
  })

  it('never marks every subdivision of a bar', () => {
    const { events, template, music } = eventsFor(BONGO_FEEL)
    const secPerBar = (60 / music.bpm) * 4
    const perBar = new Map<number, number>()
    for (const e of events) {
      if (!e.voice.startsWith('bongo')) continue
      const bar = Math.floor(e.timeSec / secPerBar)
      perBar.set(bar, (perBar.get(bar) ?? 0) + 1)
    }
    expect(perBar.size, 'the bongo plays no bar').toBeGreaterThan(0)
    for (const [bar, count] of perBar) {
      expect(count, `bar ${bar} is dense enough to be a pulse`).toBeLessThan(template.subdivision)
    }
  })

  it('is not struck flat', () => {
    const template = { ...templateById(BONGO_FEEL) }
    template.humanize = { ...template.humanize, velocity: 0 }
    const spec = readCatalogue().find((g) => g.template === BONGO_FEEL)!
    const events = buildEvents(spec, template).events.filter(
      (e) => e.voice === 'bongoHigh' || e.voice === 'bongoLow',
    )
    expect(new Set(events.map((e) => e.velocity)).size).toBeGreaterThan(1)
  })

  it('renders the same figure for the same seed', () => {
    const a = eventsFor(BONGO_FEEL).events.filter((e) => e.voice.startsWith('bongo'))
    const b = eventsFor(BONGO_FEEL).events.filter((e) => e.voice.startsWith('bongo'))
    expect(a.map((e) => [e.timeSec, e.velocity])).toEqual(b.map((e) => [e.timeSec, e.velocity]))
  })

  it('is struck softer than the snare, because a hand is not a stick', () => {
    const { events } = eventsFor(BONGO_FEEL)
    const loudest = (prefix: string) =>
      Math.max(...events.filter((e) => e.voice.startsWith(prefix)).map((e) => e.velocity))
    expect(loudest('bongo')).toBeLessThan(loudest('snare'))
  })
})


describe('a cymbal keeps the time — feature-24 epic-1', () => {
  const SHUFFLE = templateById('shuffle')

  const dryRide = (feel: FeelTemplate = SHUFFLE): FeelTemplate => ({
    ...feel,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  })

  function gridded(steps: number[], subdivision: number): number[] {
    const seen = new Set<number>()
    const out: number[] = []
    for (const source of [...steps].sort((a, b) => a - b)) {
      const step = Math.min(subdivision - 1, Math.round((source * subdivision) / 16))
      if (seen.has(step)) continue
      seen.add(step)
      out.push(step)
    }
    return out
  }

  function barsOf(feel: FeelTemplate, seed: number, spec = { template: feel.id }) {
    const built = buildEvents(
      { id: 'g', uuid: UUID, template: spec.template, seed },
      feel,
    )
    const stepSec = ((60 / built.music.bpm) * 4) / feel.subdivision
    const bars: { voice: VoiceName; step: number; velocity: number; durationSec: number }[][] =
      Array.from({ length: built.music.loopBars }, () => [])
    for (const event of built.events) {
      const grid = Math.round(event.timeSec / stepSec)
      bars[Math.floor(grid / feel.subdivision)].push({
        voice: event.voice,
        step: grid % feel.subdivision,
        velocity: event.velocity,
        durationSec: event.durationSec,
      })
    }
    return { bars, music: built.music, events: built.events }
  }

  const stepsIn = (bar: { voice: VoiceName; step: number }[], voice: VoiceName) =>
    bar.filter((e) => e.voice === voice).map((e) => e.step).sort((a, b) => a - b)

  describe('the foot hat — R18, R18b, AC9d', () => {
    it('holds three figures, every one of them on beats two and four', () => {
      expect(HAT_PUNCTUATION_PATTERNS).toHaveLength(3)
      for (const figure of HAT_PUNCTUATION_PATTERNS) {
        expect(figure, `${figure}`).toContain(4)
        expect(figure, `${figure}`).toContain(12)
      }
    })

    it('gives every figure two to four hits, ascending, unique, inside the bar', () => {
      for (const figure of HAT_PUNCTUATION_PATTERNS) {
        expect(figure.length, `${figure}`).toBeGreaterThanOrEqual(2)
        expect(figure.length, `${figure}`).toBeLessThanOrEqual(4)
        expect(new Set(figure).size, `${figure}`).toBe(figure.length)
        expect([...figure].sort((a, b) => a - b), `${figure}`).toEqual(figure)
        for (const step of figure) {
          expect(step, `${figure}`).toBeGreaterThanOrEqual(0)
          expect(step, `${figure}`).toBeLessThan(16)
        }
      }
    })

    it('picks the step the open hat vacates up in one of them — R18b', () => {
      expect(HAT_PUNCTUATION_PATTERNS.some((figure) => figure.includes(14))).toBe(true)
      expect(HAT_PUNCTUATION_PATTERNS[1]).toContain(14)
    })
  })

  describe('the ride pool and its own stream — R15, R16, R17, AC8, AC11', () => {
    it('draws on a label of its own', () => {
      expect(RIDE_LABEL).toBe('ride')
      for (const other of [MUSIC_LABEL, RHYTHM_LABEL, GHOST_LABEL, BONGO_LABEL]) {
        expect(RIDE_LABEL).not.toBe(other)
      }
    })

    it('holds three subdivision-8 figures, every one keeping every quarter — R16', () => {
      const pool = RIDE_PATTERNS[8] as number[][]
      expect(pool).toHaveLength(3)
      const quarters = [0, 2, 4, 6]
      for (const figure of pool) {
        const steps = gridded(figure, 8)
        for (const quarter of quarters) expect(steps, `${figure}`).toContain(quarter)
      }
    })

    it('is busier than the busiest foot hat — R16, AC11', () => {
      const busiestHat = Math.max(
        ...HAT_PUNCTUATION_PATTERNS.map((figure) => gridded(figure, 8).length),
      )
      const sparsestRide = Math.min(
        ...(RIDE_PATTERNS[8] as number[][]).map((figure) => gridded(figure, 8).length),
      )
      expect(sparsestRide).toBeGreaterThan(busiestHat)
    })

    it('accents on a shallow cycle of three, coprime with the bar — R17', () => {
      expect(RIDE_ACCENTS).toHaveLength(3)
      expect(4 % RIDE_ACCENTS.length).not.toBe(0)
      expect(Math.min(...RIDE_ACCENTS)).toBeGreaterThan(Math.min(...HAT_ACCENTS))
      expect(Math.max(...RIDE_ACCENTS)).toBeLessThanOrEqual(1)
    })

    it('rides busier than it hats, in every ordinary bar — AC11', () => {
      for (let seed = 1; seed <= 8; seed += 1) {
        const { bars } = barsOf(dryRide(), seed)
        for (let bar = 0; bar < bars.length; bar += 1) {
          if (bar === 15 || bar === 7) continue
          const ride = stepsIn(bars[bar], 'ride').length
          const hat = stepsIn(bars[bar], 'hatClosed').length
          expect(ride, `seed ${seed} bar ${bar}`).toBeGreaterThan(hat)
        }
      }
    })

    it('plays a pool member as its ride figure, in every ordinary bar at every seed — AC8', () => {
      const options = (RIDE_PATTERNS[8] as number[][]).map((figure) =>
        gridded(figure, SHUFFLE.subdivision).join(','),
      )
      for (let seed = 1; seed <= 8; seed += 1) {
        const { bars } = barsOf(dryRide(), seed)
        const drawn = new Set<string>()
        for (let bar = 0; bar < bars.length; bar += 1) {
          if (bar === 15 || bar === 7) continue
          const figure = stepsIn(bars[bar], 'ride').join(',')
          expect(
            options,
            `seed ${seed} bar ${bar} rides [${figure}], which is in no RIDE_PATTERNS member`,
          ).toContain(figure)
          drawn.add(figure)
        }
        expect(drawn.size, `seed ${seed} rides more than one figure over the loop`).toBe(1)
      }
    })

    it('re-rolls only the ride when the pool is reordered, for every feel that rides — AC8', () => {
      const feels = allTemplates().map((feel) => dryRide(feel))
      const riding = feels.filter((feel) => feel.voices.includes('ride'))
      expect(
        riding.length,
        'no feel rides, so reordering a pool could not move anything',
      ).toBeGreaterThan(0)

      const before = new Map<string, ReturnType<typeof barsOf>>()
      for (const feel of feels) {
        for (let seed = 1; seed <= 6; seed += 1) {
          before.set(`${feel.id}:${seed}`, barsOf(feel, seed))
        }
      }

      const strip = (built: ReturnType<typeof barsOf>) =>
        built.events.filter((e) => e.voice !== 'ride')

      for (const rider of riding) {
        const pool = RIDE_PATTERNS[rider.subdivision] as number[][] | undefined
        expect(
          pool,
          `${rider.id} rides on subdivision ${rider.subdivision}, which RIDE_PATTERNS does not stock`,
        ).toBeDefined()
        try {
          pool!.push(pool!.shift() as number[])
          let moved = 0
          for (const feel of feels) {
            for (let seed = 1; seed <= 6; seed += 1) {
              const was = before.get(`${feel.id}:${seed}`)!
              const after = barsOf(feel, seed)
              const where = `${feel.id} seed ${seed}, with ${rider.id}'s pool reordered`
              if (
                feel.id === rider.id &&
                stepsIn(after.bars[0], 'ride').join(',') !== stepsIn(was.bars[0], 'ride').join(',')
              ) {
                moved += 1
              }
              expect(strip(after), where).toEqual(strip(was))
              expect(after.music, where).toEqual(was.music)
            }
          }
          expect(
            moved,
            `reordering the subdivision-${rider.subdivision} pool moved no ride figure in ${rider.id}`,
          ).toBeGreaterThan(0)
        } finally {
          pool!.unshift(pool!.pop() as number[])
        }
      }
    })
  })

  describe('a riding feel swaps one pool for another — R18, R21b, AC9', () => {
    const synthetic: FeelTemplate = {
      ...SHUFFLE,
      id: 'test-ride',
      voices: [...SHUFFLE.voices.filter((v) => v !== 'hatOpen'), 'ride'],
    }

    it('reads the foot-hat pool where a straight feel reads the hat pool', () => {
      const options = HAT_PUNCTUATION_PATTERNS.map((figure) =>
        gridded(figure, synthetic.subdivision).join(','),
      )
      for (let seed = 1; seed <= 8; seed += 1) {
        const { bars } = barsOf(dryRide(synthetic), seed, { template: 'shuffle' })
        expect(options, `seed ${seed}`).toContain(stepsIn(bars[0], 'hatClosed').join(','))
      }
    })

    it('runs the hat accent cycle over the hits it plays, from index zero — R21b', () => {
      for (let seed = 1; seed <= 6; seed += 1) {
        const { bars } = barsOf(dryRide(synthetic), seed, { template: 'shuffle' })
        const hats = bars[0]
          .filter((e) => e.voice === 'hatClosed')
          .sort((a, b) => a.step - b.step)
        expect(hats.length).toBeGreaterThan(1)
        hats.forEach((hat, index) => {
          const sixteenth = (hat.step * 16) / synthetic.subdivision
          const shape =
            sixteenth % 4 === 0 ? 0.75 : sixteenth % 2 === 0 ? 0.45 : 0.32
          expect(hat.velocity, `seed ${seed} hat ${index}`).toBeCloseTo(
            shape * HAT_ACCENTS[index % HAT_ACCENTS.length],
            9,
          )
        })
      }
    })

    it('leaves a straight feel drawing exactly what it drew — AC10', () => {
      const funk = templateById('straight-funk')
      const { bars } = barsOf(dryRide(funk), 1)
      const hatPool = [
        [0, 2, 4, 6, 8, 10, 12, 14],
        Array.from({ length: 16 }, (_, i) => i),
        [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
      ].map((figure) => gridded(figure, funk.subdivision))
      const played = [
        ...stepsIn(bars[0], 'hatClosed'),
        ...stepsIn(bars[0], 'hatOpen'),
      ].sort((a, b) => a - b)
      expect(hatPool.map((f) => f.join(','))).toContain(played.join(','))
    })
  })

  describe('shuffle takes the ride and loses the open hat — R20, R21, AC7, AC9b', () => {
    it('re-kits the template and moves nothing else', () => {
      expect(SHUFFLE.voices).toContain('ride')
      expect(SHUFFLE.voices).toContain('hatClosed')
      expect(SHUFFLE.voices).not.toContain('hatOpen')
      expect(typeof SHUFFLE.gain.ride).toBe('number')
      expect(typeof SHUFFLE.pan.ride).toBe('number')
      expect(SHUFFLE.gain.hatOpen).toBeUndefined()
      expect(SHUFFLE.pan.hatOpen).toBeUndefined()
      expect(SHUFFLE.humanize.lean.hatOpen).toBeUndefined()
      expect(typeof SHUFFLE.humanize.lean.ride).toBe('number')

      expect(SHUFFLE.tempoRange).toEqual([78, 92])
      expect(SHUFFLE.subdivision).toBe(8)
      expect(SHUFFLE.swing).toBe(0.64)
      expect(SHUFFLE.passes).toBe(4)
      expect(SHUFFLE.flavours).toEqual(['blues', 'aeolian'])
      expect(SHUFFLE.density).toEqual({ minPerBar: 16, maxPerBar: 38 })
    })

    it('writes no open hat at any seed — AC9b', () => {
      for (let seed = 1; seed <= 8; seed += 1) {
        const { events } = barsOf(SHUFFLE, seed)
        expect(events.some((e) => e.voice === 'hatOpen'), `seed ${seed}`).toBe(false)
        expect(events.some((e) => e.voice === 'ride'), `seed ${seed}`).toBe(true)
      }
    })

    // feature-25: the subject is feature-24's rule that taking the ride costs a feel
    // nothing else — so it reads the feels that declare an open hat and do not ride.
    // bossa-nova declares no open hat at all (its closed hat keeps time and the rim
    // answers it), which is a kit decision rather than a ride trade, and
    // templates/index.test.ts is where that exception is named and held to one feel.
    it('leaves every feel that does not ride playing its open hat on the and of four', () => {
      const straight = allTemplates().filter(
        (f) => !f.voices.includes('ride') && f.voices.includes('hatOpen'),
      )
      expect(
        straight.length,
        'every feel rides or drops its open hat, so this case checks nothing',
      ).toBeGreaterThan(0)
      for (const { id } of straight) {
        const feel = templateById(id)
        const { bars } = barsOf(dryRide(feel), 1)
        const opens = stepsIn(bars[0], 'hatOpen')
        expect(opens, id).toEqual(gridded([14], feel.subdivision))
      }
    })
  })

  describe('the fill bar, the variation bar and the foot that does not stop — R21c, R21d, R21e, AC9, AC9c', () => {
    const FILL_BAR = 15
    const VARIATION_BAR = (middlePassOf(4) as number) * 4 + 3

    it('takes the ride out of the fill bar and brings it back on the downbeat — R21c', () => {
      for (let seed = 1; seed <= 8; seed += 1) {
        const { bars } = barsOf(dryRide(), seed)
        expect(stepsIn(bars[FILL_BAR], 'ride'), `seed ${seed}`).toEqual([])
        expect(stepsIn(bars[0], 'ride'), `seed ${seed}`).toContain(0)
      }
    })

    it('thins the ride to quarter notes in the variation bar — R21d', () => {
      for (let seed = 1; seed <= 8; seed += 1) {
        const { bars } = barsOf(dryRide(), seed)
        expect(stepsIn(bars[VARIATION_BAR], 'ride'), `seed ${seed}`).toEqual([0, 2, 4, 6])
      }
    })

    it('keeps the foot hat playing in all sixteen bars — R21e, AC9', () => {
      const options = HAT_PUNCTUATION_PATTERNS.map((figure) =>
        gridded(figure, SHUFFLE.subdivision).join(','),
      )
      for (let seed = 1; seed <= 8; seed += 1) {
        const { bars } = barsOf(dryRide(), seed)
        const drawn = stepsIn(bars[0], 'hatClosed').join(',')
        expect(options, `seed ${seed}`).toContain(drawn)
        for (let bar = 0; bar < bars.length; bar += 1) {
          const hats = stepsIn(bars[bar], 'hatClosed')
          expect(hats.join(','), `seed ${seed} bar ${bar}`).toBe(drawn)
          expect(hats.length, `seed ${seed} bar ${bar}`).toBeGreaterThanOrEqual(2)
          expect(hats.length, `seed ${seed} bar ${bar}`).toBeLessThanOrEqual(4)
        }
      }
    })

    it('lets every ride ping ring for half a bar', () => {
      const { bars, music } = barsOf(dryRide(), 1)
      const sixteenthSec = ((60 / music.bpm) * 4) / 16
      for (const bar of bars) {
        for (const event of bar) {
          if (event.voice !== 'ride') continue
          expect(event.durationSec).toBeCloseTo(RIDE_SUSTAIN_SIXTEENTHS * sixteenthSec, 9)
        }
      }
    })
  })
})

describe('a template brings its own figures — feature-25 epic-1', () => {
  const FUNK = templateById('straight-funk')
  const BRIGHT = templateById('bright-straight')
  const SHUFFLE = templateById('shuffle')

  const dry = (feel: FeelTemplate): FeelTemplate => ({
    ...feel,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  })

  // buildEvents keys its streams off spec.template, so a synthetic id never moves a draw.
  const specFor = (templateId: string, seed = 1): GrooveSpec => ({
    id: 'g',
    uuid: UUID,
    template: templateId,
    seed,
  })

  type Placed = { voice: VoiceName; step: number; velocity: number; durationSec: number }

  function placed(feel: FeelTemplate, templateId: string, seed = 1) {
    const built = buildEvents(specFor(templateId, seed), feel)
    const stepSec = ((60 / built.music.bpm) * 4) / feel.subdivision
    const bars: Placed[][] = Array.from({ length: built.music.loopBars }, () => [])
    for (const event of built.events) {
      const grid = Math.round(event.timeSec / stepSec)
      bars[Math.floor(grid / feel.subdivision)].push({
        voice: event.voice,
        step: grid % feel.subdivision,
        velocity: event.velocity,
        durationSec: event.durationSec,
      })
    }
    return { bars, music: built.music, events: built.events }
  }

  const serialised = (feel: FeelTemplate, templateId: string, seed = 1) =>
    buildEvents(specFor(templateId, seed), feel).events.map(serialiseEvent)

  const byVoice = (events: string[]) => {
    const out = new Map<string, string[]>()
    for (const line of events) {
      const voice = line.slice(0, line.indexOf('@'))
      out.set(voice, [...(out.get(voice) ?? []), line])
    }
    return out
  }

  function nothingElseMoved(
    withBlock: FeelTemplate,
    withoutBlock: FeelTemplate,
    templateId: string,
    voices: VoiceName[],
    seed = 1,
  ) {
    const after = byVoice(serialised(withBlock, templateId, seed))
    const before = byVoice(serialised(withoutBlock, templateId, seed))
    for (const voice of voices) {
      expect(before.get(voice), `${voice} sounds at all`).toBeDefined()
      expect(after.get(voice), voice).toEqual(before.get(voice))
    }
  }

  const stepsOf = (bar: Placed[], voice: VoiceName) =>
    bar.filter((e) => e.voice === voice).map((e) => e.step).sort((a, b) => a - b)

  // barInPass 3 is the fill in the last pass and the variation in middlePassOf(4).
  const ordinaryBars = (feel: FeelTemplate) => {
    const phrase = phraseBars(feel)
    return Array.from({ length: 4 * feel.passes }, (_, bar) => bar).filter(
      (bar) => !phrase.has(bar),
    )
  }

  describe('one grid bound, asserted in both places — R16', () => {
    it('agrees with patterns.ts on the sixteenth grid', () => {
      expect(PATTERN_RESOLUTION).toBe(PATTERN_GRID)
    })

    it('agrees with patterns.ts on the bars in a pass', () => {
      expect(BARS_PER_PASS).toBe(FIGURE_BARS_PER_PASS)
    })
  })

  describe('a template’s own kick pool — R11, R13, AC6', () => {
    const WITH: FeelTemplate = { ...dry(FUNK), id: 'own-kick', patterns: { kick: [[0, 6]] } }
    const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }

    it('draws the kick from the template’s own pool', () => {
      const own = gridSteps([0, 6], 16)
      const { bars } = placed(WITH, 'straight-funk')
      for (const bar of bars) {
        for (const step of stepsOf(bar, 'kick')) expect(own).toContain(step)
      }
      const shared = placed(WITHOUT, 'straight-funk')
      expect(shared.bars.some((bar) => stepsOf(bar, 'kick').includes(10))).toBe(true)
      expect(bars.some((bar) => stepsOf(bar, 'kick').includes(10))).toBe(false)
    })

    it('leaves every other voice exactly where it was', () => {
      nothingElseMoved(WITH, WITHOUT, 'straight-funk', [
        'bass',
        'comp',
        'hatClosed',
        'hatOpen',
        'snare',
      ])
    })
  })

  describe('all eight pools route, an unnamed voice falls back — R12, R13, AC6', () => {
    it('routes hatClosed on a feel that does not ride', () => {
      const WITH: FeelTemplate = {
        ...dry(FUNK),
        id: 'own-hat',
        patterns: { hatClosed: [[0, 4, 8, 12]] },
      }
      const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }
      const own = gridSteps([0, 4, 8, 12], 16)
      const { bars } = placed(WITH, 'straight-funk')
      for (const bar of bars) {
        for (const step of stepsOf(bar, 'hatClosed')) expect(own).toContain(step)
      }
      // every member of HAT_PATTERNS holds step 2, and the declared figure does not
      expect(bars.some((bar) => stepsOf(bar, 'hatClosed').includes(2))).toBe(false)
      const shared = placed(WITHOUT, 'straight-funk')
      expect(shared.bars.some((bar) => stepsOf(bar, 'hatClosed').includes(2))).toBe(true)

      nothingElseMoved(WITH, WITHOUT, 'straight-funk', ['kick', 'bass', 'comp', 'snare'])

      // The closed and open hat are one instrument played two ways, so HAT_ACCENTS
      // cycles by index into the combined line. A declared hatClosed pool therefore
      // re-accents the open hat: its times and durations hold, its velocity moves.
      const openLine = (feel: FeelTemplate) =>
        serialised(feel, 'straight-funk')
          .filter((line) => line.startsWith('hatOpen@'))
          .map((line) => line.split(':').slice(0, 2).join(':'))
      const openVelocities = (feel: FeelTemplate) =>
        serialised(feel, 'straight-funk')
          .filter((line) => line.startsWith('hatOpen@'))
          .map((line) => line.split(':')[2])
      expect(openLine(WITH).length).toBeGreaterThan(0)
      expect(openLine(WITH)).toEqual(openLine(WITHOUT))
      expect(openVelocities(WITH)).not.toEqual(openVelocities(WITHOUT))
    })

    it('routes hatClosed on a feel that rides', () => {
      const WITH: FeelTemplate = {
        ...dry(SHUFFLE),
        id: 'own-foot',
        patterns: { hatClosed: [[0, 8]] },
      }
      const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }
      const own = gridSteps([0, 8], 8)
      expect(own).toEqual([0, 4])
      const { bars } = placed(WITH, 'shuffle')
      for (const bar of bars) {
        for (const step of stepsOf(bar, 'hatClosed')) expect(own).toContain(step)
      }
      // every HAT_PUNCTUATION_PATTERNS member holds 4 and 12, which grid to 2 and 6
      for (const bar of bars) {
        expect(stepsOf(bar, 'hatClosed')).not.toContain(2)
        expect(stepsOf(bar, 'hatClosed')).not.toContain(6)
      }

      nothingElseMoved(WITH, WITHOUT, 'shuffle', ['kick', 'snare', 'ride', 'bass', 'comp'])
    })

    it('routes bass', () => {
      const WITH: FeelTemplate = {
        ...dry(FUNK),
        id: 'own-bass',
        patterns: { bass: [[0, 4, 8, 12]] },
      }
      const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }
      const own = new Set([...gridSteps([0, 4, 8, 12], 16), 15])
      const { bars } = placed(WITH, 'straight-funk')
      for (const bar of bars) {
        for (const step of stepsOf(bar, 'bass')) expect([...own]).toContain(step)
      }
      const shared = placed(WITHOUT, 'straight-funk')
      expect(
        shared.bars.some((bar) => stepsOf(bar, 'bass').some((step) => !own.has(step))),
      ).toBe(true)

      nothingElseMoved(WITH, WITHOUT, 'straight-funk', [
        'kick',
        'snare',
        'hatClosed',
        'hatOpen',
        'comp',
      ])
    })

    it('routes comp', () => {
      const WITH: FeelTemplate = { ...dry(FUNK), id: 'own-comp', patterns: { comp: [[0, 8]] } }
      const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }
      const own = gridSteps([0, 8], 16)
      const { bars } = placed(WITH, 'straight-funk')
      for (const bar of bars) {
        for (const step of stepsOf(bar, 'comp')) expect(own).toContain(step)
      }
      const shared = placed(WITHOUT, 'straight-funk')
      expect(
        shared.bars.some((bar) =>
          stepsOf(bar, 'comp').some((step) => step === 10 || step === 11),
        ),
      ).toBe(true)

      nothingElseMoved(WITH, WITHOUT, 'straight-funk', [
        'kick',
        'snare',
        'hatClosed',
        'hatOpen',
        'bass',
      ])
    })

    it('routes snareGhosts', () => {
      const WITH: FeelTemplate = {
        ...dry(FUNK),
        id: 'own-ghosts',
        patterns: { snareGhosts: [[3, 7, 11, 15]] },
      }
      const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }
      const { bars } = placed(WITH, 'straight-funk')
      for (const bar of ordinaryBars(WITH)) {
        const ghosts = bars[bar]
          .filter((e) => e.voice === 'snare' && e.velocity < GHOST_VELOCITY_THRESHOLD)
          .map((e) => e.step)
          .sort((a, b) => a - b)
        expect(ghosts, `bar ${bar}`).toEqual([3, 7, 11, 15])
      }
      // no member of SNARE_GHOST_PATTERNS has four steps
      const shared = placed(WITHOUT, 'straight-funk')
      for (const bar of ordinaryBars(WITH)) {
        const ghosts = shared.bars[bar].filter(
          (e) => e.voice === 'snare' && e.velocity < GHOST_VELOCITY_THRESHOLD,
        )
        expect(ghosts.length, `bar ${bar}`).toBeLessThan(4)
      }

      nothingElseMoved(WITH, WITHOUT, 'straight-funk', [
        'kick',
        'hatClosed',
        'hatOpen',
        'bass',
        'comp',
      ])
      const backbeat = (feel: FeelTemplate) =>
        serialised(feel, 'straight-funk').filter(
          (line) =>
            line.startsWith('snare@') &&
            Number(line.split(':')[2]) >= GHOST_VELOCITY_THRESHOLD,
        )
      expect(backbeat(WITH)).toEqual(backbeat(WITHOUT))
    })

    it('routes bongos', () => {
      const WITH: FeelTemplate = {
        ...dry(BRIGHT),
        id: 'own-bongos',
        patterns: { bongos: [{ high: [0], low: [8] }] },
      }
      const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }
      const { bars } = placed(WITH, 'bright-straight')
      for (const bar of ordinaryBars(WITH)) {
        expect(stepsOf(bars[bar], 'bongoHigh'), `bar ${bar}`).toEqual([0])
        expect(stepsOf(bars[bar], 'bongoLow'), `bar ${bar}`).toEqual([4])
      }
      const shared = placed(WITHOUT, 'bright-straight')
      expect(stepsOf(shared.bars[0], 'bongoHigh')).not.toEqual([0])

      nothingElseMoved(WITH, WITHOUT, 'bright-straight', [
        'kick',
        'snare',
        'hatClosed',
        'hatOpen',
        'rim',
        'bass',
        'comp',
      ])
    })

    it('routes ride', () => {
      const WITH: FeelTemplate = {
        ...dry(SHUFFLE),
        id: 'own-ride',
        patterns: { ride: { 8: [[0, 4, 8, 12]] } },
      }
      const WITHOUT: FeelTemplate = { ...WITH, patterns: undefined }
      const own = gridSteps([0, 4, 8, 12], 8)
      expect(own).toEqual([0, 2, 4, 6])
      const { bars } = placed(WITH, 'shuffle')
      for (const bar of bars) expect(stepsOf(bar, 'ride')).not.toContain(3)
      // every RIDE_PATTERNS[8] member grids onto step 3
      const shared = placed(WITHOUT, 'shuffle')
      expect(shared.bars.some((bar) => stepsOf(bar, 'ride').includes(3))).toBe(true)

      nothingElseMoved(WITH, WITHOUT, 'shuffle', ['kick', 'snare', 'hatClosed', 'bass', 'comp'])
    })
  })

  describe('the block adds no draw, and the thirty do not move — R14, R15, AC8', () => {
    it('still builds every committed groove exactly as the pin recorded it', () => {
      const catalogue = readCatalogue()
      expect(catalogue.length).toBeGreaterThan(0)
      const fixture = readFixture()
      for (const groove of catalogue) {
        expect(serialiseGroove(groove), fixtureKey(groove)).toEqual(fixture[fixtureKey(groove)])
      }
    })

    it('leaves the answer alone when a rhythm pool changes', () => {
      const WITH: FeelTemplate = { ...FUNK, id: 'own-kick', patterns: { kick: [[0, 6]] } }
      for (let seed = 1; seed <= 10; seed++) {
        const own = buildEvents(specFor('straight-funk', seed), WITH).music
        const shared = buildEvents(specFor('straight-funk', seed), FUNK).music
        expect(own, `seed ${seed}`).toEqual(shared)
      }
    })
  })

  describe('an illegal block fails at build time — R16, AC9', () => {
    it('rejects an empty pool', () => {
      const bad: FeelTemplate = { ...FUNK, id: 'bad', patterns: { comp: [] } }
      expect(() => buildEvents(specFor('straight-funk'), bad)).toThrow(/bad/)
      expect(() => buildEvents(specFor('straight-funk'), bad)).toThrow(/comp/)
    })

    it('rejects a step off the sixteenth grid', () => {
      const bad: FeelTemplate = { ...FUNK, id: 'bad', patterns: { kick: [[16]] } }
      expect(() => buildEvents(specFor('straight-funk'), bad)).toThrow(/bad/)
      expect(() => buildEvents(specFor('straight-funk'), bad)).toThrow(/kick/)
      expect(() => buildEvents(specFor('straight-funk'), bad)).toThrow(/16/)
    })

    it('accepts a legal pool', () => {
      const ok: FeelTemplate = { ...FUNK, id: 'ok', patterns: { kick: [[0, 6]] } }
      expect(() => buildEvents(specFor('straight-funk'), ok)).not.toThrow()
    })

    it('rejects an illegal fixed figure through the same door', () => {
      const bad: FeelTemplate = {
        ...FUNK,
        id: 'bad',
        figures: [{ voice: 'snare', bars: [[0]] }],
      }
      expect(() => buildEvents(specFor('straight-funk'), bad)).toThrow(/bad/)
      expect(() => buildEvents(specFor('straight-funk'), bad)).toThrow(/snare/)
    })
  })

  describe('a declared ride pool replaces the whole subdivision map — R12', () => {
    it('sounds the declared figure and nothing else', () => {
      const feel: FeelTemplate = {
        ...dry(SHUFFLE),
        id: 'own-ride',
        patterns: { ride: { 8: [[0, 4, 8, 12]] } },
      }
      const own = gridSteps([0, 4, 8, 12], 8)
      const { bars } = placed(feel, 'shuffle')
      for (const bar of ordinaryBars(feel)) {
        expect(stepsOf(bars[bar], 'ride'), `bar ${bar}`).toEqual(own)
      }
    })

    it('does not fall back to the shared table for a subdivision it omits', () => {
      const feel: FeelTemplate = {
        ...dry(SHUFFLE),
        id: 'own-ride',
        patterns: { ride: { 16: [[0, 4, 8, 12]] } },
      }
      expect(() => buildEvents(specFor('shuffle'), feel)).toThrow(
        /own-ride: no ride pattern pool for subdivision 8/,
      )
    })

    it('leaves a template with no ride block on the shared table', () => {
      const { bars } = placed(dry(SHUFFLE), 'shuffle')
      const options = (RIDE_PATTERNS[8] ?? []).map((figure) => gridSteps(figure, 8).join(','))
      expect(options).toHaveLength(3)
      expect(options).toContain(stepsOf(bars[0], 'ride').join(','))
      expect(serialised({ ...dry(SHUFFLE), patterns: undefined }, 'shuffle')).toEqual(
        serialised(dry(SHUFFLE), 'shuffle'),
      )
    })
  })

  describe('a drawn kit figure replaces the backbeat — R11, R12, R13, AC6', () => {
    const KIT: FeelTemplate = {
      ...dry(FUNK),
      id: 'own-kit',
      patterns: { kit: [{ snare: [2, 7, 10], tomLow: [14] }] },
    }
    const WITHOUT: FeelTemplate = { ...KIT, patterns: undefined }

    // Once patterns.kit is declared the velocity threshold stops telling a snare
    // from a ghost, because a drawn snare on an odd sixteenth sits in the weak
    // band. Duration does: a placed snare is two sixteenths, a ghost is one.
    const isKitGhost = (event: Placed, sixteenthSec: number) =>
      event.voice === 'snare' && Math.abs(event.durationSec - sixteenthSec) < 1e-9

    const kitBuild = (feel: FeelTemplate) => {
      const built = placed(feel, 'straight-funk')
      return { ...built, sixteenthSec: ((60 / built.music.bpm) * 4) / PATTERN_RESOLUTION }
    }

    const drawnSnare = (bar: Placed[], sixteenthSec: number) =>
      bar
        .filter((e) => e.voice === 'snare' && !isKitGhost(e, sixteenthSec))
        .map((e) => e.step)
        .sort((a, b) => a - b)

    it('puts the snare on the drawn line, not on the backbeat', () => {
      const own = gridSteps([2, 7, 10], 16)
      const { bars, sixteenthSec } = kitBuild(KIT)
      for (const bar of ordinaryBars(KIT)) {
        const line = drawnSnare(bars[bar], sixteenthSec)
        expect(line, `bar ${bar}`).toEqual(own)
        for (const step of gridSteps(DEFAULT_PLACEMENT.snare, 16)) {
          expect(line, `bar ${bar}`).not.toContain(step)
        }
      }
    })

    it('lets a kit snare sit on an odd sixteenth, below the ghost threshold', () => {
      const { bars, sixteenthSec } = kitBuild(KIT)
      const hit = bars[0].find((e) => e.voice === 'snare' && e.step === 7)
      expect(hit).toBeDefined()
      expect(hit?.durationSec).toBeCloseTo(2 * sixteenthSec, 9)
      expect(hit?.velocity).toBe(VELOCITIES.snare.weak)
      expect(VELOCITIES.snare.weak).toBeLessThan(GHOST_VELOCITY_THRESHOLD)
    })

    it('sounds the kit’s tom line in every ordinary bar', () => {
      const { bars } = kitBuild(KIT)
      for (const bar of ordinaryBars(KIT)) {
        expect(stepsOf(bars[bar], 'tomLow'), `bar ${bar}`).toEqual([14])
      }
    })

    it('keeps the ghosts off the drawn snare line', () => {
      const { bars, sixteenthSec } = kitBuild(KIT)
      for (const bar of ordinaryBars(KIT)) {
        const ghosts = bars[bar].filter((e) => isKitGhost(e, sixteenthSec)).map((e) => e.step)
        for (const step of [2, 7, 10]) expect(ghosts, `bar ${bar}`).not.toContain(step)
      }
    })

    it('leaves the fill and the variation to FILLS', () => {
      const own = byVoice(serialised(KIT, 'straight-funk'))
      const shared = byVoice(serialised(WITHOUT, 'straight-funk'))
      const phrase = [...phraseBars(KIT)]
      const stepSec = ((60 / kitBuild(KIT).music.bpm) * 4) / 16
      const inPhrase = (lines: string[] | undefined) =>
        (lines ?? []).filter((line) => {
          const timeSec = Number(line.split('@')[1].split(':')[0])
          return phrase.includes(Math.floor(Math.round(timeSec / stepSec) / 16))
        })
      for (const voice of ['snare', 'tomHigh', 'tomLow', 'kick']) {
        expect(inPhrase(own.get(voice)), voice).toEqual(inPhrase(shared.get(voice)))
      }
    })

    it('takes its own stream', () => {
      const labels = new Set([
        MUSIC_LABEL,
        RHYTHM_LABEL,
        GHOST_LABEL,
        BONGO_LABEL,
        RIDE_LABEL,
        KIT_LABEL,
      ])
      expect(labels.size).toBe(6)
    })

    it('takes no draw from the rhythm stream when no kit is declared', () => {
      expect(serialised(WITHOUT, 'straight-funk')).toEqual(serialised(dry(FUNK), 'straight-funk'))
    })
  })

  describe('a fixed figure plays every bar and takes over its placement — R11, R21', () => {
    // The real id on purpose: bright-straight has its own PLACEMENTS entry, and
    // suppressing that declared rim is the mechanism R21 rests on.
    const CLAVE: FeelTemplate = {
      ...dry(BRIGHT),
      figures: [{ voice: 'rim', bars: [[0, 6, 12], [2, 8]] }],
    }

    const COWBELL: FeelTemplate = {
      ...dry(BRIGHT),
      figures: [{ voice: 'cowbell', bars: [[0]] }],
    }

    it('alternates its bars across the four-bar cycle', () => {
      const even = gridSteps([0, 6, 12], 8)
      const odd = gridSteps([2, 8], 8)
      const { bars } = placed(CLAVE, 'bright-straight')
      bars.forEach((bar, index) => {
        expect(stepsOf(bar, 'rim'), `bar ${index}`).toEqual(index % 2 === 0 ? even : odd)
      })
    })

    it('does not stop for the fill or the variation', () => {
      const { bars } = placed(CLAVE, 'bright-straight')
      expect(bars).toHaveLength(16)
      for (const bar of bars) expect(stepsOf(bar, 'rim').length).toBeGreaterThan(0)
    })

    it('silences the template’s own placement rim', () => {
      const placementStep = gridSteps(PLACEMENTS['bright-straight'].rim ?? [], 8)
      expect(placementStep).toEqual([7])
      const { bars } = placed(CLAVE, 'bright-straight')
      for (const bar of bars) expect(stepsOf(bar, 'rim')).not.toContain(7)

      // A placement rim is an ordinary-bar decoration a fill silences — bright-straight
      // sounds it in bars 3 and 11 only. A fixed figure is not: it plays all sixteen.
      const plain = placed(dry(BRIGHT), 'bright-straight')
      expect(plain.bars.filter((bar) => stepsOf(bar, 'rim').includes(7)).length).toBe(2)
    })

    it('emits nothing for a voice the template does not play', () => {
      const { bars } = placed(COWBELL, 'bright-straight')
      for (const bar of bars) expect(stepsOf(bar, 'cowbell')).toEqual([])
      expect(serialised(COWBELL, 'bright-straight')).toEqual(
        serialised(dry(BRIGHT), 'bright-straight'),
      )
    })

    it('gives every hit the placement duration and the plain velocity band', () => {
      const { bars, music } = placed(CLAVE, 'bright-straight')
      const sixteenthSec = ((60 / music.bpm) * 4) / PATTERN_RESOLUTION
      const band = (sixteenth: number) => {
        const shape = VELOCITIES.rim
        if (sixteenth % 4 === 0) return shape.strong
        if (sixteenth % 2 === 0) return shape.medium
        return shape.weak
      }
      let seen = 0
      for (const bar of bars) {
        for (const event of bar) {
          if (event.voice !== 'rim') continue
          seen += 1
          expect(event.durationSec).toBeCloseTo(FILL_DURATIONS.rim * sixteenthSec, 9)
          expect(event.velocity).toBe(band((event.step * PATTERN_RESOLUTION) / 8))
        }
      }
      expect(seen).toBeGreaterThan(0)
    })

    it('takes no draw', () => {
      expect(serialised({ ...CLAVE, figures: undefined }, 'bright-straight')).toEqual(
        serialised(dry(BRIGHT), 'bright-straight'),
      )
    })
  })
})
