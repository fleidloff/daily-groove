import { describe, expect, it } from 'vitest'
import type { GrooveSpec, NoteEvent } from './types.ts'
import {
  BACKING_VOICES,
  COMP_REGISTER_CEILING,
  GHOST_VELOCITY_THRESHOLD,
  MUSIC_LABEL,
  RHYTHM_LABEL,
  buildEvents,
} from './events.ts'
import { intBetween, pick, rngFor } from './rng.ts'
import { ROOTS } from './theory/notes.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { buildHarmony, pitchClassesOf } from './theory/harmony.ts'
import { pitchesOf, scaleName } from './theory/scales.ts'

const template = templateById('straight-funk')
const spec: GrooveSpec = { id: 'g1', template: 'straight-funk', seed: 1 }

const PITCHED = new Set(['bass', 'comp'])

function stepSecFor(bpm: number): number {
  // 4 beats to the bar, `subdivision` steps to the bar.
  return ((60 / bpm) * 4) / template.subdivision
}

/**
 * Which bar an event belongs to. Swing and humanization move onsets off the
 * grid (R4, R5), so the bar is read from the subdivision the onset lands
 * nearest — the same reading AC13 asserts — not from the raw time, which would
 * put a note nudged 9 ms early into the previous bar.
 */
function barOf(event: NoteEvent, bpm: number): number {
  const step = Math.round(event.timeSec / stepSecFor(bpm))
  return Math.floor(step / template.subdivision)
}

/**
 * Pair two renderings of the same groove up, voice by voice and pitch by pitch.
 * Indices cannot be used: the feel stages reorder simultaneous events of
 * different voices, so only the sequence within one voice-and-pitch is stable.
 */
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

/**
 * The furthest `applyDrift` can move an event in this template.
 *
 * The drift is the integral of a tempo deviation, so its crest is
 * `driftDepth × passSec / 2π` — not `driftDepth × passSec`. See `applyDrift`.
 */
/**
 * A ghost stroke: a snare struck well below the backbeat.
 *
 * Read from the velocity, which is what tells a listener the two apart, rather
 * than from where it lands — `GHOST_VELOCITY_RANGE` sits far enough under
 * `GHOST_VELOCITY_THRESHOLD` that the humanize slop cannot carry one across.
 */
function isGhost(event: NoteEvent): boolean {
  return event.voice === 'snare' && event.velocity < GHOST_VELOCITY_THRESHOLD
}

function driftBoundFor(
  template: { humanize: { driftDepth: number } },
  music: { bpm: number; bars: number },
): number {
  const passSec = (music.bars * 4 * 60) / music.bpm
  return (template.humanize.driftDepth * passSec) / (2 * Math.PI)
}

