import { describe, expect, it } from 'vitest'
import { dateLine } from './date'

describe('dateLine', () => {
  it('writes the weekday, then the day and month, comma-separated', () => {
    expect(dateLine(new Date(2026, 7, 30))).toBe('Sunday, 30 August')
  })

  it('does not pad a single-digit day', () => {
    expect(dateLine(new Date(2026, 8, 4))).toBe('Friday, 4 September')
  })

  it('is pinned to en-GB wording, not the runtime locale', () => {
    // Day before month with no ordinal suffix is what distinguishes en-GB
    // from en-US here; a US format would read "August 30".
    expect(dateLine(new Date(2026, 7, 30))).toMatch(/^\w+, \d{1,2} \w+$/)
  })
})
