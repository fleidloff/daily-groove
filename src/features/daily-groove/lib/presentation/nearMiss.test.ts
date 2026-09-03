import { describe, it, expect } from 'vitest'
import { coaching } from '@/lib/snippets'
import { selectNearMiss } from './nearMiss'
import { degreeDifferences } from '@/lib/theory/difference'
import { FAMILIES, familyOf } from '@/lib/theory/families'
import { UnknownFlavourError } from '@/lib/theory/notes'
import { GROOVES } from '../../data/grooves.generated'
import type { Answer, Attempt, Flavour, Root } from '../../types'

const MODES: Flavour[] = [...new Set(GROOVES.map((groove) => groove.flavour))]

const mixolydianDay: Answer = { root: 'G', flavour: 'Mixolydian' }

function wrong(flavour: Flavour, root: Root, answer: Answer = mixolydianDay): Attempt {
  return {
    root,
    flavour,
    correct: false,
    rootMatched: root === answer.root,
    flavourMatched: flavour === answer.flavour,
  }
}

function right(answer: Answer = mixolydianDay): Attempt {
  return {
    root: answer.root,
    flavour: answer.flavour,
    correct: true,
    rootMatched: true,
    flavourMatched: true,
  }
}

function everyProducibleLine(): string[] {
  const lines: string[] = []

  for (const flavour of MODES) {
    const answer: Answer = { root: 'G', flavour }

    for (const guessed of MODES) {
      if (guessed === flavour) continue
      const line = selectNearMiss([wrong(guessed, 'C', answer)], answer, true)
      if (line !== undefined) lines.push(line)
    }

    const rightColour = selectNearMiss([wrong(flavour, 'C', answer)], answer, true)
    if (rightColour !== undefined) lines.push(rightColour)
  }

  return lines
}

