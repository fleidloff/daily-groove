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
import { ROOTS } from './theory/notes.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { buildHarmony, pitchClassesOf } from './theory/harmony.ts'
import { pitchesOf, scaleName } from './theory/scales.ts'
import { offScalePitches } from './theory/pitches.ts'

const template = templateById('straight-funk')
/**
 * `buildEvents` derives everything from `template` and `seed` and never reads a
 * uuid, so one canonical value stands in for every spec in this file. A groove's
 * real uuid is minted into catalogue.json — see uuid.test.ts.
 */
const UUID = '2368f779-9931-44ec-9c62-3146bf20736f'

const spec: GrooveSpec = { id: 'g1', uuid: UUID, template: 'straight-funk', seed: 1 }

const PITCHED = new Set(['bass', 'comp'])

/**
 * Whether a bass event is the chromatic approach note into the next chord.
 *
 * `theory/pitches.ts` admits one when the bar leads into a chord change, the
 * note sits on the bar's closing step, and its pitch class is a semitone from
 * the next chord's root. That is the one hole in "every pitch is a tone of the
 * bar's chord" (R8), so the tests that assert the rule read the exception from
 * here rather than each inventing its own exemption.
 */
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
  const chordAt = (b: number) => (b % music.bars) % chords.length
  if (chordAt(bar + 1) === chordAt(bar)) return false
  const distance = (((event.midi - chords[chordAt(bar + 1)][0]) % 12) + 12) % 12
  return Math.min(distance, 12 - distance) === 1
}

/**
 * The pitch classes the comp strikes for a chord.
 *
 * The chord's own, minus its root where R6 drops it: a four-note chord whose
 * root the bass is already sounding is voiced rootless, so the two instruments
 * stop doubling it. `music.chord` and `music.progression` still name the whole
 * chord — this is which notes are struck, not which chord they spell.
 */
function compPitchClasses(chordMidi: number[], bassPitchClasses: Set<number>): number[] {
  const pc = (midi: number) => ((midi % 12) + 12) % 12
  const tones = [...new Set(chordMidi.map(pc))].sort((a, b) => a - b)
  const root = pc(chordMidi[0])
  if (tones.length >= 4 && bassPitchClasses.has(root)) return tones.filter((t) => t !== root)
  return tones
}

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

