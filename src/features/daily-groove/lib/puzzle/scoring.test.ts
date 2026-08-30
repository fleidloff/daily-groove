import { describe, it, expect } from 'vitest'
import type { Answer } from '../../types'
import { scoreAttempt } from './scoring'

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
