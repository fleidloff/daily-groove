import { describe, it, expect } from 'vitest'
import type { Attempt } from '../../types'
import { confirmedHalves } from './confirmed'
import { shouldShowVerdict } from './verdict'

const attempt = (
  root: Attempt['root'],
  flavour: Attempt['flavour'],
  rootMatched: boolean,
  flavourMatched: boolean,
): Attempt => ({
  root,
  flavour,
  correct: rootMatched && flavourMatched,
  rootMatched,
  flavourMatched,
})

const ROOT_ONLY = attempt('G', 'Mixolydian', true, false)
const FLAVOUR_ONLY = attempt('C', 'Dorian', false, true)
const NEITHER = attempt('C', 'Mixolydian', false, false)
const EXACT = attempt('G', 'Dorian', true, true)

const verdictCount = (attempts: Attempt[]): number =>
  attempts.filter((_, index) => shouldShowVerdict(attempts.slice(0, index + 1)))
    .length

describe('shouldShowVerdict', () => {
  it('has nothing to be a verdict about on a day with no attempts', () => {
    expect(shouldShowVerdict([])).toBe(false)
  })

  it.each([
    ['matching neither half', [NEITHER]],
    ['matching the root', [ROOT_ONLY]],
    ['matching the mode', [FLAVOUR_ONLY]],
  ])('keeps its words on the first miss, %s', (_label, attempts) => {
    expect(shouldShowVerdict(attempts)).toBe(true)
  })

  it('is silent on a later miss that confirms nothing', () => {
    expect(shouldShowVerdict([NEITHER, NEITHER])).toBe(false)
    expect(shouldShowVerdict([NEITHER, NEITHER, NEITHER])).toBe(false)
    expect(shouldShowVerdict([NEITHER, NEITHER, NEITHER, NEITHER])).toBe(false)
  })

  it('keeps its words on the miss that first confirms a half', () => {
    expect(shouldShowVerdict([NEITHER, NEITHER, FLAVOUR_ONLY])).toBe(true)
    expect(shouldShowVerdict([NEITHER, ROOT_ONLY])).toBe(true)
  })

  it('agrees with confirmedHalves about which miss was the confirmation', () => {
    const attempts = [NEITHER, NEITHER, FLAVOUR_ONLY]
    expect(confirmedHalves(attempts.slice(0, -1)).flavours).toHaveLength(0)
    expect(confirmedHalves(attempts).flavours).not.toHaveLength(0)
    expect(shouldShowVerdict(attempts)).toBe(true)
  })

  it('is silent when an already confirmed half matches again', () => {
    expect(shouldShowVerdict([NEITHER, FLAVOUR_ONLY, FLAVOUR_ONLY])).toBe(false)
    expect(shouldShowVerdict([NEITHER, ROOT_ONLY, ROOT_ONLY])).toBe(false)
  })

  it.each([
    ['the mode', FLAVOUR_ONLY],
    ['the root', ROOT_ONLY],
  ])(
    'stays silent as a row locked to one live chip keeps matching %s',
    (_label, confirming) => {
      const attempts = [NEITHER, confirming]
      expect(shouldShowVerdict(attempts)).toBe(true)

      for (let extra = 1; extra <= 5; extra += 1) {
        attempts.push(confirming)
        expect(shouldShowVerdict(attempts)).toBe(false)
      }
      expect(attempts).toHaveLength(7)
    },
  )

  it.each([
    [
      'neither, then the root confirmed and re-matched',
      [
        NEITHER,
        NEITHER,
        ROOT_ONLY,
        ROOT_ONLY,
        NEITHER,
        ROOT_ONLY,
        ROOT_ONLY,
        ROOT_ONLY,
      ],
    ],
    [
      'both halves matched across the day',
      [
        ROOT_ONLY,
        FLAVOUR_ONLY,
        ROOT_ONLY,
        FLAVOUR_ONLY,
        NEITHER,
        ROOT_ONLY,
        FLAVOUR_ONLY,
        NEITHER,
      ],
    ],
    [
      'nothing ever confirmed',
      [
        NEITHER,
        NEITHER,
        NEITHER,
        NEITHER,
        NEITHER,
        NEITHER,
        NEITHER,
        NEITHER,
      ],
    ],
  ])(
    'shows at most two verdicts over a day of eight misses — %s',
    (_label, attempts) => {
      expect(verdictCount(attempts)).toBeLessThanOrEqual(2)
    },
  )

  it('shows exactly two when a later miss confirms a half', () => {
    expect(verdictCount([NEITHER, NEITHER, ROOT_ONLY, ROOT_ONLY])).toBe(2)
  })

  it('fires a third time only where a locked row makes the sequence unreachable', () => {
    const bothHalvesSeparately = [NEITHER, ROOT_ONLY, FLAVOUR_ONLY]

    expect(verdictCount(bothHalvesSeparately)).toBe(3)

    const afterRootConfirmed = bothHalvesSeparately.slice(
      bothHalvesSeparately.findIndex((attempt) => attempt.rootMatched) + 1,
    )
    expect(afterRootConfirmed.some((attempt) => !attempt.rootMatched)).toBe(true)
  })

  it('carries no verdict on a solve', () => {
    expect(shouldShowVerdict([EXACT])).toBe(false)
    expect(shouldShowVerdict([NEITHER, EXACT])).toBe(false)
  })

  it('is a pure derivation that mutates nothing', () => {
    const attempts: Attempt[] = [NEITHER, NEITHER, FLAVOUR_ONLY]
    const before = structuredClone(attempts)
    const first = shouldShowVerdict(attempts)
    const second = shouldShowVerdict(attempts)
    expect(first).toBe(second)
    expect(attempts).toEqual(before)
  })
})
