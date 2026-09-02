import { describe, it, expect } from 'vitest'
import type { Attempt } from '../../types'
import { confirmedHalves } from './confirmed'
import { coachingPosition } from './coachingFamily'

const attempt = (
  root: Attempt['root'],
  flavour: string,
  rootMatched: boolean,
  flavourMatched: boolean,
): Attempt => ({
  root,
  flavour,
  correct: rootMatched && flavourMatched,
  rootMatched,
  flavourMatched,
})

const ROOT_ONLY = attempt('C', 'Dorian', true, false)
const OTHER_ROOT_ONLY = attempt('C', 'Lydian', true, false)
const FLAVOUR_ONLY = attempt('G', 'Aeolian', false, true)
const LOCKED_MISS = attempt('A', 'Aeolian', false, true)
const NEITHER = attempt('G', 'Dorian', false, false)
const OTHER_NEITHER = attempt('A', 'Lydian', false, false)
const EXACT = attempt('C', 'Aeolian', true, true)

describe('coachingPosition', () => {
  it('starts at the front of the general ladder before anything is checked (R5, AC3)', () => {
    expect(coachingPosition([])).toEqual({ family: 'general', index: 0 })
  })

  it('walks the general ladder while neither half is confirmed (R5, AC3)', () => {
    expect(coachingPosition([NEITHER])).toEqual({ family: 'general', index: 1 })
    expect(coachingPosition([NEITHER, OTHER_NEITHER])).toEqual({
      family: 'general',
      index: 2,
    })
    expect(
      coachingPosition([NEITHER, OTHER_NEITHER, NEITHER, OTHER_NEITHER]).index,
    ).toBe(4)
  })

  it('opens the colour family at its first move when the root is confirmed (R1, R2, R3, R7a, AC2)', () => {
    expect(coachingPosition([ROOT_ONLY])).toEqual({
      family: 'colour',
      index: 0,
    })
  })

  it('opens the tonic family at its first move when the mode is confirmed (R1, R2, R4, R7a, AC1)', () => {
    expect(coachingPosition([FLAVOUR_ONLY])).toEqual({
      family: 'tonic',
      index: 0,
    })
  })

  it('keeps the two halves independent (R1, R2)', () => {
    expect(coachingPosition([ROOT_ONLY, OTHER_ROOT_ONLY]).family).toBe('colour')
    expect(coachingPosition([FLAVOUR_ONLY, LOCKED_MISS]).family).toBe('tonic')
  })

  it('enters a family at its own first move, not at the rung the ladder reached (R7a, AC12)', () => {
    expect(coachingPosition([NEITHER, OTHER_NEITHER, FLAVOUR_ONLY])).toEqual({
      family: 'tonic',
      index: 0,
    })
    expect(coachingPosition([NEITHER, OTHER_NEITHER, ROOT_ONLY])).toEqual({
      family: 'colour',
      index: 0,
    })
  })

  it('counts from the entering miss, not from the day’s first miss (R7b, AC13)', () => {
    expect(
      coachingPosition([NEITHER, OTHER_NEITHER, FLAVOUR_ONLY, LOCKED_MISS])
        .index,
    ).toBe(1)
    expect(coachingPosition([FLAVOUR_ONLY, LOCKED_MISS]).index).toBe(1)
    expect(coachingPosition([NEITHER, ROOT_ONLY, OTHER_ROOT_ONLY]).index).toBe(1)
  })

  it('keeps counting past the end of a table — the clamp is the selector’s (R7d, AC14)', () => {
    const long = [
      NEITHER,
      OTHER_NEITHER,
      FLAVOUR_ONLY,
      LOCKED_MISS,
      LOCKED_MISS,
      LOCKED_MISS,
    ]
    expect(coachingPosition(long)).toEqual({ family: 'tonic', index: 3 })
  })

  it('never returns to the general ladder once a half is confirmed (R7, AC7)', () => {
    const day = [NEITHER, FLAVOUR_ONLY, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS]
    for (let n = 2; n <= day.length; n++) {
      expect(coachingPosition(day.slice(0, n)).family).toBe('tonic')
    }
  })

  it('reads confirmedHalves, not matchedHalf on the last attempt (R1, AC4)', () => {
    const day = [ROOT_ONLY, NEITHER, OTHER_NEITHER]
    expect(coachingPosition(day)).toEqual({ family: 'colour', index: 2 })
    expect(confirmedHalves(day).roots).not.toEqual([])

    for (const attempts of [day, [FLAVOUR_ONLY, NEITHER], [NEITHER], []]) {
      const { roots, flavours } = confirmedHalves(attempts)
      const expected =
        roots.length === 0 && flavours.length === 0
          ? 'general'
          : flavours.length === 0
            ? 'colour'
            : roots.length === 0
              ? 'tonic'
              : coachingPosition(attempts).family
      expect(coachingPosition(attempts).family).toBe(expected)
    }
  })

  it('takes the family entered most recently when both halves are confirmed (R7a)', () => {
    expect(coachingPosition([ROOT_ONLY, FLAVOUR_ONLY])).toEqual({
      family: 'tonic',
      index: 0,
    })
    expect(coachingPosition([FLAVOUR_ONLY, ROOT_ONLY])).toEqual({
      family: 'colour',
      index: 0,
    })
    expect(coachingPosition([ROOT_ONLY, NEITHER, FLAVOUR_ONLY]).index).toBe(0)
  })

  it('is total over any attempt list and mutates nothing', () => {
    const attempts = [NEITHER, ROOT_ONLY, EXACT]
    const before = JSON.stringify(attempts)
    expect(() => coachingPosition(attempts)).not.toThrow()
    expect(JSON.stringify(attempts)).toBe(before)
    expect(coachingPosition([EXACT]).index).toBeGreaterThanOrEqual(0)
    for (const list of [[], [EXACT], [NEITHER], [FLAVOUR_ONLY, EXACT]]) {
      expect(coachingPosition(list).index).toBeGreaterThanOrEqual(0)
    }
  })

  it('does not count a solved attempt as a miss (R7b, R2)', () => {
    expect(coachingPosition([ROOT_ONLY, EXACT, LOCKED_MISS])).toEqual({
      family: 'colour',
      index: 1,
    })
    expect(coachingPosition([NEITHER, OTHER_NEITHER, EXACT]).index).toBe(0)
  })
})
