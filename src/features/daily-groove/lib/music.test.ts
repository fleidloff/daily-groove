import { describe, it, expect } from 'vitest'
import { GROOVES } from './seed'
import { ROOTS, flavourOptions, flavourPool, parseScale } from './music'

describe('parseScale', () => {
  it('splits a scale into its root and title-cased flavour', () => {
    expect(parseScale('A dorian')).toEqual({ root: 'A', flavour: 'Dorian' })
  })

  it('parses the design example', () => {
    expect(parseScale('G mixolydian')).toEqual({
      root: 'G',
      flavour: 'Mixolydian',
    })
  })

  it('keeps a multi-word flavour intact by splitting on the first space only', () => {
    expect(parseScale('E♭ harmonic minor')).toEqual({
      root: 'E♭',
      flavour: 'Harmonic minor',
    })
  })
})

describe('ROOTS', () => {
  it('offers all twelve chromatic notes', () => {
    expect(ROOTS).toHaveLength(12)
    expect(new Set(ROOTS).size).toBe(12)
  })
})

describe('every seeded groove', () => {
  it.each(GROOVES.map((g) => [g.id, g.scale] as const))(
    '%s (%s) parses to a known root and a non-empty flavour',
    (_id, scale) => {
      const answer = parseScale(scale)
      expect(ROOTS).toContain(answer.root)
      expect(answer.flavour.length).toBeGreaterThan(0)
    },
  )
})

describe('flavourPool', () => {
  it('is derived from the seed data', () => {
    const pool = flavourPool(GROOVES)
    expect(pool).toContain('Dorian')
    expect(pool).toContain('Locrian')
    expect(pool).not.toContain('Blues')
    expect(pool).not.toContain('Harmonic minor')
  })

  it('has no duplicates', () => {
    const pool = flavourPool(GROOVES)
    expect(new Set(pool).size).toBe(pool.length)
  })

  it('widens automatically when a groove uses a new flavour', () => {
    const extra = { ...GROOVES[0], id: 'extra', scale: 'C blues' }
    expect(flavourPool([...GROOVES, extra])).toContain('Blues')
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
      expect(options).toContain(parseScale(groove.scale).flavour)
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
