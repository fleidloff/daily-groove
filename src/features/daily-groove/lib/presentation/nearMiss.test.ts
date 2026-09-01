import { describe, it, expect } from 'vitest'
import { selectNearMiss } from './nearMiss'
import { degreeDifferences } from '../theory/difference'
import { FAMILIES, familyOf } from '../theory/families'
import { UnknownFlavourError } from '../theory/notes'
import { GROOVES } from '../../data/grooves.generated'
import type { Answer, Attempt, Flavour, Root } from '../../types'

/**
 * Every mode the shipped manifest can play, derived rather than listed — a
 * hardcoded list would stop covering the day a thirteenth mode is minted, which
 * is the lesson `families.ts` paid for.
 */
const MODES: Flavour[] = [...new Set(GROOVES.map((groove) => groove.flavour))]

/** The epic's headline day: G Mixolydian, one degree from Dorian. */
const mixolydianDay: Answer = { root: 'G', flavour: 'Mixolydian' }

/**
 * A wrong attempt, with both matched flags computed against the day's answer
 * rather than hand-written — so no test can assert against an attempt the game
 * could never have stored.
 */
function wrong(flavour: Flavour, root: Root, answer: Answer = mixolydianDay): Attempt {
  return {
    root,
    flavour,
    correct: false,
    rootMatched: root === answer.root,
    flavourMatched: flavour === answer.flavour,
  }
}

/** The attempt that ended a solved day. */
function right(answer: Answer = mixolydianDay): Attempt {
  return {
    root: answer.root,
    flavour: answer.flavour,
    correct: true,
    rootMatched: true,
    flavourMatched: true,
  }
}

/**
 * Every sentence the function can produce on the shipped catalogue: each
 * ordered pair of modes as a wrong colour, and each mode as a right colour with
 * the wrong root. Derived from the manifest rather than written out — a list of
 * sentences would stop covering the day a thirteenth mode is minted.
 */
function everyProducibleLine(): string[] {
  const lines: string[] = []

  for (const flavour of MODES) {
    const answer: Answer = { root: 'G', flavour }

    for (const guessed of MODES) {
      if (guessed === flavour) continue
      const line = selectNearMiss([wrong(guessed, 'C', answer)], answer)
      if (line !== undefined) lines.push(line)
    }

    const rightColour = selectNearMiss([wrong(flavour, 'C', answer)], answer)
    if (rightColour !== undefined) lines.push(rightColour)
  }

  return lines
}