/**
 * The bars a written phrase replaces the figure's drums in: the last bar of the
 * last pass, and the last bar of the middle pass where the pass count leaves a
 * middle to mark (Feature 9, Epic 5).
 *
 * The tests below that pin the FIGURE read past these bars. The figure is what
 * repeats; the fill is the one bar that deliberately does not, and it has its
 * own describe at the foot of this file.
 */
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
          // 28 is the open low E of a four-string bass, and the pack samples
          // from there. The old floor of 24 was written against a synth, which
          // renders any pitch asked of it.
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
    // R2: a groove is identified by its template and seed. Two specs that share
    // both must be the same groove, whatever they are called.
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

  // Epic 1 could assert this over one template because that template carried
  // all eight flavours. Epic 3 gives every template exactly two (R2, AC15), so
  // the assertion is per template, over that template's own pair.
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
      // The bass's chromatic approach note is the one hole in this (R8), and it
      // is not waved through here: `offScalePitches` holds every pitch the
      // scale does not contain to the rule that admits it, and only then is it
      // skipped below.
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
      // The words are still exact: `music.chord` names bar one's chord tone for
      // chord tone. What the hand strikes is those minus the root the bass is
      // holding, when the chord has four of them (R6, AC7).
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

  it('walks the bass through the progression’s chord tones', () => {
    for (const seed of seeds) {
      const { events, music, harmony } = buildEvents({ ...spec, seed }, template)
      const chords = music.progression.split('–')
      for (const event of events) {
        if (event.voice !== 'bass') continue
        // Every note but the one chromatic approach into a chord change (R8).
        if (isApproachNote(event, music, harmony, template.subdivision)) continue
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

      // Whether a pitch outside the scale is legal is the validity table's
      // question, not this one (blues plays a major third the scale does not
      // contain). What Track A must hold is narrower and true for all eight
      // flavours: the notes are the ones the words name.
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

// The placements a feel changes. `FeelTemplate` has no field that can say
// "this is half-time", so `PLACEMENTS` in events.ts carries the one rule that
// differs; these pin what it does.
describe('buildEvents — per-template placement', () => {
  // The placements these pin are the PLAYED hits. Feature 9, Epic 3, Track C
  // added snare ghosts, which are placed by their own vocabulary and are, by
  // construction, under the ghost threshold — so the backbeat is read off
  // velocity, which is exactly what tells a listener the two apart.
  //
  // Read from the figure's bars alone. Epic 5's fill and variation replace the
  // figure's drums in the last bar of the last pass and of the middle pass, so
  // the snare there is the phrase's, not the placement's — a fill that resolved
  // on beat one would otherwise read as a backbeat that had moved.
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
        const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
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
          const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
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
      //
      // Read bar by bar rather than pass by pass, because Epic 5 gives the loop
      // an ending: the last bar of the last pass carries a fill instead of the
      // figure's drums, and the last bar of the middle pass a lighter mark of
      // it. Those two bars are the whole of the exception — their bass and comp
      // still play the figure's line, so the harmony is unbroken — and every
      // other bar of the loop is its figure bar, note for note.
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
          // The chord the manifest names, minus the root the bass is holding
          // where R6 drops it. What repeats every four bars is the whole hand.
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
      // The last bar of a pass is where Epic 5's fill and variation replace the
      // figure, so it is the one bar the passes do not play the same notes in.
      // This measures whether a pass is a different PERFORMANCE of the same
      // notes, so it reads the three bars that are the same notes.
      if (Math.floor((onGrid % stepsPerPass) / feel.subdivision) === 3) continue
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
    const { events, music } = buildEvents({ id: 'g', uuid: UUID, template: feel.id, seed }, feel)
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
      for (const voice of ['kick', 'snare', 'bass'] as const) {
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

      // The comp reads from metric position too, plus the one thing the hats'
      // cycle is not: where a note sits in the voicing, so the top voice sings
      // over the ones under it (R5, AC6). What must not vary is the shape — a
      // chord struck on a given metric class is shaped the same way in every
      // bar it falls in. A level says which voice of the chord this is, never
      // how far along a cycle the bar is.
      const struck = new Map<string, number[]>()
      for (const event of events) {
        if (event.voice !== 'comp') continue
        const key = `${event.bar}:${event.sixteenth}`
        struck.set(key, [...(struck.get(key) ?? []), event.velocity])
      }
      const shapes = new Map<number, Set<string>>()
      for (const [key, velocities] of struck) {
        const step = Number(key.split(':')[1])
        if (!shapes.has(step)) shapes.set(step, new Set())
        shapes.get(step)!.add([...velocities].sort((a, b) => a - b).join(','))
      }
      expect(shapes.size, `${feel.id} never comps`).toBeGreaterThan(0)
      for (const [step, shape] of shapes) {
        expect(shape.size, `${feel.id} comp@${step}`).toBe(1)
        const voices = [...shape][0].split(',')
        expect(voices.length, `${feel.id} comp@${step}`).toBeGreaterThan(1)
        expect(new Set(voices).size, `${feel.id} comp@${step} is flat`).toBe(voices.length)
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

// Feature 9, Epic 4, Track B — R3–R8a, AC4–AC9a. The comp stops being a block
// of chord tones folded into a window and becomes a hand: voice-led between
// chords, rolled rather than stamped, shaped so the top voice sings, and
// rootless when the bass is already holding the root. The bass stops being an
// arpeggiator and becomes a player: repeated notes, octaves, rests, and one
// chromatic approach note into each chord change.
describe('buildEvents — hands and fingers — R3, R4, R5, R6, R7, R8, R8a', () => {
  /** No swing and no slop, so an onset and a velocity are exactly what the builder wrote. */
  const still = (feel = template) => ({
    ...feel,
    swing: 0,
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  })

  /** What `inCompRegister` did before this track: every tone folded on its own. */
  const foldIndependently = (chord: number[]) =>
    chord
      .map((midi) => {
        let folded = midi
        while (folded >= COMP_REGISTER_CEILING) folded -= 12
        while (folded < COMP_REGISTER_LOW) folded += 12
        return folded
      })
      .sort((a, b) => a - b)

  /**
   * Total semitone motion between two voicings, paired ascending — the lowest
   * voice to the lowest, and so on. Sorted pairing is the cheapest bijection
   * between two sets of pitches, so this is the motion a listener hears.
   */
  const motion = (a: number[], b: number[]) => {
    const x = [...a].sort((p, q) => p - q)
    const y = [...b].sort((p, q) => p - q)
    let total = 0
    for (let i = 0; i < Math.min(x.length, y.length); i += 1) total += Math.abs(x[i] - y[i])
    return total
  }

  const pc = (midi: number) => ((midi % 12) + 12) % 12

  /** Semitones between two pitches, ignoring octave: 0..6. */
  const interval = (a: number, b: number) => {
    const distance = pc(a - b)
    return Math.min(distance, 12 - distance)
  }

  /** Every event with the bar and the grid step it reads as. */
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

  /** The comp's notes for one bar, grouped by the chord they were struck as. */
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

  // --- Step B1: the comp voice-leads -------------------------------------

  it('seeds a voicing with the independent fold, so bar one is still the named chord — R3, AC4', () => {
    const cm7 = [60, 63, 67, 70]
    expect(voiceLead(null, cm7)).toEqual(foldIndependently(cm7))
    expect(voiceLead([], cm7)).toEqual(foldIndependently(cm7))
  })

  it('folds each tone to the octave nearest the previous voicing — R3, AC4', () => {
    // Cm7 to B♭7: folded independently the whole voicing jumps up a minor
    // seventh and back down again. Led, it moves by a step or two.
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

  // --- Step B2: spread and shape -----------------------------------------

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
        // The roll runs up the voicing, the way a hand crosses the strings.
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

  // --- Step B3: rootless four-note voicings -------------------------------

  it('drops the root of a four-note chord the bass is already sounding — R6, AC7', () => {
    const seventh = [60, 64, 67, 70]
    const voicing = voiceLead(null, seventh)
    expect(playedVoicing(voicing, seventh, [36])).toEqual(voicing.filter((m) => m % 12 !== 0))
    // No root in the bass, no doubling to fix.
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
        // The words are untouched either way (AC7).
        expect(music.chord, feel.id).toBe(harmony.chordName)
        expect(music.progression, feel.id).toBe(harmony.progressionName)
      }
    }
  })

  // --- Step B4: the bass plays a line -------------------------------------

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

        // Rests: the line does not sound on every step it plays somewhere else.
        // The pattern's steps are read off the line itself — every step it ever
        // plays, minus the approach notes, which are written on the bar's
        // closing step in the bars that lead into a chord change and nowhere
        // else. A line with no rest plays every one of them in every bar.
        const chords = harmony.progressionMidi
        const chordIndex = (b: number) => (b % music.bars) % chords.length
        const written = bass.filter(
          (e) =>
            !(e.step === feel.subdivision - 1 && chordIndex(e.bar + 1) !== chordIndex(e.bar)),
        )
        const steps = new Set(written.map((e) => e.step))
        expect(written.length, `${where} rests nowhere`).toBeLessThan(
          steps.size * music.loopBars,
        )
      }
    }
  })

  // --- Step B5: the approach note -----------------------------------------

  it('walks into every chord change with a chromatic approach note — R8, AC9', () => {
    for (const feel of allTemplates()) {
      for (let seed = 1; seed <= 12; seed += 1) {
        const { events, music, harmony } = played(still(feel), seed)
        const chords = harmony.progressionMidi
        const chordIndex = (bar: number) => (bar % music.bars) % chords.length
        const bass = events.filter((e) => e.voice === 'bass')
        let found = 0

        for (let bar = 0; bar < music.loopBars; bar += 1) {
          if (chordIndex(bar + 1) === chordIndex(bar)) continue
          const where = `${feel.id}:${seed} bar ${bar + 1}`
          const inBar = bass.filter((e) => e.bar === bar)
          expect(inBar.length, where).toBeGreaterThan(0)
          const last = inBar[inBar.length - 1]
          const nextRoot = chords[chordIndex(bar + 1)][0]

          expect(last.step, `${where} approaches off the last step`).toBe(feel.subdivision - 1)
          expect(interval(last.midi as number, nextRoot), `${where} is not a semitone away`).toBe(1)

          // It resolves: the next bass onset is that root. In the final bar the
          // next onset is bar one's, when the loop comes round (R8a).
          const after = bass.find((e) => e.timeSec > last.timeSec) ?? bass[0]
          expect(pc(after.midi as number), `${where} resolves nowhere`).toBe(pc(nextRoot))
          found += 1
        }

        expect(found, `${feel.id}:${seed} never walks into a change`).toBeGreaterThan(0)
      }
    }
  })

  it('writes no approach note where the loop boundary is not a chord change — R8a', () => {
    // Three chords over a four-bar figure: bar four carries bar one's chord, so
    // the loop boundary is not a change and nothing chromatic belongs there.
    let checked = 0
    for (let seed = 1; seed <= 24 && checked < 3; seed += 1) {
      const { events, music, harmony } = played(still(), seed)
      if (harmony.progressionMidi.length !== 3) continue
      checked += 1
      const chord = harmony.progressionMidi[0]
      const tones = new Set(chord.map(pc))
      const lastBar = music.loopBars - 1
      for (const event of events) {
        if (event.voice !== 'bass' || event.bar !== lastBar) continue
        expect(tones, `seed ${seed} bar ${lastBar + 1}`).toContain(pc(event.midi as number))
      }
    }
    expect(checked, 'no three-chord progression in the first 24 seeds').toBeGreaterThan(0)
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

// Feature 9, Epic 5, Track C — R5, R6, R7, R8, R9, R10, R13, AC4–AC8.
//
// Epic 1 made every pass a different take of one figure; it did not give the
// loop a shape, so nothing told a listener where in it they were. The last bar
// of the last pass stops being another bar: it carries a fill, and where the
// pass count leaves a middle to mark, the last bar of the middle pass carries
// the same phrase with its toms taken out.
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

  /**
   * The drum figure of every bar of the loop, as sorted `voice@step` lists.
   *
   * Ghost strokes are left out for the same reason the pass-equality test
   * leaves them out: they are drawn afresh per bar by design, so two ordinary
   * bars already differ in them, and they would swamp the one difference these
   * tests are about.
   */
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

  /** The pitched figure of every bar: the bass and the comp, with their notes. */
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

  /** How far two bars stand apart: what each plays that the other does not. */
  function distance(a: string[], b: string[]): number {
    const left = new Set(a)
    const right = new Set(b)
    return (
      [...left].filter((s) => !right.has(s)).length +
      [...right].filter((s) => !left.has(s)).length
    )
  }

  /** The voices a bar plays, once each. */
  function voicesIn(bar: string[]): Set<string> {
    return new Set(bar.map((key) => key.split('@')[0]))
  }

  const fourPass = allTemplates().filter((feel) => feel.passes === 4)
  const twoPass = allTemplates().filter((feel) => feel.passes === 2)

  // Step C1 — R8, AC6. Where the middle is, is arithmetic on the pass count,
  // not a bar number written down somewhere.
  describe('middlePassOf — R8, AC6', () => {
    it('has no middle pass to mark below three passes', () => {
      expect(middlePassOf(0)).toBeNull()
      expect(middlePassOf(1)).toBeNull()
      expect(middlePassOf(2)).toBeNull()
    })

    it('marks the half-way pass, taking the earlier candidate on an even count', () => {
      // 0-based pass indices, so 1 is pass two. Three passes mark pass two;
      // four passes mark pass two as well — the earlier of the two candidates,
      // so the mark sits AT the half-way point of the loop rather than past it
      // (PRD "Where the fill and the variation go", and its Assumptions).
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

  // Step C2 — R5, R7, R10, AC4, AC8.
  describe('the fill — R5, R7, R10, AC4', () => {
    it('puts the fill in the last bar of the last pass and nowhere else', () => {
      for (const feel of fourPass) {
        const bars = drumBars(feel)
        const last = bars.length - 1
        const middleBar = (middlePassOf(feel.passes) as number) * 4 + 3

        expect(distance(bars[last], bars[3]), `${feel.id} last bar`).toBeGreaterThan(0)
        for (let bar = 0; bar < bars.length; bar += 1) {
          if (bar === last || bar === middleBar) continue
          // Every other bar plays the figure's own bar, exactly.
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
      // A template id `FILLS` has never heard of, so the default is the only
      // thing that can be playing.
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

  // Step C3 — R6, AC5. A feel that lives on space gets a sparser fill, not an
  // absent one.
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

  // Step C4 — R8, R10, AC6, AC8. The middle pass is marked, and a loop with no
  // middle gets nothing in its place.
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

  // Step C5 — R9, R13, AC7, AC10. The downbeat after the fill is left clean on
  // purpose: a crash there would have to be written past the loop end and
  // folded onto bar one, so every groove would OPEN on a crash.
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

// Feature-9, Epic 6, Step B3 — R1, AC1. The two feels Epic 6 added play, and
// what they play survives the gate.
//
// Every other suite in this file reasons about events. This one renders them:
// a template is a set of numbers, and the only proof that a *new* set of them
// is a groove rather than a plausible-looking table is to put it through the
// same stages the pipeline runs and ask the gate. It uses the committed sample
// pack for the same reason `gate.test.ts` does — the seam check is calibrated
// for real samples, and the synthesized stand-in fails it on events the pack
// renders cleanly.
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

// Feature-9, Epic 6, Step B1 — R1, AC1. A template's `density` band is the
// gate's only opinion about how busy a groove may be, and it is hand-written.
// A band that does not admit what its own feel renders rejects every groove
// minted from it — which shows up as `grooves:add` quietly failing rather than
// as a broken test, so the check belongs here.
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