describe('selectNearMiss', () => {
  it('has nothing to say about a day given up on with no guesses spent', () => {
    expect(selectNearMiss([], mixolydianDay, true)).toBeUndefined()
  })

  it('has nothing to say about a day solved on the first guess', () => {
    expect(selectNearMiss([right()], mixolydianDay, false)).toBeUndefined()
    expect(selectNearMiss([right()], mixolydianDay, true)).toBeUndefined()
  })

  it('says nothing about a simple-mode guess, and never asks the interval table', () => {
    expect(MODES.length).toBeGreaterThan(0)

    for (const flavour of MODES) {
      const answer: Answer = { root: 'G', flavour }
      for (const family of FAMILIES) {
        const attempt = wrong(family, 'C', answer)

        expect(() => selectNearMiss([attempt], answer, true)).not.toThrow()
        expect(selectNearMiss([attempt], answer, true)).toBeUndefined()

        expect(() => degreeDifferences(family, flavour)).toThrow(UnknownFlavourError)
      }
    }
  })

  it('says nothing when a simple-mode guess had the family right and the root wrong', () => {
    for (const flavour of MODES) {
      const answer: Answer = { root: 'G', flavour }
      const attempt: Attempt = {
        root: 'C',
        flavour: familyOf(flavour),
        correct: false,
        rootMatched: false,
        flavourMatched: true,
      }

      expect(selectNearMiss([attempt], answer, true)).toBeUndefined()
    }
  })

  it('says the colour was right where only the root was wrong', () => {
    expect(selectNearMiss([wrong('Mixolydian', 'C')], mixolydianDay, true)).toBe(
      coaching.nearMissColourRight({ flavour: 'Mixolydian' }),
    )
  })

  it('names no degree on the right-colour line', () => {
    const line = selectNearMiss([wrong('Mixolydian', 'C')], mixolydianDay, true)
    expect(line).toBeDefined()
    expect(line).not.toMatch(/[0-9♭♯]/)
  })

  it('treats a guess that missed both halves as a wrong colour, not a wrong root', () => {
    const bothWrong = selectNearMiss([wrong('Dorian', 'C')], mixolydianDay, true)
    const rightRoot = selectNearMiss([wrong('Dorian', 'G')], mixolydianDay, true)

    expect(bothWrong).toBeDefined()
    expect(bothWrong).toBe(rightRoot)
  })

  it('names the single degree that separates the guess from the answer', () => {
    expect(selectNearMiss([wrong('Dorian', 'G')], mixolydianDay, true)).toBe(
      coaching.nearMissApart({
        flavour: 'Dorian',
        notes: 1,
        guessed: '♭3',
        answered: '3',
      }),
    )
  })

  it('names both degrees, in degree order, where two of them differ', () => {
    expect(selectNearMiss([wrong('Lydian', 'G')], mixolydianDay, true)).toBe(
      coaching.nearMissApart({
        flavour: 'Lydian',
        notes: 2,
        guessed: '♯4 and 7',
        answered: '4 and ♭7',
      }),
    )
  })

  it('says plainly that a distant guess is far off, and names no degree', () => {
    const line = selectNearMiss([wrong('Phrygian', 'G')], mixolydianDay, true)

    expect(line).toBe(coaching.nearMissFar({ flavour: 'Phrygian' }))
    expect(line).not.toMatch(/[0-9]/)
  })

  it('gives a blues day the same plain wording, in both directions', () => {
    const bluesDay: Answer = { root: 'C', flavour: 'Blues' }
    expect(selectNearMiss([wrong('Dorian', 'C', bluesDay)], bluesDay, true)).toBe(
      coaching.nearMissFar({ flavour: 'Dorian' }),
    )

    const dorianDay: Answer = { root: 'C', flavour: 'Dorian' }
    expect(selectNearMiss([wrong('Blues', 'C', dorianDay)], dorianDay, true)).toBe(
      coaching.nearMissFar({ flavour: 'Blues' }),
    )
  })

  it('speaks about the last incorrect guess, not the first', () => {
    const spent = [wrong('Ionian', 'C'), wrong('Lydian', 'A'), wrong('Dorian', 'G')]
    const line = selectNearMiss(spent, mixolydianDay, true)

    expect(line).toContain('Dorian')
    expect(line).not.toContain('Ionian')
    expect(line).not.toContain('Lydian')
  })

  it('says nothing about a day that was solved, whatever was missed first (F17 E3)', () => {
    const spent = [wrong('Ionian', 'C'), wrong('Lydian', 'A'), wrong('Dorian', 'G')]

    expect(selectNearMiss([...spent, right()], mixolydianDay, false)).toBeUndefined()
    expect(selectNearMiss(spent, mixolydianDay, false)).toBeUndefined()
  })

  it('speaks about the same misses once the day was given up on (F17 E3)', () => {
    const spent = [wrong('Ionian', 'C'), wrong('Lydian', 'A'), wrong('Dorian', 'G')]

    expect(selectNearMiss(spent, mixolydianDay, true)).toBe(
      coaching.nearMissApart({
        flavour: 'Dorian',
        notes: 1,
        guessed: '♭3',
        answered: '3',
      }),
    )
  })

  it('says nothing about a stored guess the interval table cannot read', () => {
    const attempt = wrong('Klingon', 'G')

    expect(() => selectNearMiss([attempt], mixolydianDay, true)).not.toThrow()
    expect(selectNearMiss([attempt], mixolydianDay, true)).toBeUndefined()
  })

  it('says nothing where the two scales turn out to be the same one', () => {
    const dorianDay: Answer = { root: 'G', flavour: 'Dorian' }
    const attempt = wrong('dorian', 'G', dorianDay)

    expect(attempt.flavourMatched).toBe(false)
    expect(selectNearMiss([attempt], dorianDay, true)).toBeUndefined()
  })

  it('says nothing where the answer’s own flavour has no interval entry', () => {
    const unknownDay: Answer = { root: 'G', flavour: 'Klingon' }
    const attempt = wrong('Dorian', 'G', unknownDay)

    expect(() => selectNearMiss([attempt], unknownDay, true)).not.toThrow()
    expect(selectNearMiss([attempt], unknownDay, true)).toBeUndefined()
  })

  it('keeps every line it can produce inside the box, and never scolds', () => {
    const lines = everyProducibleLine()

    expect(lines).toHaveLength(MODES.length ** 2)
    expect(lines.some((line) => line.includes('one note apart'))).toBe(true)
    expect(lines.some((line) => line.includes('two notes apart'))).toBe(true)
    expect(lines.some((line) => line.includes('a long way from this one'))).toBe(true)
    expect(lines.some((line) => line.includes('the colour was right'))).toBe(true)

    for (const line of lines) {
      expect(line).toMatch(/^You said /)
      expect(line.length, `too long (${line.length}): ${line}`).toBeLessThanOrEqual(72)
      expect(line).not.toMatch(/[.!?]\s/)
      expect(line).not.toMatch(/wrong|should|failed|too far|bad\b/i)
      expect(line.endsWith('!')).toBe(false)
    }
  })

  it('reads the same in every key', () => {
    const inFSharp = selectNearMiss(
      [wrong('Dorian', 'C')],
      { root: 'F♯', flavour: 'Mixolydian' },
      true,
    )

    expect(inFSharp).toBe(selectNearMiss([wrong('Dorian', 'G')], mixolydianDay, true))
  })
})