describe('buildEvents — the grid', () => {
  // Epic 2 replaces Epic 1's exact-grid assertion: swing and humanization move
  // notes off the grid on purpose (R4, R5). What must still hold — AC13 — is
  // that every onset still READS as a subdivision of the stated tempo, in every
  // bar of the loop, which means it never crosses into its neighbour. Feature 9
  // makes the loop several passes of the figure, so every bar of every pass is
  // played rather than only the four of the figure.
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
    // The loop's length is the buffer's, not the last note's. `renderVoices`
    // sizes it from `bars` and `bpm`; `fitToLoop` used to stretch whichever
    // event ended last so that `max(timeSec + durationSec)` landed on the end
    // of the loop, and that stopped being free once `addAt` learned to stop a
    // note at its duration — the stretch became an audibly longer note, chosen
    // by whichever event happened to end last rather than by the music.
    //
    // What must still hold is that nothing spills past the loop and the groove
    // plays right up to its last bar.
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

  // Superseded by Epic 2 Step A4: what Epic 1 asserted as flat is now asserted
  // as dynamic. The 0..1 range assertion survives unchanged.
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
          expect(event.midi).toBeGreaterThanOrEqual(24)
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
    // R2: a groove is identified by its template and seed. Two specs that share
    // both must be the same groove, whatever they are called.
    const a = buildEvents({ id: 'groove-01', template: 'straight-funk', seed: 7 }, template)
    const b = buildEvents({ id: 'anything-else', template: 'straight-funk', seed: 7 }, template)
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

  // Epic 1 could assert this over one template because that template carried
  // all eight flavours. Epic 3 gives every template exactly two (R2, AC15), so
  // the assertion is per template, over that template's own pair.
  it('reaches every flavour a template offers, across enough seeds', () => {
    for (const feel of allTemplates()) {
      const flavours = new Set(
        Array.from(
          { length: 200 },
          (_, i) =>
            buildEvents({ id: 'g', template: feel.id, seed: i + 1 }, feel).music.flavour,
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
      const { events, music } = buildEvents({ ...spec, seed }, template)
      const scale = pitchesOf(music.root, music.flavour)
      for (const event of events) {
        if (event.midi === undefined) continue
        expect(scale).toContain(event.midi % 12)
      }
    }
  })

  it('comps the named chord in bar 1', () => {
    for (const seed of seeds) {
      const { events, music } = buildEvents({ ...spec, seed }, template)
      const barOne = events.filter(
        (e: NoteEvent) => e.voice === 'comp' && barOf(e, music.bpm) === 0,
      )
      expect(barOne.length).toBeGreaterThan(0)
      const played = [...new Set(barOne.map((e) => (e.midi as number) % 12))].sort(
        (a, b) => a - b,
      )
      expect(played).toEqual(pitchClassesOf(music.chord))
    }
  })

  it('names the scale the way the app displays it', () => {
    const { music } = buildEvents(spec, template)
    expect(music.scale).toBe(scaleName(music.root, music.flavour))
    expect(music.chord.startsWith(music.root)).toBe(true)
    expect(music.progression.split('–')[0]).toBe(music.chord)
  })

  it('walks the bass through the progression’s chord tones', () => {
    for (const seed of seeds) {
      const { events, music } = buildEvents({ ...spec, seed }, template)
      const chords = music.progression.split('–')
      for (const event of events) {
        if (event.voice !== 'bass') continue
        // The progression describes the four-bar figure (R5), so a bar of the
        // loop is read modulo the figure before it is read modulo the
        // progression.
        const chord = chords[(barOf(event, music.bpm) % music.bars) % chords.length]
        expect(pitchClassesOf(chord)).toContain((event.midi as number) % 12)
      }
    }
  })

  // Now a real constraint: a template offers two of the eight, so a groove that
  // reached for a third would be answering to a flavour its feel never carries.
  it('chooses a flavour the template offers', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 40; seed++) {
        const { music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
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
    // Feature 9, Epic 3, Track C: the snare now plays ghosts as well as the
    // backbeat, and a ghost is quieter than a hat by construction. The subject
    // of this assertion is the backbeat, so it reads the backbeats.
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
      // Feature 9, Epic 3, Track A: an onset now carries the voice's declared
      // lean as well as its slop, and the two are bounded together. The bound
      // is still the template's own — the lean is declared there too.
      const lean = Math.abs(template.humanize.lean[before.voice] ?? 0) / 1000
      // Feature 9, Epic 3, Track A also lets the tempo breathe within a pass,
      // which displaces every event by up to `driftDepth × passSec / 2π`. It is
      // a third declared deviation, not slop, so it is added to the bound
      // rather than folded into `timingMs`.
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

// Step A3 — R1. Four templates are only four feels if the event builder can
// actually place all four. This is the assertion that catches a template whose
// subdivision or voice set the builder has no rule for.
describe('buildEvents — every template renders', () => {
  const seeds = Array.from({ length: 8 }, (_, i) => i + 1)

  for (const feel of allTemplates()) {
    describe(feel.id, () => {
      it('renders a non-empty groove in its own flavours and tempo range', () => {
        for (const seed of seeds) {
          const { events, music } = buildEvents(
            { id: `groove-${seed}`, template: feel.id, seed },
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
          const { events } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
          const played = new Set(events.map((e) => e.voice))
          for (const voice of feel.voices) expect(played, `${feel.id}:${seed}`).toContain(voice)
          for (const voice of played) expect(feel.voices, `${feel.id}:${seed}`).toContain(voice)
        }
      })

      it('keeps every event inside the loop, and fills it to the last bar', () => {
        for (const seed of seeds) {
          const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
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
          const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
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
          const { events } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
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

      // Whether a pitch outside the scale is legal is the validity table's
      // question, not this one (blues plays a major third the scale does not
      // contain). What Track A must hold is narrower and true for all eight
      // flavours: the notes are the ones the words name.
      it('plays the harmony its metadata names', () => {
        for (const seed of seeds) {
          const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
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
          expect(played, `${feel.id}:${seed}`).toEqual(pitchClassesOf(music.chord))

          for (const event of events) {
            if (event.voice !== 'bass') continue
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
        const a = buildEvents({ id: 'one', template: feel.id, seed: 3 }, feel)
        const b = buildEvents({ id: 'another', template: feel.id, seed: 3 }, feel)
        expect(a).toEqual(b)
      })
    })
  }
})

// The placements a feel changes. `FeelTemplate` has no field that can say
// "this is half-time", so `PLACEMENTS` in events.ts carries the one rule that
// differs; these pin what it does.
describe('buildEvents — per-template placement', () => {
  // The placements these pin are the PLAYED hits. Feature 9, Epic 3, Track C
  // added snare ghosts, which are placed by their own vocabulary and are, by
  // construction, under the ghost threshold — so the backbeat is read off
  // velocity, which is exactly what tells a listener the two apart.
  function stepsOf(voice: string, feelId: string, seed: number) {
    const feel = templateById(feelId)
    const { events, music } = buildEvents({ id: 'g', template: feelId, seed }, feel)
    const step = ((60 / music.bpm) * 4) / feel.subdivision
    return events
      .filter((e) => e.voice === voice && e.velocity >= GHOST_VELOCITY_THRESHOLD)
      .map((e) => Math.round(e.timeSec / step) % feel.subdivision)
  }

  it('gives half-time a wide backbeat — one snare on beat three', () => {
    for (let seed = 1; seed <= 6; seed++) {
      // A sixteenth grid: beat three is step 8, and there is no snare on 2 or 4.
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
    // A sixteenth-note pattern resolved onto an eighth-note grid collapses
    // pairs of steps together; stacking them would double that voice's level.
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 8; seed++) {
        const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
        const step = ((60 / music.bpm) * 4) / feel.subdivision
        const seen = new Set<string>()
        for (const event of events) {
          if (event.voice === 'comp') continue // one event per chord tone, by design
          const key = `${event.voice}@${Math.round(event.timeSec / step)}`
          expect(seen.has(key), `${feel.id}:${seed} ${key}`).toBe(false)
          seen.add(key)
        }
      }
    }
  })
})

// Feature 9, Epic 1, Step B2 — R6, AC6. Today a single sequential stream draws
// tempo, root, flavour, harmony and then the four rhythm patterns, so adding
// one draw on the rhythm side shifts every draw after it and silently re-keys
// the whole catalogue. Splitting the stream is what lets later epics change how
// a groove sounds without changing what it is.
describe('buildEvents — the music stream is not the rhythm stream — R6, AC6', () => {
  it('labels the music stream with the frozen string "events"', () => {
    // FROZEN: eighteen committed answers are derived from this exact string.
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
    // The proof that the answers did not move: rebuild the first four draws by
    // hand from the frozen label and check the groove agrees.
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

// Feature 9, Epic 1, Step B3 — R3, R5, AC2, AC3, AC5. A groove stops being one
// four-bar recording on repeat: it is several passes of the same four-bar
// figure, so the seventh repeat a listener hears is not the same bytes as the
// first. The figure itself does not change — same patterns, same harmony.
describe('buildEvents — a groove is several passes of one figure — R3, R5, AC2, AC3, AC5', () => {
  /** The step every event lands on, counting from the top of the whole loop. */
  function stepsOfLoop(events: NoteEvent[], bpm: number, subdivision: number) {
    const step = ((60 / bpm) * 4) / subdivision
    return events.map((e) => Math.round(e.timeSec / step))
  }

  for (const feel of allTemplates()) {
    describe(feel.id, () => {
      it('spans its template’s declared pass count times four bars — AC2', () => {
        for (let seed = 1; seed <= 6; seed++) {
          const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
          expect(music.bars, feel.id).toBe(4)
          expect(music.loopBars, feel.id).toBe(4 * feel.passes)

          // The declared span is `loopBars`, and the events fill it: the last
          // one ends inside the final bar and nothing spills past the end. It
          // is not asserted to land *on* the end — that used to be manufactured
          // by stretching whichever event happened to end last, which is now an
          // audible note length rather than a free bit of bookkeeping. The
          // buffer carries the loop's exact length, and `voices.test.ts` holds
          // it to that.
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

      // The figure, not every note. A groove's identity is its kick, its hats,
      // its bass and its comp, plus where the backbeat falls — those repeat
      // exactly, which is what makes pass three recognisable as the same music
      // as pass one. The snare's ghost strokes are deliberately excluded: they
      // are the quiet fill between the backbeats, they are drawn per bar, and
      // the test below is the one that holds them to varying.
      it('plays the same figure in every pass, voice by voice — AC3', () => {
        for (let seed = 1; seed <= 6; seed++) {
          const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
          const stepsPerPass = feel.subdivision * 4
          const steps = stepsOfLoop(events, music.bpm, feel.subdivision)

          const byPass = new Map<number, string[]>()
          events.forEach((event, i) => {
            if (isGhost(event)) return
            const pass = Math.floor(steps[i] / stepsPerPass)
            const list = byPass.get(pass) ?? []
            list.push(`${event.voice}@${steps[i] % stepsPerPass}:${event.midi ?? '-'}`)
            byPass.set(pass, list)
          })

          expect([...byPass.keys()].sort((a, b) => a - b), `${feel.id}:${seed}`).toEqual(
            Array.from({ length: feel.passes }, (_, p) => p),
          )
          const first = [...(byPass.get(0) as string[])].sort()
          for (let pass = 1; pass < feel.passes; pass++) {
            expect([...(byPass.get(pass) as string[])].sort(), `${feel.id}:${seed} pass ${pass}`)
              .toEqual(first)
          }
        }
      })

      it('fills between the backbeats differently from bar to bar', () => {
        for (let seed = 1; seed <= 6; seed++) {
          const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
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
          const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
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

          const barOne = compIn(0)
          expect(barOne.length, `${feel.id}:${seed}`).toBeGreaterThan(0)
          expect(barOne, `${feel.id}:${seed}`).toEqual(pitchClassesOf(music.chord))
          for (let pass = 1; pass < feel.passes; pass++) {
            expect(compIn(pass * 4), `${feel.id}:${seed} bar ${pass * 4 + 1}`).toEqual(barOne)
          }
        }
      })
    })
  }
})

// Feature 9, Epic 1, Step B4 — R4, AC4. The passes carry the same figure, so
// the only thing that can stop a listener pointing at the moment it repeats is
// that each one is a different performance of it: its own timing and velocity
// deviations, drawn from its own generator.
describe('buildEvents — every pass is a different take — R4, AC4', () => {
  /**
   * Every event's deviation from the grid, and its velocity, grouped by pass.
   *
   * Ghost strokes are left out. This measures whether one pass is a different
   * *performance* of the same notes — same grid, different timing and velocity —
   * so it has to compare like with like, and the ghosts are drawn per bar and
   * are deliberately not the same notes.
   */
  function takesOf(feelId: string, seed: number) {
    const feel = templateById(feelId)
    const { events, music } = buildEvents({ id: 'g', template: feelId, seed }, feel)
    const step = ((60 / music.bpm) * 4) / feel.subdivision
    const stepsPerPass = feel.subdivision * 4

    const rows = Array.from(
      { length: feel.passes },
      () => [] as { key: string; timing: number; velocity: number }[],
    )
    for (const event of events) {
      if (isGhost(event)) continue
      const onGrid = Math.round(event.timeSec / step)
      rows[Math.floor(onGrid / stepsPerPass)].push({
        key: `${event.voice}@${onGrid % stepsPerPass}:${event.midi ?? '-'}`,
        timing: event.timeSec - onGrid * step,
        velocity: event.velocity,
      })
    }

    // Ordered by grid position rather than by emission order: the final sort is
    // by onset, so two passes of the same figure order their simultaneous
    // events differently precisely BECAUSE they are played differently.
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
    // R4 is a different performance every pass, not a random one: the same spec
    // must still render the same audio (AC4 of Epic 2, unchanged).
    for (const feel of allTemplates()) {
      const a = buildEvents({ id: 'one', template: feel.id, seed: 5 }, feel)
      const b = buildEvents({ id: 'another', template: feel.id, seed: 5 }, feel)
      expect(a.events, feel.id).toEqual(b.events)
    }
  })

  it('keeps every pass’s deviations inside the template’s declared bounds', () => {
    for (const feel of allTemplates()) {
      const flat = buildEvents(
        { id: 'g', template: feel.id, seed: 3 },
        { ...feel, humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 } },
      )
      const loose = buildEvents({ id: 'g', template: feel.id, seed: 3 }, feel)
      const bound = feel.humanize.timingMs / 1000
      expect(flat.events, feel.id).toHaveLength(loose.events.length)

      for (const { before, after } of pairUp(flat.events, loose.events)) {
        // Slop, plus the voice's declared lean, plus the pass's drift — the
        // three deviations the template declares (Feature 9, Epic 3, Track A).
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

// Feature 9, Epic 3, Track C — R10, R11, R12, AC9, AC10, AC11. The snare played
// only the backbeat and `velocityFor` was a pure function of metric position,
// so `GHOST_VELOCITY_THRESHOLD` was satisfied by quiet hi-hats alone and every
// hat at a given step class was identical forever.
describe('buildEvents — ghosts and accents — R10, R11, R12', () => {
  /** No slop, so a velocity is exactly the one the event builder emitted. */
  const dry = (feel = template) => ({
    ...feel,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  })

  /** Every event with the sixteenth-grid step it reads as, and its bar. */
  function placed(feel = dry(), seed = 1) {
    const { events, music } = buildEvents({ id: 'g', template: feel.id, seed }, feel)
    const stepSec = ((60 / music.bpm) * 4) / feel.subdivision
    return events.map((event) => {
      const grid = Math.round(event.timeSec / stepSec)
      return {
        ...event,
        bar: Math.floor(grid / feel.subdivision),
        // Read in sixteenths, so an eighth-note template's steps are comparable.
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
    // With the shipped template, so the slop cannot swap the two either.
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
    // Two hats of the same metric class in one bar must be able to differ:
    // `velocityFor` alone gives every step class one velocity forever.
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

  it('leaves kick, snare, bass and comp reading from metric position — R12, AC11', () => {
    for (const feel of allTemplates()) {
      const events = placed(dry(feel))
      for (const voice of ['kick', 'snare', 'bass', 'comp'] as const) {
        // Every hit of one voice on one metric class is the same velocity: the
        // accent cycle belongs to the hats only. Ghosts are their own level.
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

      // And the backbeat still lands above what surrounds it: in every bar the
      // loudest snare is on a quarter-note position, and every other snare in
      // that bar is quieter than it.
      const bars = new Set(events.map((e) => e.bar))
      for (const bar of bars) {
        const snares = events.filter((e) => e.voice === 'snare' && e.bar === bar)
        expect(snares.length, `${feel.id} bar ${bar}`).toBeGreaterThan(1)
        const loudest = snares.reduce((a, b) => (b.velocity > a.velocity ? b : a))
        for (const snare of snares) {
          const where = `${feel.id} bar ${bar} @${snare.sixteenth}`
          if (snare.velocity === loudest.velocity) {
            // Whatever is loudest in the bar is on a quarter — the backbeat.
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
