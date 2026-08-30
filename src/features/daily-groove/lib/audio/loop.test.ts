import { describe, expect, it } from 'vitest'
import { deriveLoopWindow, loopPosition } from './loop'
import { GROOVES } from '../../data/grooves.generated'
import { loopSecondsOf } from '../theory/music'

/** One sample at 44.1kHz — tighter than any error this epic is fixing. */
const ONE_SAMPLE = 1 / 44100

describe('deriveLoopWindow', () => {
  // Step A1 — R4, AC5: the window starts at the groove's own measured head
  // delay, not at a constant shared across the catalogue.
  it('starts the window at the head delay it was given (R4, AC5)', () => {
    const window = deriveLoopWindow(0.025057, 9.142857, 9.16898)

    expect(window.loopStart).toBeCloseTo(0.025057, 6)
    expect(window.loopEnd).toBeCloseTo(9.167914, 6)
  })

  it('takes a different head delay for a different file (R4, AC5)', () => {
    const window = deriveLoopWindow(0.05, 10, 10.1)

    expect(window.loopStart).toBeCloseTo(0.05, 6)
    expect(window.loopEnd).toBeCloseTo(10.05, 6)
  })

  // Step A2 — R4, AC5: a window is clamped to the buffer it sits in.
  it('drops a head delay that does not fit inside the buffer to 0 (R4)', () => {
    const window = deriveLoopWindow(12, 4, 9.16898)

    expect(window.loopStart).toBe(0)
  })

  it('clamps a window that runs past the end of the buffer (R4)', () => {
    const window = deriveLoopWindow(0.025057, 12, 9.16898)

    expect(window.loopStart).toBeCloseTo(0.025057, 6)
    expect(window.loopEnd).toBe(9.16898)
  })

  it('never returns an end before its start (R4)', () => {
    const window = deriveLoopWindow(0, 0, 0)

    expect(window.loopEnd).toBeGreaterThanOrEqual(window.loopStart)
  })

  // Step A3 — R1, AC1: every groove in the catalogue gets a window exactly its
  // own musical length, with no added silence at the loop point.
  describe('across the whole catalogue (R1, AC1)', () => {
    it('has a groove to check', () => {
      expect(GROOVES.length).toBeGreaterThan(0)
    })

    for (const groove of GROOVES) {
      it(`gives ${groove.id} a window of exactly its loop length`, () => {
        const loopSeconds = loopSecondsOf(groove)
        const bufferSeconds = groove.headDelaySeconds + loopSeconds + 0.01
        const { loopStart, loopEnd } = deriveLoopWindow(
          groove.headDelaySeconds,
          loopSeconds,
          bufferSeconds,
        )

        expect(loopStart).toBeCloseTo(groove.headDelaySeconds, 9)
        expect(Math.abs(loopEnd - loopStart - loopSeconds)).toBeLessThan(ONE_SAMPLE)
      })
    }
  })
})

describe('loopPosition', () => {
  // Step A4 — R2, AC2, AC3: elapsed seconds wrap inside the loop.
  it('maps elapsed seconds onto 0..1 of the loop (R2, AC3)', () => {
    expect(loopPosition(2.5, 10)).toBeCloseTo(0.25, 9)
  })

  it('wraps on the second repeat rather than clamping at 1 (R2, AC2)', () => {
    expect(loopPosition(12.5, 10)).toBeCloseTo(0.25, 9)
    expect(loopPosition(10, 10)).toBeCloseTo(0, 9)
  })

  it('puts three eighths of the loop inside bar 2 of four (AC3)', () => {
    const position = loopPosition(3.75, 10)
    expect(position).toBeCloseTo(0.375, 9)
    expect(Math.floor(position * 4)).toBe(1)
  })

  it('reads 0 for a negative elapsed (R2)', () => {
    expect(loopPosition(-0.2, 10)).toBe(0)
  })

  it('reads 0 for a loop length that cannot describe a length (R2)', () => {
    expect(loopPosition(2.5, 0)).toBe(0)
    expect(loopPosition(2.5, -1)).toBe(0)
    expect(loopPosition(2.5, Number.NaN)).toBe(0)
    expect(loopPosition(Number.NaN, 10)).toBe(0)
  })
})
