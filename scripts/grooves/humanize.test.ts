import { describe, expect, it } from 'vitest'
import type { FeelTemplate, NoteEvent } from './types.ts'
import {
  applyDrift,
  applySwing,
  fitToLoop,
  gaussianUnit,
  humanize,
  stepSecFor,
} from './humanize.ts'
import { rngFor } from './rng.ts'

const BPM = 100
const SUBDIVISION = 16
const STEP = stepSecFor(BPM, SUBDIVISION)

function feel(overrides: Partial<FeelTemplate> = {}): FeelTemplate {
  return {
    id: 'test-feel',
    tempoRange: [BPM, BPM],
    subdivision: SUBDIVISION,
    swing: 0,
    flavours: ['aeolian'],
    voices: ['kick', 'hatClosed'],
    humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
    gain: {},
    pan: {},
    passes: 4,
  density: { minPerBar: 1, maxPerBar: 999 },
    ...overrides,
  }
}

/**
 * Which subdivision a time reads as. `+ 0` normalises the negative zero a note
 * nudged a hair before the loop's first step produces, which is the same grid
 * position as +0 and only Object.is disagrees.
 */
function gridIndex(timeSec: number, stepSec: number = STEP): number {
  return Math.round(timeSec / stepSec) + 0
}

/** One event per subdivision step, straight on the grid. */
function grid(steps: number): NoteEvent[] {
  return Array.from({ length: steps }, (_, step) => ({
    voice: 'hatClosed' as const,
    timeSec: step * STEP,
    durationSec: STEP,
    velocity: 0.6,
  }))
}

describe('stepSecFor', () => {
  it('divides a 4/4 bar into the template’s subdivision', () => {
    expect(stepSecFor(120, 16)).toBeCloseTo(2 / 16, 12)
    expect(stepSecFor(120, 8)).toBeCloseTo(2 / 8, 12)
  })
})

describe('applySwing — R4, AC3', () => {
  it('leaves on-beat subdivisions where they are and pushes off-beats later', () => {
    const events = grid(16)
    const swung = applySwing(events, 0.3, SUBDIVISION, BPM)

    expect(swung).toHaveLength(events.length)
    for (let step = 0; step < events.length; step++) {
      const before = events[step].timeSec
      const after = swung[step].timeSec
      if (step % 2 === 0) {
        expect(after, `step ${step} is on the beat and must not move`).toBeCloseTo(before, 12)
      } else {
        expect(after, `step ${step} is off the beat and must be later`).toBeGreaterThan(before)
      }
    }
  })

  it('delays an off-beat by swing × half a subdivision', () => {
    const swung = applySwing(grid(4), 0.4, SUBDIVISION, BPM)
    expect(swung[1].timeSec - STEP).toBeCloseTo(0.4 * (STEP / 2), 12)
    expect(swung[3].timeSec - 3 * STEP).toBeCloseTo(0.4 * (STEP / 2), 12)
  })

  it('moves nothing at all when swing is zero', () => {
    const events = grid(16)
    expect(applySwing(events, 0, SUBDIVISION, BPM)).toEqual(events)
  })

  it('never displaces a note as far as the next subdivision', () => {
    const events = grid(16)
    const swung = applySwing(events, 1, SUBDIVISION, BPM)
    for (let i = 0; i < events.length; i++) {
      expect(swung[i].timeSec - events[i].timeSec).toBeLessThan(STEP / 2 + 1e-12)
    }
  })

  it('does not mutate its input', () => {
    const events = grid(4)
    applySwing(events, 0.5, SUBDIVISION, BPM)
    expect(events.map((e) => e.timeSec)).toEqual([0, STEP, 2 * STEP, 3 * STEP])
  })
})

