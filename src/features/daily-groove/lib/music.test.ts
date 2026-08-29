import { describe, it, expect } from 'vitest'
import { GROOVES } from './grooves.generated'
import { ROOTS, answerOf, flavourOptions, flavourPool } from './music'

describe('answerOf', () => {
  it("reads the answer from the groove's own root and flavour fields", () => {
    const groove = { ...GROOVES[0], root: 'A' as const, flavour: 'Dorian' }
    expect(answerOf(groove)).toEqual({ root: 'A', flavour: 'Dorian' })
  })

  it('keeps a two-word flavour intact, which a parse of `scale` would not', () => {
    // 'E\u266d harmonic minor' split on the first space gives flavour
    // 'harmonic minor' but a naive split gives root 'harmonic'. Reading the
    // fields cannot go wrong either way.
    const groove = {
      ...GROOVES[0],
      scale: 'E\u266d harmonic minor',
      root: 'E\u266d' as const,
      flavour: 'Harmonic minor',
    }
    expect(answerOf(groove)).toEqual({
      root: 'E\u266d',
      flavour: 'Harmonic minor',
    })
  })

  it('ignores the display string entirely', () => {
    const groove = { ...GROOVES[0], scale: 'nonsense', root: 'G' as const, flavour: 'Major' }
    expect(answerOf(groove)).toEqual({ root: 'G', flavour: 'Major' })
  })
})

describe('ROOTS', () => {
  it('offers all twelve chromatic notes', () => {
    expect(ROOTS).toHaveLength(12)
    expect(new Set(ROOTS).size).toBe(12)
  })
})

describe('every groove in the catalogue', () => {
  it.each(GROOVES.map((g) => [g.id, g] as const))(
    '%s answers to a known root and a non-empty flavour',
    (_id, groove) => {
      const answer = answerOf(groove)
      expect(ROOTS).toContain(answer.root)
      expect(answer.flavour.length).toBeGreaterThan(0)
    },
  )
})

describe('flavourPool', () => {
  it('is exactly the set of flavours the catalogue actually uses', () => {
    // Asserted as a property of the data rather than against a fixed list, so
    // the test keeps its meaning when the generated catalogue changes.
    const used = GROOVES.map((g) => g.flavour)
    expect(flavourPool(GROOVES)).toEqual([...new Set(used)].sort())
  })

  it('omits a flavour no groove uses', () => {
    expect(flavourPool(GROOVES)).not.toContain('Whole tone')
  })

  it('has no duplicates', () => {
    const pool = flavourPool(GROOVES)
    expect(new Set(pool).size).toBe(pool.length)
  })

  it('widens automatically when a groove uses a new flavour', () => {
    // A flavour no real groove carries, so this cannot pass vacuously.
    const extra = { ...GROOVES[0], id: 'extra', scale: 'C whole tone', flavour: 'Whole tone' }
    expect(flavourPool(GROOVES)).not.toContain('Whole tone')
    expect(flavourPool([...GROOVES, extra])).toContain('Whole tone')
  })
})

describe('flavourOptions', () => {
  const dates = Array.from(
    { length: 30 },
    (_, i) => new Date(2026, 0, 1 + i),
  )

  it.each(dates.map((d) => [d.toDateString(), d] as const))(
    'on %s returns four options including the answer',
    (_label, date) => {
      const groove = GROOVES[2]
      const options = flavourOptions(date, groove)
      expect(options).toHaveLength(4)
      expect(options).toContain(groove.flavour)
      expect(new Set(options).size).toBe(4)
    },
  )

  it('is stable for the same date', () => {
    const date = new Date(2026, 7, 29)
    const groove = GROOVES[3]
    expect(flavourOptions(date, groove)).toEqual(flavourOptions(date, groove))
  })

  it('draws only from the seeded flavour pool', () => {
    const pool = flavourPool(GROOVES)
    for (const date of dates) {
      for (const option of flavourOptions(date, GROOVES[6])) {
        expect(pool).toContain(option)
      }
    }
  })
})
