import { describe, expect, it } from 'vitest'
import { isoDate, nextDayStart, parseIsoDate } from './date'

describe('isoDate', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(isoDate(new Date('2026-08-21T23:00'))).toBe('2026-08-21')
  })

  it('pads single-digit months and days', () => {
    expect(isoDate(new Date('2026-01-05T10:00'))).toBe('2026-01-05')
  })
})

describe('parseIsoDate', () => {
  it('parses a YYYY-MM-DD string as a local calendar day at noon', () => {
    const date = parseIsoDate('2026-08-30')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(30)
    expect(date.getHours()).toBe(12)
  })
})

describe('nextDayStart', () => {
  it('returns the local midnight that ends the given day', () => {
    const next = nextDayStart(new Date('2026-08-21T23:00'))
    expect(isoDate(next)).toBe('2026-08-22')
    expect(next.getHours()).toBe(0)
    expect(next.getMinutes()).toBe(0)
    expect(next.getSeconds()).toBe(0)
    expect(next.getMilliseconds()).toBe(0)
  })

  it('is a full day away from a midnight', () => {
    const midnight = new Date('2026-08-21T00:00')
    expect(nextDayStart(midnight).getTime() - midnight.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('rolls over the month and the year', () => {
    expect(isoDate(nextDayStart(new Date('2026-12-31T08:00')))).toBe('2027-01-01')
  })
})