describe('humanize — R5, R7, AC4, AC5', () => {
  const template = feel({ humanize: { timingMs: 12, velocity: 0.2, lean: {}, driftDepth: 0 } })

  it('keeps every timing deviation inside the template’s declared bound', () => {
    const events = grid(32)
    const nudged = humanize(events, template, rngFor('g:humanize'), BPM)

    expect(nudged).toHaveLength(events.length)
    for (let i = 0; i < events.length; i++) {
      const offset = nudged[i].timeSec - events[i].timeSec
      expect(Math.abs(offset)).toBeLessThanOrEqual(template.humanize.timingMs / 1000 + 1e-12)
    }
  })

  it('actually moves notes — the bound is not met by doing nothing', () => {
    const events = grid(32)
    const nudged = humanize(events, template, rngFor('g:humanize'), BPM)
    const moved = nudged.filter((e, i) => e.timeSec !== events[i].timeSec)
    expect(moved.length).toBeGreaterThan(events.length / 2)
  })

  it('keeps every velocity deviation inside the bound and inside 0..1', () => {
    const events = grid(32)
    const nudged = humanize(events, template, rngFor('g:humanize'), BPM)
    for (let i = 0; i < events.length; i++) {
      const offset = nudged[i].velocity - events[i].velocity
      expect(Math.abs(offset)).toBeLessThanOrEqual(template.humanize.velocity + 1e-12)
      expect(nudged[i].velocity).toBeGreaterThan(0)
      expect(nudged[i].velocity).toBeLessThanOrEqual(1)
    }
  })

  it('clamps a velocity that would leave 0..1 rather than emitting it', () => {
    const loud = grid(16).map((e) => ({ ...e, velocity: 1 }))
    const quiet = grid(16).map((e) => ({ ...e, velocity: 0.02 }))
    const wide = feel({ humanize: { timingMs: 0, velocity: 0.5, lean: {}, driftDepth: 0 } })
    for (const event of humanize(loud, wide, rngFor('g:humanize'), BPM)) {
      expect(event.velocity).toBeLessThanOrEqual(1)
    }
    for (const event of humanize(quiet, wide, rngFor('g:humanize'), BPM)) {
      expect(event.velocity).toBeGreaterThan(0)
    }
  })

  it('never nudges a note into a neighbouring subdivision — R7', () => {
    // A bound far wider than half a subdivision must still be clamped to it.
    const reckless = feel({ humanize: { timingMs: 1000, velocity: 0, lean: {}, driftDepth: 0 } })
    const events = grid(32)
    const nudged = humanize(events, reckless, rngFor('g:reckless'), BPM)
    for (let i = 0; i < events.length; i++) {
      expect(Math.abs(nudged[i].timeSec - events[i].timeSec)).toBeLessThan(STEP / 2)
      expect(gridIndex(nudged[i].timeSec)).toBe(gridIndex(events[i].timeSec))
    }
  })

  it('leaves everything alone when the template declares no deviation', () => {
    const events = grid(16)
    expect(humanize(events, feel(), rngFor('g:humanize'), BPM)).toEqual(events)
  })

  it('does not mutate its input', () => {
    const events = grid(8)
    const before = JSON.stringify(events)
    humanize(events, template, rngFor('g:humanize'), BPM)
    expect(JSON.stringify(events)).toBe(before)
  })
})

describe('humanize — reproducible from the seed, AC4', () => {
  const template = feel({ humanize: { timingMs: 12, velocity: 0.2, lean: {}, driftDepth: 0 } })

  it('returns identical events for two freshly seeded generators', () => {
    const events = grid(32)
    const first = humanize(events, template, rngFor('g:humanize'), BPM)
    const second = humanize(events, template, rngFor('g:humanize'), BPM)
    expect(first).toEqual(second)
  })

  it('returns different events for a different seed label', () => {
    const events = grid(32)
    const first = humanize(events, template, rngFor('a:humanize'), BPM)
    const second = humanize(events, template, rngFor('b:humanize'), BPM)
    expect(first).not.toEqual(second)
  })
})

