import { describe, it, expect } from 'vitest'
import { coaching } from '@/lib/snippets'
import type { Attempt } from '../../types'
import {
  selectFeedback,
  shouldShowNudge,
  shouldOfferReveal,
  missCount,
} from './feedback'

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

const ROOT_ONLY = attempt('G', 'Mixolydian', true, false)
const FLAVOUR_ONLY = attempt('C', 'Dorian', false, true)
const NEITHER = attempt('C', 'Mixolydian', false, false)
const EXACT = attempt('G', 'Dorian', true, true)

const misses = (n: number): Attempt[] =>
  Array.from({ length: n }, (_, i) => [NEITHER, ROOT_ONLY, FLAVOUR_ONLY][i % 3])

it('exports no dot state, count or shape (F19 E1 R1)', async () => {
  const feedback = await import('./feedback')
  expect(Object.keys(feedback).sort()).toEqual([
    'missCount',
    'selectFeedback',
    'shouldOfferReveal',
    'shouldShowNudge',
  ])
})

describe('selectFeedback', () => {
  it('gives opening guidance about listening for the tonic before any guess (F22 E2 R6)', () => {
    const feedback = selectFeedback([], false)
    expect(feedback.tone).toBe('neutral')
    expect(feedback.message).toMatch(/home/i)
    expect(feedback.message).toBe(coaching.opening)
  })

  it('names the root as right when only the root matched', () => {
    const feedback = selectFeedback([ROOT_ONLY], false)
    expect(feedback.tone).toBe('warm')
    expect(feedback.message).toMatch(/home note/i)
    expect(feedback.message).toMatch(/right/i)
    expect(feedback.message).not.toMatch(/keep the root/i)
    expect(feedback.message).not.toMatch(/another flavour/i)
    expect(feedback.message).toBe(coaching.rootMatched)
  })

  it('leaves the other three diagnoses untouched (R13 boundary)', () => {
    expect(selectFeedback([FLAVOUR_ONLY], false).message).toBe(
      coaching.flavourMatched,
    )
    expect(selectFeedback([NEITHER], false).message).toBe(coaching.neitherMatched)
    expect(selectFeedback([], false).message).toBe(coaching.opening)
  })

  it('names the mode as right and the tonic as elsewhere when only the mode matched', () => {
    const feedback = selectFeedback([FLAVOUR_ONLY], false)
    expect(feedback.tone).toBe('warm')
    expect(feedback.message).toMatch(/mode/i)
    expect(feedback.message).toMatch(/tonic/i)
  })

  it('says not it, keep playing when neither half matched', () => {
    const feedback = selectFeedback([NEITHER], false)
    expect(feedback.tone).toBe('warm')
    expect(feedback.message).toMatch(/not it/i)
    expect(feedback.message).toMatch(/keep playing/i)
  })

  it('reads only the last attempt, not the whole history', () => {
    expect(selectFeedback([NEITHER, FLAVOUR_ONLY, ROOT_ONLY], false)).toEqual(
      selectFeedback([ROOT_ONLY], false),
    )
    expect(selectFeedback([ROOT_ONLY, NEITHER], false)).toEqual(
      selectFeedback([NEITHER], false),
    )
  })

  it('returns the solved wording when the day is solved, whatever the last attempt was', () => {
    for (const last of [ROOT_ONLY, FLAVOUR_ONLY, NEITHER, EXACT]) {
      const feedback = selectFeedback([NEITHER, ROOT_ONLY, last], true)
      expect(feedback.tone).toBe('solved')
      expect(feedback.message).toMatch(/groove is yours/i)
    }
  })

  it('returns the solved wording even with no attempts recorded', () => {
    expect(selectFeedback([], true).tone).toBe('solved')
  })

  it('gives every case its own wording, not just its own tone', () => {
    const messages = [
      selectFeedback([], false),
      selectFeedback([ROOT_ONLY], false),
      selectFeedback([FLAVOUR_ONLY], false),
      selectFeedback([NEITHER], false),
      selectFeedback([EXACT], true),
    ].map((f) => f.message)
    expect(new Set(messages).size).toBe(messages.length)
  })

  it('carries no raw colour value in any message or tone', () => {
    const all = [
      selectFeedback([], false),
      selectFeedback([ROOT_ONLY], false),
      selectFeedback([FLAVOUR_ONLY], false),
      selectFeedback([NEITHER], false),
      selectFeedback([EXACT], true),
    ]
    for (const feedback of all) {
      expect(feedback.message).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(feedback.tone).not.toMatch(/#/)
    }
  })

  it('is pure — it does not mutate the attempts it is given', () => {
    const attempts = [ROOT_ONLY, NEITHER]
    const before = JSON.stringify(attempts)
    selectFeedback(attempts, false)
    expect(JSON.stringify(attempts)).toBe(before)
  })
})

describe('shouldShowNudge', () => {
  it('is hidden while the app has eliminated nothing (R19, AC18)', () => {
    expect(shouldShowNudge(0, false, false)).toBe(false)
  })

  it('appears once the app has eliminated roots (R17, AC17)', () => {
    expect(shouldShowNudge(2, false, false)).toBe(true)
  })

  it('stays visible while the count stands at the floor (R17b, AC17b)', () => {
    expect(shouldShowNudge(4, false, false)).toBe(true)
  })

  it('is withdrawn once the day is solved', () => {
    expect(shouldShowNudge(2, true, false)).toBe(false)
    expect(shouldShowNudge(0, true, false)).toBe(false)
  })

  it('is withdrawn once the root is confirmed (F18 E3 R1, AC1)', () => {
    expect(shouldShowNudge(2, false, true)).toBe(false)
    expect(shouldShowNudge(4, false, true)).toBe(false)
  })
})

describe('shouldOfferReveal', () => {
  it('is not offered before the third miss', () => {
    expect(shouldOfferReveal([], false, false)).toBe(false)
    expect(shouldOfferReveal(misses(1), false, false)).toBe(false)
    expect(shouldOfferReveal(misses(2), false, false)).toBe(false)
  })

  it('is offered on the third miss', () => {
    expect(shouldOfferReveal(misses(3), false, false)).toBe(true)
  })

  it('stays offered on the fourth and later miss', () => {
    expect(shouldOfferReveal(misses(4), false, false)).toBe(true)
    expect(shouldOfferReveal(misses(6), false, false)).toBe(true)
  })

  it('is never offered on a solved day, however many misses came first', () => {
    expect(shouldOfferReveal(misses(5), true, false)).toBe(false)
    expect(shouldOfferReveal([...misses(2), EXACT], true, false)).toBe(false)
  })

  it('counts only failed attempts, not the solving one', () => {
    expect(shouldOfferReveal([...misses(2), EXACT], false, false)).toBe(false)
  })

  it('stops offering once the day has been revealed', () => {
    expect(shouldOfferReveal(misses(4), false, true)).toBe(false)
    expect(shouldOfferReveal(misses(9), false, true)).toBe(false)
  })

  it('is a pure derivation — same input, same answer, no latch', () => {
    const attempts = misses(3)
    const first = shouldOfferReveal(attempts, false, false)
    const second = shouldOfferReveal(attempts, false, false)
    const third = shouldOfferReveal(attempts, false, false)
    expect([first, second, third]).toEqual([true, true, true])
    expect(shouldOfferReveal(attempts, false, true)).toBe(false)
    expect(shouldOfferReveal(attempts, false, false)).toBe(true)
  })

  it('does not mutate the attempts it is given', () => {
    const attempts = misses(3)
    const before = JSON.stringify(attempts)
    shouldOfferReveal(attempts, false, false)
    expect(JSON.stringify(attempts)).toBe(before)
    expect(attempts).toHaveLength(3)
  })
})

describe('missCount', () => {
  it('counts nothing on a day with no attempts', () => {
    expect(missCount([])).toBe(0)
  })

  it('counts the wrong guesses and not the right one', () => {
    expect(missCount([NEITHER, EXACT, ROOT_ONLY])).toBe(2)
  })
})
