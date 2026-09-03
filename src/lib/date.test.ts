import { describe, expect, it } from 'vitest'
import { isoDate, parseIsoDate } from './date'

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