describe('fitToLoop — the loop stays exactly four bars', () => {
  const loopSec = STEP * 64

  it('pins the end of the last event to the end of the loop', () => {
    const events: NoteEvent[] = [
      { voice: 'kick', timeSec: 0, durationSec: STEP, velocity: 0.9 },
      // Rings well past the loop.
      { voice: 'hatClosed', timeSec: loopSec - STEP + 0.02, durationSec: STEP, velocity: 0.5 },
    ]
    const fitted = fitToLoop(events, loopSec)
    const end = Math.max(...fitted.map((e) => e.timeSec + e.durationSec))
    expect(end).toBeCloseTo(loopSec, 12)
  })

  it('stretches the last event when humanization pulled it early', () => {
    const events: NoteEvent[] = [
      { voice: 'kick', timeSec: 0, durationSec: STEP, velocity: 0.9 },
      { voice: 'hatClosed', timeSec: loopSec - STEP - 0.02, durationSec: STEP, velocity: 0.5 },
    ]
    const fitted = fitToLoop(events, loopSec)
    const end = Math.max(...fitted.map((e) => e.timeSec + e.durationSec))
    expect(end).toBeCloseTo(loopSec, 12)
  })

  it('keeps every onset non-negative and inside the loop, with a positive duration', () => {
    const events: NoteEvent[] = [
      { voice: 'kick', timeSec: -0.05, durationSec: STEP, velocity: 0.9 },
      { voice: 'hatClosed', timeSec: loopSec + 0.05, durationSec: STEP, velocity: 0.5 },
    ]
    for (const event of fitToLoop(events, loopSec)) {
      expect(event.timeSec).toBeGreaterThanOrEqual(0)
      expect(event.timeSec).toBeLessThan(loopSec)
      expect(event.durationSec).toBeGreaterThan(0)
    }
  })

  it('returns events sorted by onset', () => {
    const events: NoteEvent[] = [
      { voice: 'kick', timeSec: 0.5, durationSec: STEP, velocity: 0.9 },
      { voice: 'hatClosed', timeSec: 0.1, durationSec: STEP, velocity: 0.5 },
    ]
    const fitted = fitToLoop(events, loopSec)
    for (let i = 1; i < fitted.length; i++) {
      expect(fitted[i].timeSec).toBeGreaterThanOrEqual(fitted[i - 1].timeSec)
    }
  })
})

describe('humanize — a voice leans consistently, R1, R2, AC1', () => {
  /** One event per step for each of two voices, straight on the grid. */
  function twoVoiceGrid(steps: number): NoteEvent[] {
    const events: NoteEvent[] = []
    for (let step = 0; step < steps; step++) {
      for (const voice of ['snare', 'hatClosed'] as const) {
        events.push({ voice, timeSec: step * STEP, durationSec: STEP, velocity: 0.6 })
      }
    }
    return events
  }

  const leaning = feel({
    voices: ['snare', 'hatClosed'],
    humanize: { timingMs: 0, velocity: 0, lean: { snare: 12, hatClosed: -4 }, driftDepth: 0 },
  })

  it('lays the snare back and pushes the hats by exactly the declared lean', () => {
    const events = twoVoiceGrid(4)
    const leaned = humanize(events, leaning, rngFor('g:lean'), BPM)

    for (let i = 0; i < events.length; i++) {
      const offset = leaned[i].timeSec - events[i].timeSec
      const expected = events[i].voice === 'snare' ? 0.012 : -0.004
      expect(offset, `${events[i].voice} at step ${i}`).toBeCloseTo(expected, 12)
    }
  })

  it('applies the same lean to every hit of a voice, in every pass', () => {
    const events = twoVoiceGrid(8)
    // Two passes, each on a generator of its own: the lean is a property of the
    // feel, so it must not vary with the draw.
    const offsets = ['g:lean:0', 'g:lean:1'].flatMap((label) =>
      humanize(events, leaning, rngFor(label), BPM)
        .map((e, i) => ({ voice: e.voice, offset: e.timeSec - events[i].timeSec }))
        .filter((o) => o.voice === 'snare')
        .map((o) => o.offset.toFixed(9)),
    )
    expect(offsets).toHaveLength(16)
    expect(new Set(offsets).size).toBe(1)
  })

  it('leaves a voice with no declared lean exactly where it was', () => {
    const events = grid(8)
    const snareOnly = feel({
      humanize: { timingMs: 0, velocity: 0, lean: { snare: 20 }, driftDepth: 0 },
    })
    const leaned = humanize(events, snareOnly, rngFor('g:lean'), BPM)
    for (let i = 0; i < events.length; i++) {
      expect(leaned[i].timeSec).toBeCloseTo(events[i].timeSec, 12)
    }
  })
})

