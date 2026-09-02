import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  BEAT_TOLERANCE_SECONDS,
  beatSeconds,
  createGrooveClock,
  secondsToNextBeat,
  type BeatSource,
} from './beat'
import { GROOVES } from '../../data/grooves.generated'
import { loopSecondsOf } from '../theory/music'

function fakeSource(startTime: number | null = null) {
  const listeners = new Set<() => void>()
  const source = {
    startTime,
    getStartTime: () => source.startTime,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    notify: () => {
      for (const listener of [...listeners]) listener()
    },
    get listenerCount() {
      return listeners.size
    },
  }
  return source
}

describe('beatSeconds', () => {
  it('turns a tempo into the length of one quarter note (R8, R8a)', () => {
    expect(beatSeconds(120)).toBe(0.5)
    expect(beatSeconds(67)).toBeCloseTo(0.895522, 6)
    expect(beatSeconds(130)).toBeCloseTo(0.461538, 6)
  })

  it('returns 0 for a tempo that cannot describe a beat (R8)', () => {
    expect(beatSeconds(0)).toBe(0)
    expect(beatSeconds(-1)).toBe(0)
    expect(beatSeconds(Number.NaN)).toBe(0)
    expect(beatSeconds(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('secondsToNextBeat', () => {
  it('waits not at all on a beat (R6)', () => {
    expect(secondsToNextBeat(0, 0.5)).toBe(0)
    expect(secondsToNextBeat(2.0, 0.5)).toBe(0)
  })

  it('waits out the rest of the beat it is inside (R6)', () => {
    expect(secondsToNextBeat(0.2, 0.5)).toBeCloseTo(0.3, 6)
    expect(secondsToNextBeat(2.2, 0.5)).toBeCloseTo(0.3, 6)
  })

  it('schedules forward from a tap just after a beat (R6b, AC8b)', () => {
    expect(secondsToNextBeat(0.51, 0.5, 0)).toBeCloseTo(0.49, 6)
  })

  it('never returns a negative wait (R6b)', () => {
    for (let i = 0; i < 200; i += 1) {
      const position = (i / 200) * 4 * 0.5
      expect(secondsToNextBeat(position, 0.5)).toBeGreaterThanOrEqual(0)
    }
  })

  it('counts a tap inside the tolerance as the beat itself (R6a, AC8a)', () => {
    expect(secondsToNextBeat(0.5 - BEAT_TOLERANCE_SECONDS / 2, 0.5)).toBe(0)
  })

  it('still waits for a tap outside the tolerance (R6a)', () => {
    expect(secondsToNextBeat(0.5 - BEAT_TOLERANCE_SECONDS * 2, 0.5)).toBeCloseTo(
      BEAT_TOLERANCE_SECONDS * 2,
      6,
    )
  })

  it('takes the tolerance as a parameter, not a hard-coded floor (R6a)', () => {
    expect(secondsToNextBeat(0.49, 0.5, 0)).toBeCloseTo(0.01, 6)
  })

  it('has a tolerance of a few tens of milliseconds (R6a)', () => {
    expect(BEAT_TOLERANCE_SECONDS).toBeGreaterThan(0.02)
    expect(BEAT_TOLERANCE_SECONDS).toBeLessThan(0.12)
  })

  describe('at two tempos (R8, AC6)', () => {
    const slow = beatSeconds(67)
    const fast = beatSeconds(134)

    it('waits three quarters of its own beat in each', () => {
      expect(secondsToNextBeat(slow * 0.25, slow)).toBeCloseTo(slow * 0.75, 6)
      expect(secondsToNextBeat(fast * 0.25, fast)).toBeCloseTo(fast * 0.75, 6)
    })

    it('waits twice as long at half the tempo', () => {
      expect(secondsToNextBeat(slow * 0.25, slow)).toBeCloseTo(
        secondsToNextBeat(fast * 0.25, fast) * 2,
        6,
      )
    })

    it('never makes a player wait longer than one beat (AC6)', () => {
      expect(beatSeconds(67)).toBeLessThan(0.9)
      expect(beatSeconds(130)).toBeLessThan(0.47)
    })
  })

  describe('across the whole catalogue (R8, R4)', () => {
    it('gives every groove a usable beat length', () => {
      for (const groove of GROOVES) {
        expect(beatSeconds(groove.bpm)).toBeGreaterThan(0)
      }
    })

    it('makes every loop a whole number of quarter notes', () => {
      for (const groove of GROOVES) {
        const beats = loopSecondsOf(groove) / beatSeconds(groove.bpm)
        expect(Math.abs(beats - Math.round(beats))).toBeLessThan(1e-6)
      }
    })

    it('spans the tempos the worst-case wait was claimed about', () => {
      const tempos = GROOVES.map((groove) => groove.bpm)
      expect(Math.min(...tempos)).toBe(67)
      expect(Math.max(...tempos)).toBe(130)
    })
  })
})

describe('createGrooveClock', () => {
  it('answers with the graph time of the next beat (R6, AC4)', () => {
    const source = fakeSource(10)
    const clock = createGrooveClock(source, 120)

    expect(clock.nextBeat(10.2)).toBeCloseTo(10.5, 6)
    expect(clock.isRunning()).toBe(true)
  })

  it('answers nothing while the groove is stopped (R7, AC5)', () => {
    const source = fakeSource(null)
    const clock = createGrooveClock(source, 120)

    expect(clock.nextBeat(10.2)).toBeNull()
    expect(clock.isRunning()).toBe(false)
  })

  it('answers now for a tap that is already on a beat (R6a)', () => {
    const source = fakeSource(10)

    expect(createGrooveClock(source, 120).nextBeat(10.5)).toBe(10.5)
  })

  it('degrades an unusable tempo to immediate, not to broken (R7)', () => {
    const source = fakeSource(10)
    const clock = createGrooveClock(source, 0)

    expect(clock.nextBeat(10.2)).toBe(10.2)
    expect(clock.isRunning()).toBe(true)
  })

  it('forwards subscription to its source', () => {
    const source = fakeSource(10)
    const clock = createGrooveClock(source, 120)
    const listener = vi.fn()

    const unsubscribe = clock.subscribe(listener)
    source.notify()
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    source.notify()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(source.listenerCount).toBe(0)
  })

  it('reads only the two members of BeatSource (R9, AC7)', () => {
    const read: string[] = []
    const target: BeatSource = {
      getStartTime: vi.fn(() => 10),
      subscribe: vi.fn(() => () => {}),
    }
    const source = new Proxy(target, {
      get(object, key, receiver) {
        if (typeof key === 'string') read.push(key)
        return Reflect.get(object, key, receiver)
      },
    })

    const clock = createGrooveClock(source, 120)
    clock.nextBeat(10.2)
    clock.isRunning()
    clock.subscribe(() => {})

    expect([...new Set(read)].sort()).toEqual(['getStartTime', 'subscribe'])
  })
})

describe('the module cannot reach the transport (R9, AC7)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/features/daily-groove/lib/audio/beat.ts'),
    'utf8',
  )

  it.each(['./transport', './audio', './context', '.stop(', '.toggle(', '.play('])(
    'contains no %s',
    (forbidden) => {
      expect(source).not.toContain(forbidden)
    },
  )
})