describe('selectNearMiss', () => {
  // Step B1 — R6, AC6
  it('has nothing to say about a day given up on with no guesses spent', () => {
    expect(selectNearMiss([], mixolydianDay)).toBeUndefined()
  })

  // Step B1 — R6, AC5
  it('has nothing to say about a day solved on the first guess', () => {
    expect(selectNearMiss([right()], mixolydianDay)).toBeUndefined()
  })

  // Step B2 — R5, R5a, AC4
  it('says nothing about a simple-mode guess, and never asks the interval table', () => {
    expect(MODES.length).toBeGreaterThan(0)

    for (const flavour of MODES) {
      const answer: Answer = { root: 'G', flavour }
      for (const family of FAMILIES) {
        const attempt = wrong(family, 'C', answer)

        // The guard: no line, and no throw on the way to deciding that.
        expect(() => selectNearMiss([attempt], answer)).not.toThrow()
        expect(selectNearMiss([attempt], answer)).toBeUndefined()

        // The proof that the guard is what saved it: the arithmetic the
        // function did not reach throws for this very pair. Together with the
        // assertion above, that is R5a — with no spy and no mock of an
        // internal path.
        expect(() => degreeDifferences(family, flavour)).toThrow(UnknownFlavourError)
      }
    }
  })

  it('says nothing when a simple-mode guess had the family right and the root wrong', () => {
    // The case the sweep above cannot reach. `wrong()` derives
    // `flavourMatched` from `flavour === answer.flavour`, and a Family never
    // equals a mode — so every attempt it builds is `flavourMatched: false`,
    // which the comparability guard alone turns away. Simple mode does not
    // score it that way: it grades the flavour half with `familyMatch`, so the
    // right family with the wrong root is stored `flavourMatched: true`, and
    // that lands on the right-mode-wrong-root branch instead.
    //
    // Today the family guard sits above that branch and this returns
    // undefined. Nothing else asserted it: remove the guard and roughly half of
    // all real simple-mode misses would print "the colour was right, not the
    // home note" on a day whose mode the player was never asked for.
    for (const flavour of MODES) {
      const answer: Answer = { root: 'G', flavour }
      const attempt: Attempt = {
        root: 'C',
        flavour: familyOf(flavour),
        correct: false,
        rootMatched: false,
        flavourMatched: true,
      }

      expect(selectNearMiss([attempt], answer)).toBeUndefined()
    }
  })

  // Step B3 — R4, AC3
  it('says the colour was right where only the root was wrong', () => {
    expect(selectNearMiss([wrong('Mixolydian', 'C')], mixolydianDay)).toBe(
      'You said Mixolydian — the colour was right, not the home note.',
    )
  })

  // Step B3 — R4, AC3
  it('names no degree on the right-colour line', () => {
    const line = selectNearMiss([wrong('Mixolydian', 'C')], mixolydianDay)
    expect(line).toBeDefined()
    expect(line).not.toMatch(/[0-9♭♯]/)
  })

  // Step B4 — R4, AC1
  it('treats a guess that missed both halves as a wrong colour, not a wrong root', () => {
    const bothWrong = selectNearMiss([wrong('Dorian', 'C')], mixolydianDay)
    const rightRoot = selectNearMiss([wrong('Dorian', 'G')], mixolydianDay)

    expect(bothWrong).toBeDefined()
    expect(bothWrong).toBe(rightRoot)
  })

  // Step B5 — R1, R3, R7, AC1
  it('names the single degree that separates the guess from the answer', () => {
    expect(selectNearMiss([wrong('Dorian', 'G')], mixolydianDay)).toBe(
      'You said Dorian — one note apart: ♭3, not 3.',
    )
  })

  // Step B6 — R3, R7, AC7a
  it('names both degrees, in degree order, where two of them differ', () => {
    expect(selectNearMiss([wrong('Lydian', 'G')], mixolydianDay)).toBe(
      'You said Lydian — two notes apart: ♯4 and 7, not 4 and ♭7.',
    )
  })

  // Step B7 — R7, R7a, R7b, AC7
  it('says plainly that a distant guess is far off, and names no degree', () => {
    const line = selectNearMiss([wrong('Phrygian', 'G')], mixolydianDay)

    expect(line).toBe('You said Phrygian — a long way from this one, not a near miss.')
    expect(line).not.toMatch(/[0-9]/)
  })

  // Step B7 — R7b, AC12
  it('gives a blues day the same plain wording, in both directions', () => {
    const bluesDay: Answer = { root: 'C', flavour: 'Blues' }
    expect(selectNearMiss([wrong('Dorian', 'C', bluesDay)], bluesDay)).toBe(
      'You said Dorian — a long way from this one, not a near miss.',
    )

    const dorianDay: Answer = { root: 'C', flavour: 'Dorian' }
    expect(selectNearMiss([wrong('Blues', 'C', dorianDay)], dorianDay)).toBe(
      'You said Blues — a long way from this one, not a near miss.',
    )
  })

  // Step B8 — R2, AC2
  it('speaks about the last incorrect guess, not the first', () => {
    const spent = [wrong('Ionian', 'C'), wrong('Lydian', 'A'), wrong('Dorian', 'G')]
    const line = selectNearMiss(spent, mixolydianDay)

    expect(line).toContain('Dorian')
    expect(line).not.toContain('Ionian')
    expect(line).not.toContain('Lydian')
  })

  // Step B8 — R2, R11, AC2
  it('still speaks about the last miss on a day solved after it', () => {
    const spent = [wrong('Ionian', 'C'), wrong('Lydian', 'A'), wrong('Dorian', 'G')]

    expect(selectNearMiss([...spent, right()], mixolydianDay)).toBe(
      selectNearMiss(spent, mixolydianDay),
    )
    expect(selectNearMiss([...spent, right()], mixolydianDay)).toBe(
      'You said Dorian — one note apart: ♭3, not 3.',
    )
  })

  // Step B9 — R5a, R6
  it('says nothing about a stored guess the interval table cannot read', () => {
    const attempt = wrong('Klingon', 'G')

    expect(() => selectNearMiss([attempt], mixolydianDay)).not.toThrow()
    expect(selectNearMiss([attempt], mixolydianDay)).toBeUndefined()
  })

  // Step B9 — R6
  it('says nothing where the two scales turn out to be the same one', () => {
    const dorianDay: Answer = { root: 'G', flavour: 'Dorian' }
    // Equal scale, unequal string: the guess is scored a miss on its flavour,
    // and the comparison then has no degree to name.
    const attempt = wrong('dorian', 'G', dorianDay)

    expect(attempt.flavourMatched).toBe(false)
    expect(selectNearMiss([attempt], dorianDay)).toBeUndefined()
  })

  // Step B9 — R5a, R6
  it('says nothing where the answer’s own flavour has no interval entry', () => {
    const unknownDay: Answer = { root: 'G', flavour: 'Klingon' }
    const attempt = wrong('Dorian', 'G', unknownDay)

    expect(() => selectNearMiss([attempt], unknownDay)).not.toThrow()
    expect(selectNearMiss([attempt], unknownDay)).toBeUndefined()
  })

  // Step B10 — R7a, R8, R10, AC10
  it('keeps every line it can produce inside the box, and never scolds', () => {
    const lines = everyProducibleLine()

    // One line per ordered mode pair plus one right-colour line per mode —
    // `MODES.length ** 2` — so the set is total over the catalogue and no
    // assertion below passes vacuously.
    expect(lines).toHaveLength(MODES.length ** 2)
    // All four shapes are in the set: the two that name degrees, the plain one,
    // and the right-colour one.
    expect(lines.some((line) => line.includes('one note apart'))).toBe(true)
    expect(lines.some((line) => line.includes('two notes apart'))).toBe(true)
    expect(lines.some((line) => line.includes('a long way from this one'))).toBe(true)
    expect(lines.some((line) => line.includes('the colour was right'))).toBe(true)

    for (const line of lines) {
      expect(line).toMatch(/^You said /)
      // 72 characters is Epic 1's ceiling, the proxy for two visual lines at
      // 360px. `Phrygian dominant` is the mode name that tests it.
      expect(line.length, `too long (${line.length}): ${line}`).toBeLessThanOrEqual(72)
      // One sentence: no full stop, question mark or exclamation mid-line.
      expect(line).not.toMatch(/[.!?]\s/)
      expect(line).not.toMatch(/wrong|should|failed|too far|bad\b/i)
      expect(line.endsWith('!')).toBe(false)
    }
  })

  // Step B10 — R7a
  it('reads the same in every key', () => {
    const inFSharp = selectNearMiss([wrong('Dorian', 'C')], {
      root: 'F♯',
      flavour: 'Mixolydian',
    })

    expect(inFSharp).toBe(selectNearMiss([wrong('Dorian', 'G')], mixolydianDay))
  })
})
