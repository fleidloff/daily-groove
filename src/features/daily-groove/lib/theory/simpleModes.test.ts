import { describe, it, expect } from 'vitest'
import type { Answer } from '../../types'
import { GROOVES } from '../../data/grooves.generated'
import { familyOf } from './families'
import { flavourPool } from './music'
import { simpleLickMode } from './simpleModes'

const pool = flavourPool(GROOVES)
const day = new Date(2026, 8, 2)

const answerOf = (flavour: string): Answer => ({ root: 'C', flavour })

describe('simpleLickMode — the matching chip', () => {
  it('plays the day’s own mode when the day is Major', () => {
    expect(
      simpleLickMode({ family: 'Major', answer: answerOf('Lydian'), pool, date: day }),
    ).toBe('Lydian')
  })

  it('plays the day’s own mode when the day is Minor', () => {
    expect(
      simpleLickMode({ family: 'Minor', answer: answerOf('Dorian'), pool, date: day }),
    ).toBe('Dorian')
  })
})

describe('simpleLickMode — the other chip', () => {
  it('plays a real mode of its own family, not the day’s', () => {
    const picked = simpleLickMode({
      family: 'Minor',
      answer: answerOf('Lydian'),
      pool,
      date: day,
    })

    expect(picked).not.toBeNull()
    expect(pool).toContain(picked)
    expect(familyOf(picked as string)).toBe('Minor')
    expect(picked).not.toBe('Lydian')
  })

  it('returns the same mode for the same date', () => {
    const call = () =>
      simpleLickMode({ family: 'Minor', answer: answerOf('Lydian'), pool, date: day })

    expect(call()).toBe(call())
  })

  it('varies across dates', () => {
    const week = Array.from({ length: 7 }, (_, i) =>
      simpleLickMode({
        family: 'Minor',
        answer: answerOf('Lydian'),
        pool,
        date: new Date(2026, 8, 2 + i),
      }),
    )

    expect(new Set(week).size).toBeGreaterThan(1)
  })

  it.each(pool)('never returns the day’s own mode when the day is %s', (flavour) => {
    const family = familyOf(flavour) === 'Major' ? 'Minor' : 'Major'
    const picked = simpleLickMode({
      family,
      answer: answerOf(flavour),
      pool,
      date: day,
    })

    expect(picked).not.toBe(flavour)
    expect(familyOf(picked as string)).toBe(family)
  })
})

describe('simpleLickMode — nothing to pick', () => {
  it('returns null when the family has no members in the pool', () => {
    expect(
      simpleLickMode({
        family: 'Minor',
        answer: answerOf('Lydian'),
        pool: ['Ionian', 'Lydian'],
        date: day,
      }),
    ).toBeNull()
  })
})
