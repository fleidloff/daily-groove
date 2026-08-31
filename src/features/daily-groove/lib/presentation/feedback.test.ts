import { describe, it, expect } from 'vitest'
import type { Attempt } from '../../types'
import {
  selectFeedback,
  shouldShowNudge,
  shouldOfferReveal,
  dotStates,
} from './feedback'

/** The day's answer throughout: G Dorian. */
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

/** G Mixolydian against G Dorian — right root, wrong flavour. */
const ROOT_ONLY = attempt('G', 'Mixolydian', true, false)
/** C Dorian against G Dorian — right flavour, wrong root. */
const FLAVOUR_ONLY = attempt('C', 'Dorian', false, true)
/** C Mixolydian against G Dorian — neither half right. */
const NEITHER = attempt('C', 'Mixolydian', false, false)
/** G Dorian against G Dorian. */
const EXACT = attempt('G', 'Dorian', true, true)

/** A list of exactly `n` missed guesses, cycling the three wrong shapes. */
const misses = (n: number): Attempt[] =>
  Array.from({ length: n }, (_, i) => [NEITHER, ROOT_ONLY, FLAVOUR_ONLY][i % 3])

describe('selectFeedback', () => {
  // Step A1 — R4, AC4
  it('gives opening guidance about listening for the tonic before any guess', () => {
    const feedback = selectFeedback([], false)
    expect(feedback.tone).toBe('neutral')
    expect(feedback.message).toMatch(/rest/i)
    expect(feedback.message.length).toBeGreaterThan(0)
  })

  // Step A2 — R3, AC5
  it('names the root as right when only the root matched', () => {
    const feedback = selectFeedback([ROOT_ONLY], false)
    expect(feedback.tone).toBe('warm')
    expect(feedback.message).toMatch(/home note/i)
    expect(feedback.message).toMatch(/right/i)
  })

  // Step A3 — R3, AC6
  it('names the mode as right and the tonic as elsewhere when only the mode matched', () => {
    const feedback = selectFeedback([FLAVOUR_ONLY], false)
    expect(feedback.tone).toBe('warm')
    expect(feedback.message).toMatch(/mode/i)
    expect(feedback.message).toMatch(/tonic/i)
  })

  // Step A4 — R3, AC7
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

  // Step A5 — R9, AC13
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

  // Step I1 support — R10, AC14: never colour alone
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
  // Step A6 — R5, AC8, AC12
  it('is hidden before any guess', () => {
    expect(shouldShowNudge([], false)).toBe(false)
  })

  it('is hidden after one failed guess', () => {
    expect(shouldShowNudge([NEITHER], false)).toBe(false)
  })

  it('appears on the second failed guess', () => {
    expect(shouldShowNudge([NEITHER, ROOT_ONLY], false)).toBe(true)
  })

  it('stays visible on the third and fourth failed guess', () => {
    expect(shouldShowNudge([NEITHER, ROOT_ONLY, FLAVOUR_ONLY], false)).toBe(true)
    expect(
      shouldShowNudge([NEITHER, ROOT_ONLY, FLAVOUR_ONLY, NEITHER], false),
    ).toBe(true)
  })

  it('is withdrawn once the day is solved', () => {
    expect(
      shouldShowNudge([NEITHER, ROOT_ONLY, FLAVOUR_ONLY, EXACT], true),
    ).toBe(false)
  })

  it('counts only failed attempts, not correct ones', () => {
    // One miss plus the solving attempt is still one miss.
    expect(shouldShowNudge([NEITHER, EXACT], false)).toBe(false)
  })
})

describe('dotStates', () => {
  // Step A7 — R1, R2, AC1, AC2, AC3
  it('is three unspent dots before any guess', () => {
    expect(dotStates([], false)).toEqual(['unspent', 'unspent', 'unspent'])
  })

  it('spends one dot after one failed guess', () => {
    expect(dotStates([NEITHER], false)).toEqual(['spent', 'unspent', 'unspent'])
  })

  it('spends two dots after two failed guesses', () => {
    expect(dotStates([NEITHER, ROOT_ONLY], false)).toEqual([
      'spent',
      'spent',
      'unspent',
    ])
  })

  it('caps at three spent dots after five failed guesses', () => {
    const five = [NEITHER, ROOT_ONLY, FLAVOUR_ONLY, NEITHER, ROOT_ONLY]
    expect(dotStates(five, false)).toEqual(['spent', 'spent', 'spent'])
  })

  it('turns every dot solved once the day is solved', () => {
    expect(dotStates([NEITHER, EXACT], true)).toEqual([
      'solved',
      'solved',
      'solved',
    ])
    expect(dotStates([], true)).toEqual(['solved', 'solved', 'solved'])
  })

  it('is always exactly three entries long', () => {
    const attempts: Attempt[] = []
    for (let i = 0; i <= 8; i++) {
      expect(dotStates(attempts, false)).toHaveLength(3)
      expect(dotStates(attempts, true)).toHaveLength(3)
      attempts.push(NEITHER)
    }
  })

  it('does not mutate the attempts it is given', () => {
    const attempts = [NEITHER, ROOT_ONLY]
    dotStates(attempts, false)
    expect(attempts).toHaveLength(2)
  })
  // Step A3 — E3 R3, AC2: the row marks par, not lives. A fourth miss is
  // scored and recorded and still leaves the row exactly three dots wide.
  it('leaves the row full, and three wide, after a fourth miss', () => {
    const four = dotStates(misses(4), false)
    expect(four).toHaveLength(3)
    expect(four.every((dot) => dot === 'spent')).toBe(true)
  })
})

describe('shouldOfferReveal', () => {
  // Step A1 — E3 R6, R11, AC6, AC7
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
    // Two misses plus a correct pair is still two misses.
    expect(shouldOfferReveal([...misses(2), EXACT], false, false)).toBe(false)
  })

  // Step A2 — E3 R11, R12, AC12
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
    // Nothing is remembered between calls: revealing and un-revealing the same
    // list flips the answer back, which a stored flag could not do.
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
