import { describe, it, expect } from 'vitest'
import type { Attempt } from '../../types'
import { selectFeedback, shouldShowNudge, dotStates } from './feedback'

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
  it('names the flavour as close and the tonic as elsewhere when only the flavour matched', () => {
    const feedback = selectFeedback([FLAVOUR_ONLY], false)
    expect(feedback.tone).toBe('warm')
    expect(feedback.message).toMatch(/flavour/i)
    expect(feedback.message).toMatch(/close/i)
    expect(feedback.message).toMatch(/tonic/i)
  })

  // Step A4 — R3, AC7
  it('says not it, no penalty, keep playing when neither half matched', () => {
    const feedback = selectFeedback([NEITHER], false)
    expect(feedback.tone).toBe('warm')
    expect(feedback.message).toMatch(/not it/i)
    expect(feedback.message).toMatch(/no penalty/i)
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
})
