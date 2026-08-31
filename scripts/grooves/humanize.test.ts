import { describe, expect, it } from 'vitest'
import type { FeelTemplate, NoteEvent } from './types.ts'
import { applySwing, fitToLoop, humanize, stepSecFor } from './humanize.ts'
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
    humanize: { timingMs: 0, velocity: 0 },
    gain: {},
    pan: {},
    passes: 4,
  density: { minPerBar: 1, maxPerBar: 999 },
    ...overrides,
  }
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
  const template = feel({ humanize: { timingMs: 12, velocity: 0.2 } })

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
    const wide = feel({ humanize: { timingMs: 0, velocity: 0.5 } })
    for (const event of humanize(loud, wide, rngFor('g:humanize'), BPM)) {
      expect(event.velocity).toBeLessThanOrEqual(1)
    }
    for (const event of humanize(quiet, wide, rngFor('g:humanize'), BPM)) {
      expect(event.velocity).toBeGreaterThan(0)
    }
  })

  it('never nudges a note into a neighbouring subdivision — R7', () => {
    // A bound far wider than half a subdivision must still be clamped to it.
    const reckless = feel({ humanize: { timingMs: 1000, velocity: 0 } })
    const events = grid(32)
    const nudged = humanize(events, reckless, rngFor('g:reckless'), BPM)
    for (let i = 0; i < events.length; i++) {
      expect(Math.abs(nudged[i].timeSec - events[i].timeSec)).toBeLessThan(STEP / 2)
      expect(Math.round(nudged[i].timeSec / STEP)).toBe(Math.round(events[i].timeSec / STEP))
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
  const template = feel({ humanize: { timingMs: 12, velocity: 0.2 } })

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
