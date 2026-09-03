import { describe, it, expect } from 'vitest'
import type { Answer } from '../../types'
import { FAMILIES, familyOf } from '@/lib/theory/families'
import { exactMatch, familyMatch, scoreAttempt } from './scoring'

const ANSWER: Answer = { root: 'G', flavour: 'Dorian' }

describe('scoreAttempt', () => {
  it('scores an exact pair as correct, with both halves matched', () => {
    expect(scoreAttempt(ANSWER, { root: 'G', flavour: 'Dorian' })).toEqual({
      root: 'G',
      flavour: 'Dorian',
      correct: true,
      rootMatched: true,
      flavourMatched: true,
    })
  })

  it('scores a right root with a wrong flavour as incorrect', () => {
    expect(scoreAttempt(ANSWER, { root: 'G', flavour: 'Mixolydian' })).toEqual({
      root: 'G',
      flavour: 'Mixolydian',
      correct: false,
      rootMatched: true,
      flavourMatched: false,
    })
  })

  it('scores a wrong root with a right flavour as incorrect', () => {
    expect(scoreAttempt(ANSWER, { root: 'C', flavour: 'Dorian' })).toEqual({
      root: 'C',
      flavour: 'Dorian',
      correct: false,
      rootMatched: false,
      flavourMatched: true,
    })
  })

  it('scores a wholly wrong pair with both halves unmatched', () => {
    expect(scoreAttempt(ANSWER, { root: 'C', flavour: 'Mixolydian' })).toEqual({
      root: 'C',
      flavour: 'Mixolydian',
      correct: false,
      rootMatched: false,
      flavourMatched: false,
    })
  })

  it('matches by exact string equality on the flavour', () => {
    expect(scoreAttempt(ANSWER, { root: 'G', flavour: 'dorian' }).correct).toBe(
      false,
    )
  })
})

describe('the flavour matcher', () => {
  const MODES = [
    'Ionian',
    'Dorian',
    'Phrygian',
    'Lydian',
    'Mixolydian',
    'Aeolian',
  ]

  it('defaults to exact string equality, so existing callers are unchanged', () => {
    const guess = { root: 'G' as const, flavour: 'Dorian' }
    expect(scoreAttempt(ANSWER, guess)).toEqual(
      scoreAttempt(ANSWER, guess, exactMatch),
    )
    expect(scoreAttempt(ANSWER, { root: 'G', flavour: 'Minor' })).toEqual(
      scoreAttempt(ANSWER, { root: 'G', flavour: 'Minor' }, exactMatch),
    )
  })

  describe('exactMatch', () => {
    it('accepts only the mode itself', () => {
      expect(exactMatch('Dorian', 'Dorian')).toBe(true)
      expect(exactMatch('Dorian', 'Minor')).toBe(false)
      expect(exactMatch('Dorian', 'dorian')).toBe(false)
    })
  })

  describe('familyMatch', () => {
    it("accepts the mode's family", () => {
      expect(familyMatch('Dorian', 'Minor')).toBe(true)
      expect(familyMatch('Mixolydian', 'Major')).toBe(true)
    })

    it('rejects the other family', () => {
      expect(familyMatch('Dorian', 'Major')).toBe(false)
      expect(familyMatch('Mixolydian', 'Minor')).toBe(false)
    })

    it('rejects the mode name itself, which simple mode never offers', () => {
      expect(familyMatch('Dorian', 'Dorian')).toBe(false)
    })

    it('throws for a mode outside the vocabulary rather than grading it', () => {
      expect(() => familyMatch('Locrian', 'Minor')).toThrow()
    })
  })

  describe('scoreAttempt under familyMatch', () => {
    const DORIAN: Answer = { root: 'E', flavour: 'Dorian' }
    const MIXO: Answer = { root: 'E', flavour: 'Mixolydian' }

    it('solves a Dorian day from its root and the minor option (R5, AC4)', () => {
      expect(
        scoreAttempt(DORIAN, { root: 'E', flavour: 'Minor' }, familyMatch),
      ).toEqual({
        root: 'E',
        flavour: 'Minor',
        correct: true,
        rootMatched: true,
        flavourMatched: true,
      })
    })

    it('records what the player pressed, not the mode behind it', () => {
      expect(
        scoreAttempt(DORIAN, { root: 'E', flavour: 'Minor' }, familyMatch)
          .flavour,
      ).toBe('Minor')
    })

    it('misses that same guess under the full puzzle (AC4)', () => {
      expect(
        scoreAttempt(DORIAN, { root: 'E', flavour: 'Minor' }, exactMatch)
          .correct,
      ).toBe(false)
    })

    it('misses a Mixolydian day guessed minor (R5, AC5)', () => {
      const attempt = scoreAttempt(
        MIXO,
        { root: 'E', flavour: 'Minor' },
        familyMatch,
      )
      expect(attempt.correct).toBe(false)
      expect(attempt.flavourMatched).toBe(false)
      expect(attempt.rootMatched).toBe(true)
    })

    it('still requires the right root (R5)', () => {
      expect(
        scoreAttempt(DORIAN, { root: 'C', flavour: 'Minor' }, familyMatch),
      ).toEqual({
        root: 'C',
        flavour: 'Minor',
        correct: false,
        rootMatched: false,
        flavourMatched: true,
      })
    })

    it.each(MODES)(
      'accepts exactly one of the two options for a %s day (AC6)',
      (mode) => {
        const answer: Answer = { root: 'E', flavour: mode }
        const accepted = FAMILIES.filter(
          (family) =>
            scoreAttempt(answer, { root: 'E', flavour: family }, familyMatch)
              .correct,
        )
        expect(accepted).toEqual([familyOf(mode)])
      },
    )
  })
})
