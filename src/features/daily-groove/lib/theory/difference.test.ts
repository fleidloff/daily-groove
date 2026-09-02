import { describe, expect, it } from 'vitest'
import { degreeDifferences } from './difference'
import { UnknownFlavourError } from './notes'
import { GROOVES } from '../../data/grooves.generated'

describe('degreeDifferences', () => {
  it('reports one differing degree for Dorian against Mixolydian', () => {
    expect(degreeDifferences('Dorian', 'Mixolydian')).toEqual([
      { number: 3, guess: ['♭3'], answer: ['3'] },
    ])
  })

  it('reports both differing degrees for Lydian against Mixolydian, ascending', () => {
    expect(degreeDifferences('Lydian', 'Mixolydian')).toEqual([
      { number: 4, guess: ['♯4'], answer: ['4'] },
      { number: 7, guess: ['7'], answer: ['♭7'] },
    ])
  })

  it('reports five differing degrees for Phrygian against Lydian', () => {
    expect(degreeDifferences('Phrygian', 'Lydian')).toHaveLength(5)
    expect(degreeDifferences('Phrygian', 'Lydian').map((d) => d.number)).toEqual([
      2, 3, 4, 6, 7,
    ])
  })

  it('reports nothing for a scale against itself', () => {
    expect(degreeDifferences('Dorian', 'Dorian')).toEqual([])
  })

  it('gives the blues fifth both its spellings and reports its missing degrees', () => {
    expect(degreeDifferences('Blues', 'Dorian')).toEqual([
      { number: 2, guess: [], answer: ['2'] },
      { number: 5, guess: ['♭5', '5'], answer: ['5'] },
      { number: 6, guess: [], answer: ['6'] },
    ])
  })

  it('reads the same pair the other way round with the sides swapped', () => {
    expect(degreeDifferences('Dorian', 'Blues')).toEqual([
      { number: 2, guess: ['2'], answer: [] },
      { number: 5, guess: ['5'], answer: ['♭5', '5'] },
      { number: 6, guess: ['6'], answer: [] },
    ])
  })

  it.each(['Major', 'Minor'])('throws for the family %j as the guess', (family) => {
    expect(() => degreeDifferences(family, 'Dorian')).toThrow(UnknownFlavourError)
  })

  it.each(['Major', 'Minor'])('throws for the family %j as the answer', (family) => {
    expect(() => degreeDifferences('Dorian', family)).toThrow(UnknownFlavourError)
  })

  it('throws for a flavour the interval table does not hold at all', () => {
    expect(() => degreeDifferences('Dorian', 'Klingon')).toThrow(UnknownFlavourError)
    expect(() => degreeDifferences('Klingon', 'Dorian')).toThrow(UnknownFlavourError)
  })

  it('names the offending flavour in the error it throws', () => {
    expect(() => degreeDifferences('Major', 'Dorian')).toThrow(/Major/)
    expect(() => degreeDifferences('Dorian', 'Minor')).toThrow(/Minor/)
  })
})

const MODES = [...new Set(GROOVES.map((g) => g.flavour))]

const PAIRS = MODES.flatMap((guess) =>
  MODES.filter((answer) => answer !== guess).map((answer) => [guess, answer] as const),
)

describe('degreeDifferences over the whole catalogue', () => {
  it('sweeps far more than a couple of pairs, so it cannot pass vacuously', () => {
    expect(MODES.length).toBeGreaterThan(0)
    expect(PAIRS.length).toBeGreaterThan(50)
  })

  it('compares every ordered pair of catalogue modes without throwing', () => {
    for (const [guess, answer] of PAIRS) {
      const pair = `${guess} vs ${answer}`
      expect(() => degreeDifferences(guess, answer), pair).not.toThrow()

      const differences = degreeDifferences(guess, answer)
      expect(differences.length, pair).toBeGreaterThan(0)

      const numbers = differences.map((d) => d.number)
      expect(numbers, pair).toEqual([...numbers].sort((a, b) => a - b))
      expect(new Set(numbers).size, pair).toBe(numbers.length)

      for (const difference of differences) {
        expect(Number.isInteger(difference.number), pair).toBe(true)
        expect(difference.number, pair).toBeGreaterThanOrEqual(1)
        expect(difference.number, pair).toBeLessThanOrEqual(7)
        expect(
          difference.guess.length + difference.answer.length,
          `${pair} at degree ${difference.number}`,
        ).toBeGreaterThan(0)
      }
    }
  })

  it('puts the blues scale three or more degrees from every seven-note mode', () => {
    const modes = MODES.filter((m) => m !== 'Blues')
    expect(modes.length).toBeGreaterThan(0)
    for (const mode of modes) {
      expect(degreeDifferences('Blues', mode).length, `Blues vs ${mode}`)
        .toBeGreaterThanOrEqual(3)
      expect(degreeDifferences(mode, 'Blues').length, `${mode} vs Blues`)
        .toBeGreaterThanOrEqual(3)
    }
  })

  it('spells both sides of every degree, wherever only one or two differ', () => {
    const inside = PAIRS.map(
      ([guess, answer]) => [guess, answer, degreeDifferences(guess, answer)] as const,
    ).filter(([, , differences]) => differences.length <= 2)

    expect(inside.length).toBeGreaterThan(0)
    for (const [guess, answer, differences] of inside) {
      for (const difference of differences) {
        const where = `${guess} vs ${answer} at degree ${difference.number}`
        expect(difference.guess, where).toHaveLength(1)
        expect(difference.answer, where).toHaveLength(1)
      }
    }
  })
})
