import { describe, expect, it } from 'vitest'
import { degreeDifferences } from './difference'
import { UnknownFlavourError } from './notes'
import { GROOVES } from '../../data/grooves.generated'

describe('degreeDifferences', () => {
  // AC1: the epic's headline case. Dorian [0,2,3,5,7,9,10] against Mixolydian
  // [0,2,4,5,7,9,10] differ at the third and nowhere else — ONE entry, even
  // though two labels are involved, because a flat label-set difference would
  // report ♭3 and 3 as two differing degrees and R7's threshold would then
  // miscount the case the epic exists for.
  it('reports one differing degree for Dorian against Mixolydian', () => {
    expect(degreeDifferences('Dorian', 'Mixolydian')).toEqual([
      { number: 3, guess: ['♭3'], answer: ['3'] },
    ])
  })

  // AC7a: two differing degrees are both reported, in ascending degree order.
  it('reports both differing degrees for Lydian against Mixolydian, ascending', () => {
    expect(degreeDifferences('Lydian', 'Mixolydian')).toEqual([
      { number: 4, guess: ['♯4'], answer: ['4'] },
      { number: 7, guess: ['7'], answer: ['♭7'] },
    ])
  })

  // R7's three-or-more branch. [0,1,3,5,7,8,10] against [0,2,4,6,7,9,11]
  // disagrees at degrees 2, 3, 4, 6 and 7 — five, not the four the PRD's prose
  // illustrates. The assertion follows the tables, not the prose; either count
  // is the same branch, so no requirement moves.
  it('reports five differing degrees for Phrygian against Lydian', () => {
    expect(degreeDifferences('Phrygian', 'Lydian')).toHaveLength(5)
    expect(degreeDifferences('Phrygian', 'Lydian').map((d) => d.number)).toEqual([
      2, 3, 4, 6, 7,
    ])
  })

  it('reports nothing for a scale against itself', () => {
    expect(degreeDifferences('Dorian', 'Dorian')).toEqual([])
  })

  // AC8, AC12: the blues scale's six degrees against Dorian's seven. Degree 5
  // carries BOTH of the blues spellings — ♭5 and 5 share a letter, so the scale
  // numbers them 1 ♭3 4 ♭5 5 ♭7 — and the degrees it simply has no note at,
  // 2 and 6, are disagreements with nothing on the guess's side.
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

  // R5a: a family has no intervals to compare, and the throw is what proves
  // `selectNearMiss`' guard actually holds rather than merely appearing to. A
  // function that returned [] for 'Major' would make that proof impossible.
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

/**
 * Every mode the catalogue can actually play, derived from the shipped
 * manifest the way `families.test.ts` derives it — never a hardcoded list,
 * which is the failure mode that stays green on exactly the day someone mints
 * a thirteenth mode and a real player's day starts throwing.
 */
const MODES = [...new Set(GROOVES.map((g) => g.flavour))]

/** Every ordered pair of distinct modes: 132 of them over the twelve modes. */
const PAIRS = MODES.flatMap((guess) =>
  MODES.filter((answer) => answer !== guess).map((answer) => [guess, answer] as const),
)

describe('degreeDifferences over the whole catalogue', () => {
  it('sweeps far more than a couple of pairs, so it cannot pass vacuously', () => {
    expect(MODES.length).toBeGreaterThan(0)
    expect(PAIRS.length).toBeGreaterThan(50)
  })

  // AC8: total over the catalogue. Every pair compares, none throws, and the
  // result is a well-formed ascending list of real degree numbers.
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
        // R7a: a difference with nothing on either side would be no
        // difference at all.
        expect(
          difference.guess.length + difference.answer.length,
          `${pair} at degree ${difference.number}`,
        ).toBeGreaterThan(0)
      }
    }
  })

  // R7b, AC12: the blues scale is three or more against EVERY seven-note mode,
  // in both directions — so the plain wording is the ordinary outcome on a
  // blues day rather than a fallback anyone has to apologise for.
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

  // AC8, and the assertion that makes Track B's degree-naming prose total: no
  // pair inside R7's two-degree threshold has a one-sided degree, so a sentence
  // reading "♭3, not nothing" is never produced. If this ever fails it is a
  // real length mismatch inside the threshold — record the pair and keep the
  // assertion; do not delete it.
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
