import { describe, expect, it } from 'vitest'
import type { FeelTemplate, GrooveSpec, MusicMeta, NoteEvent, VoiceName } from './types.ts'
import type { Harmony } from './theory/harmony.ts'
import {
  BACKING_VOICES,
  COMP_REGISTER_CEILING,
  COMP_REGISTER_LOW,
  DEFAULT_FILL,
  FILLS,
  GHOST_VELOCITY_THRESHOLD,
  MUSIC_LABEL,
  RHYTHM_LABEL,
  buildEvents,
  middlePassOf,
  playedVoicing,
  voiceLead,
} from './events.ts'
import { intBetween, pick, rngFor } from './rng.ts'
import { readCatalogue } from './catalogue.ts'
import { ROOTS } from '../../src/lib/theory/roots.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { buildHarmony, pitchClassesOf } from './theory/harmony.ts'
import { pitchesOf, scaleName } from '../../src/lib/theory/scales.ts'
import { offScalePitches } from './theory/pitches.ts'

const template = templateById('straight-funk')
const UUID = '2368f779-9931-44ec-9c62-3146bf20736f'

const spec: GrooveSpec = { id: 'g1', uuid: UUID, template: 'straight-funk', seed: 1 }

const PITCHED = new Set(['bass', 'comp'])

function isApproachNote(
  event: NoteEvent,
  music: MusicMeta,
  harmony: Harmony,
  subdivision: number,
): boolean {
  if (event.voice !== 'bass' || event.midi === undefined) return false
  const grid = Math.round(event.timeSec / (((60 / music.bpm) * 4) / subdivision))
  if (grid % subdivision !== subdivision - 1) return false
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
          expect(event.midi).toBeGreaterThanOrEqual(28)
          expect(event.midi).toBeLessThanOrEqual(48)
        }
        if (event.voice === 'comp') {
          expect(event.midi).toBeGreaterThanOrEqual(48)
          expect(event.midi).toBeLessThanOrEqual(84)
        }
      }
    }
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
        if (isApproachNote(event, music, harmony, template.subdivision)) continue
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
        if (isApproachNote(event, music, harmony, template.subdivision)) continue
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
              expect(event.midi, feel.id).toBeGreaterThanOrEqual(24)
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
            if (isApproachNote(event, music, harmony, feel.subdivision)) continue
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
        const isPitched = (key: string) => PITCHED.has(key.split('@')[0])

        for (let seed = 1; seed <= 6; seed++) {
          const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
          const steps = stepsOfLoop(events, music.bpm, feel.subdivision)
          const phrased = phraseBars(feel)

          const byBar = new Map<number, string[]>()
          events.forEach((event, i) => {
            if (isGhost(event)) return
            const bar = Math.floor(steps[i] / feel.subdivision)
            const list = byBar.get(bar) ?? []
            list.push(`${event.voice}@${steps[i] % feel.subdivision}:${event.midi ?? '-'}`)
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
        const expected = shape.map((_, i) => 1 - 0.12 * (shape.length - 1 - i))
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
      for (const chord of compChords(events as never) as unknown as NoteEvent[][]) {
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
    for (const feel of allTemplates()) {
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

          expect(last.step, `${where} approaches off the last step`).toBe(feel.subdivision - 1)
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

    it('plays toms, which the figure never does — R10', () => {
      for (const feel of allTemplates()) {
        const bars = drumBars(feel)
        const last = bars.length - 1
        const toms = [...voicesIn(bars[last])].filter((voice) => TOMS.has(voice as VoiceName))
        expect(toms.sort(), `${feel.id} fill plays no tom`).toEqual(['tomHigh', 'tomLow'])
        for (let bar = 0; bar < last; bar += 1) {
          for (const voice of voicesIn(bars[bar])) {
            expect(TOMS.has(voice as VoiceName), `${feel.id} bar ${bar} plays ${voice}`).toBe(
              false,
            )
          }
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
      for (const voice of BACKING_VOICES) expect(voice).not.toMatch(/crash|cymbal|ride/)
      for (const feel of allTemplates()) {
        const { events } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed: 1 }, feel)
        for (const event of events) expect(event.voice).not.toMatch(/crash|cymbal|ride/)
      }
      const phrases = [DEFAULT_FILL, ...Object.values(FILLS).flatMap((e) => [e.fill, e.variation])]
      for (const phrase of phrases) {
        for (const voice of Object.keys(phrase ?? {})) {
          expect(voice).not.toMatch(/crash|cymbal|ride/)
        }
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
    'groove-49': `
      0.003880/66/0.845070 0.007331/70/0.845070 0.008404/74/0.845070 2.126713/66/0.845070
      2.135768/70/0.845070 2.141621/74/0.845070 3.392851/67/0.845070 3.399547/74/0.845070
      3.399888/70/0.845070 5.500364/67/0.845070 5.506182/70/0.845070 5.510812/74/0.845070
      6.760266/64/0.845070 6.767001/67/0.845070 6.777090/70/0.845070 8.862789/67/0.845070
      8.863034/64/0.845070 8.869027/70/0.845070 10.123048/66/0.845070 10.128947/70/0.845070
      10.130344/74/0.845070 12.240189/66/0.845070 12.253010/70/0.845070 12.266568/74/0.845070
      13.521261/66/0.845070 13.527598/70/0.845070 13.532574/74/0.845070 15.649916/66/0.845070
      15.652669/70/0.845070 15.661202/74/0.845070 16.922091/67/0.845070 16.924296/74/0.845070
      16.927008/70/0.845070 19.016919/67/0.845070 19.027932/70/0.845070 19.035665/74/0.845070
      20.281065/64/0.845070 20.292303/67/0.845070 20.298421/70/0.845070 22.395210/64/0.845070
      22.397102/67/0.845070 22.407573/70/0.845070 23.653605/66/0.845070 23.661604/70/0.845070
      23.668175/74/0.845070 25.780410/66/0.845070 25.786141/74/0.845070 25.786661/70/0.845070
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

  const PRE_EPIC_MEAN_VELOCITY: Record<string, number> = {
    'straight-funk': 0.498027,
    shuffle: 0.546318,
    'bright-straight': 0.589771,
    'half-time': 0.544377,
    'open-ballad': 0.546818,
    'swung-sixteenth': 0.545409,
  }

  const MEAN_TOLERANCE = 0.02

  it('varies the comp around its centre rather than raising it — R7, AC7', () => {
    for (const feel of allTemplates()) {
      const before = PRE_EPIC_MEAN_VELOCITY[feel.id]
      expect(before, `${feel.id} has no pre-epic mean committed`).toBeDefined()

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
  const BONGO_FEEL = 'bright-straight'

  function eventsFor(templateId: string) {
    const spec = readCatalogue().find((g) => g.template === templateId)!
    const template = templateById(templateId)
    return { ...buildEvents(spec, template), template, spec }
  }

  it('sounds on the one feel that carries it, on both drums', () => {
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
    for (const template of allTemplates()) {
      if (template.id === BONGO_FEEL) continue
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