describe('gaussianUnit — deviations concentrate near zero, R4, R7, AC4', () => {
  const draws = (label: string, count: number) => {
    const rng = rngFor(label)
    return Array.from({ length: count }, () => gaussianUnit(rng))
  }

  it('stays inside −1..1', () => {
    for (const value of draws('g:gauss', 2000)) {
      expect(value).toBeGreaterThanOrEqual(-1)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('puts most of its mass near zero and almost none at the bound', () => {
    const values = draws('g:gauss', 2000)
    const near = values.filter((v) => Math.abs(v) < 1 / 3).length
    const outer = values.filter((v) => Math.abs(v) > 0.9).length
    expect(near / values.length, 'within a third of the bound').toBeGreaterThan(0.5)
    expect(outer / values.length, 'in the outer tenth').toBeLessThan(0.05)
  })

  it('is centred: the mean of a large sample sits at zero', () => {
    const values = draws('g:gauss', 2000)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    expect(Math.abs(mean)).toBeLessThan(0.03)
  })

  it('is drawn only from the generator it is given', () => {
    expect(draws('g:gauss', 50)).toEqual(draws('g:gauss', 50))
    expect(draws('a:gauss', 50)).not.toEqual(draws('b:gauss', 50))
  })
})

describe('humanize — adjacent hits move together, R3, R5, AC3, AC5', () => {
  const walking = feel({
    voices: ['kick', 'snare', 'bass'],
    humanize: { timingMs: 10, velocity: 0, lean: {}, driftDepth: 0 },
  })

  /** Eight passes' worth of labels, so the statistics below are not one draw. */
  const LABELS = Array.from({ length: 8 }, (_, i) => `g:walk:${i}`)

  /** One event per step for each of `voices`, interleaved, straight on the grid. */
  function interleaved(steps: number, voices: readonly NoteEvent['voice'][]): NoteEvent[] {
    const events: NoteEvent[] = []
    for (let step = 0; step < steps; step++) {
      for (const voice of voices) {
        events.push({ voice, timeSec: step * STEP, durationSec: STEP, velocity: 0.6 })
      }
    }
    return events
  }

  /** The timing deviation humanize applied to each event, in order. */
  function deviations(events: NoteEvent[], label: string): number[] {
    return humanize(events, walking, rngFor(label), BPM).map(
      (e, i) => e.timeSec - events[i].timeSec,
    )
  }

  /** Mean |d[i+lag] − d[i]| pooled over every series. */
  function pooledLag(series: number[][], lag: number): number {
    let sum = 0
    let count = 0
    for (const d of series) {
      for (let i = 0; i + lag < d.length; i++) {
        sum += Math.abs(d[i + lag] - d[i])
        count++
      }
    }
    return sum / count
  }

  function pooledAbs(series: number[][]): number {
    const all = series.flat()
    return all.reduce((a, b) => a + Math.abs(b), 0) / all.length
  }

  it('moves less between neighbours than it does from zero', () => {
    const events = interleaved(32, ['kick'])
    const series = LABELS.map((label) => deviations(events, label))

    // Independent draws would put these two within ~30 % of each other; a walk
    // takes a small step from where the previous hit landed. The 0.7 is a
    // margin: pooled over eight passes the ratio sits near 0.42.
    expect(pooledLag(series, 1)).toBeLessThan(0.7 * pooledAbs(series))
  })

  it('correlates with the previous hit specifically, not with the pass at large', () => {
    const events = interleaved(32, ['kick'])
    const series = LABELS.map((label) => deviations(events, label))
    expect(pooledLag(series, 1)).toBeLessThan(0.7 * pooledLag(series, 8))
  })

  it('still moves every hit — a correlated deviation is not a constant one', () => {
    const events = interleaved(32, ['kick'])
    const series = LABELS.map((label) => deviations(events, label))
    expect(pooledAbs(series)).toBeGreaterThan(0)
    for (const d of series) expect(new Set(d).size).toBeGreaterThan(d.length / 2)
  })

  it('keeps the bass on the kick rather than letting it wander off on its own', () => {
    const withBass = interleaved(16, ['kick', 'bass'])
    const withSnare = interleaved(16, ['kick', 'snare'])

    const paired = (events: NoteEvent[], label: string) => {
      const d = deviations(events, label)
      let sum = 0
      for (let i = 0; i < d.length; i += 2) sum += Math.abs(d[i] - d[i + 1])
      return sum / (d.length / 2)
    }

    const kickToBass = LABELS.reduce((a, l) => a + paired(withBass, l), 0)
    const kickToSnare = LABELS.reduce((a, l) => a + paired(withSnare, l), 0)

    // A voice drawn independently of the kick sits as far from it as chance
    // allows; the bass is derived from the kick's own series, so it tracks it.
    expect(kickToBass).toBeLessThan(0.7 * kickToSnare)
  })
})

describe('humanize — nothing crosses a subdivision, R6, AC6', () => {
  // Deliberately reckless: a lean and a walk that, added, would carry a hit
  // past the halfway mark to the next sixteenth.
  const extreme = feel({
    voices: ['snare', 'hatClosed'],
    humanize: { timingMs: 60, velocity: 0, lean: { snare: 40, hatClosed: -40 }, driftDepth: 0 },
  })

  function gridAt(bpm: number, steps: number): NoteEvent[] {
    const stepSec = stepSecFor(bpm, SUBDIVISION)
    const events: NoteEvent[] = []
    for (let step = 0; step < steps; step++) {
      for (const voice of ['snare', 'hatClosed'] as const) {
        events.push({ voice, timeSec: step * stepSec, durationSec: stepSec, velocity: 0.6 })
      }
    }
    return events
  }

  // 68 bpm is the slowest feel in the catalogue and 140 the fastest; at 140 the
  // sixteenth is short enough that lean + walk would leave it unclamped.
  for (const bpm of [68, 140]) {
    it(`keeps every hit on the subdivision it was written for at ${bpm} bpm`, () => {
      const stepSec = stepSecFor(bpm, SUBDIVISION)
      const events = gridAt(bpm, 24)
      const nudged = humanize(events, extreme, rngFor(`g:extreme:${bpm}`), bpm)

      for (let i = 0; i < events.length; i++) {
        const offset = nudged[i].timeSec - events[i].timeSec
        expect(
          Math.abs(offset),
          `${events[i].voice} at ${bpm} bpm is displaced by ${(offset * 1000).toFixed(1)} ms`,
        ).toBeLessThan(stepSec / 2)
        expect(gridIndex(nudged[i].timeSec, stepSec)).toBe(gridIndex(events[i].timeSec, stepSec))
      }
    })
  }

  it('clamps the sum, not each term — a lean at the limit leaves no room to wander', () => {
    const bpm = 140
    const stepSec = stepSecFor(bpm, SUBDIVISION)
    const atTheLimit = feel({
      voices: ['snare'],
      // A lean already past the guard on its own, and a walk too narrow to
      // pull any hit back inside it: every displacement must land on the cap.
      humanize: { timingMs: 20, velocity: 0, lean: { snare: 90 }, driftDepth: 0 },
    })
    const events = gridAt(bpm, 24).filter((e) => e.voice === 'snare')
    const nudged = humanize(events, atTheLimit, rngFor('g:limit'), bpm)

    for (let i = 0; i < events.length; i++) {
      expect(nudged[i].timeSec - events[i].timeSec).toBeCloseTo(stepSec * 0.49, 12)
    }
  })
})

describe('applyDrift — the tempo breathes and comes back, R13, AC12', () => {
  const PASS_SEC = STEP * 64
  const DEPTH = 0.006
  // The integral of the tempo deviation, not the deviation itself: a tempo
  // running `DEPTH` fast and slow across a pass accumulates this much position
  // offset at the crest. See `applyDrift`.
  const AMPLITUDE = (DEPTH * PASS_SEC) / (2 * Math.PI)

  const at = (timeSec: number): NoteEvent => ({
    voice: 'kick',
    timeSec,
    durationSec: STEP,
    velocity: 0.9,
  })

  it('leaves every pass boundary exactly where it was', () => {
    const events = [at(0), at(PASS_SEC), at(2 * PASS_SEC)]
    const drifted = applyDrift(events, DEPTH, PASS_SEC)
    for (let i = 0; i < events.length; i++) {
      expect(drifted[i].timeSec, `boundary ${i}`).toBeCloseTo(events[i].timeSec, 12)
    }
  })

  it('displaces a hit inside the pass, by no more than depth × the pass', () => {
    const events = [at(PASS_SEC / 4), at(PASS_SEC / 3), at((3 * PASS_SEC) / 4)]
    const drifted = applyDrift(events, DEPTH, PASS_SEC)
    for (let i = 0; i < events.length; i++) {
      const offset = drifted[i].timeSec - events[i].timeSec
      expect(Math.abs(offset), `event ${i} must move`).toBeGreaterThan(0)
      expect(Math.abs(offset), `event ${i} stays inside the depth`).toBeLessThanOrEqual(
        AMPLITUDE + 1e-12,
      )
    }
    // A quarter of the way in is the crest, three quarters the trough: the
    // envelope pulls late, then early, then resolves.
    expect(drifted[0].timeSec - events[0].timeSec).toBeCloseTo(AMPLITUDE, 12)
    expect(drifted[2].timeSec - events[2].timeSec).toBeCloseTo(-AMPLITUDE, 12)
  })

  it('breathes the same way in every pass', () => {
    const first = PASS_SEC / 4
    const second = PASS_SEC + PASS_SEC / 4
    const drifted = applyDrift([at(first), at(second)], DEPTH, PASS_SEC)
    expect(drifted[0].timeSec - first).toBeCloseTo(drifted[1].timeSec - second, 12)
  })

  it('leaves the loop exactly as long as it was', () => {
    const events = [at(0), at(PASS_SEC / 3), at(PASS_SEC - STEP)]
    const loopSec = PASS_SEC
    const drifted = applyDrift(events, DEPTH, PASS_SEC)
    for (const event of drifted) {
      expect(event.timeSec).toBeGreaterThanOrEqual(0)
      expect(event.timeSec + event.durationSec).toBeLessThanOrEqual(loopSec + AMPLITUDE)
      expect(event.durationSec).toBe(STEP)
    }
    // The end of the pass is a fixed point, so nothing is pushed past it by the
    // envelope itself.
    expect(applyDrift([at(loopSec)], DEPTH, PASS_SEC)[0].timeSec).toBeCloseTo(loopSec, 12)
  })

  it('moves nothing when the template asks for no drift', () => {
    const events = [at(0), at(PASS_SEC / 4), at(PASS_SEC / 2)]
    expect(applyDrift(events, 0, PASS_SEC)).toEqual(events)
  })

  it('does not mutate its input and keeps every other field', () => {
    const events = [{ ...at(PASS_SEC / 4), midi: 40 }]
    const before = JSON.stringify(events)
    const drifted = applyDrift(events, DEPTH, PASS_SEC)
    expect(JSON.stringify(events)).toBe(before)
    expect(drifted[0].midi).toBe(40)
    expect(drifted[0].voice).toBe('kick')
    expect(drifted[0].velocity).toBe(0.9)
  })
})
