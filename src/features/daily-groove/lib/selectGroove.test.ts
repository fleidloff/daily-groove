import { describe, it, expect } from 'vitest'
import type { Groove } from '../types'
import { selectGrooveForDate, isoDate } from './selectGroove'

const grooves: Groove[] = [
  { id: 'a', audioSrc: '/grooves/a.mp3', name: 'Test Groove', bpm: 90, scale: 'C minor', chord: 'Cm', progression: 'Cm–F–G' },
  { id: 'b', audioSrc: '/grooves/b.mp3', name: 'Test Groove', bpm: 90, scale: 'A dorian', chord: 'Am7', progression: 'Am–D–G' },
  { id: 'c', audioSrc: '/grooves/c.mp3', name: 'Test Groove', bpm: 90, scale: 'E phrygian', chord: 'Em', progression: 'Em–Am–B7' },
]

describe('isoDate', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(isoDate(new Date('2026-08-21T23:00'))).toBe('2026-08-21')
  })

  it('pads single-digit months and days', () => {
    expect(isoDate(new Date('2026-01-05T10:00'))).toBe('2026-01-05')
  })
})

describe('selectGrooveForDate', () => {
  it('returns the same groove across repeated calls for a fixed date', () => {
    const date = new Date('2026-08-21')
    const first = selectGrooveForDate(date, grooves)
    const second = selectGrooveForDate(date, grooves)
    const third = selectGrooveForDate(new Date('2026-08-21'), grooves)
    expect(first).toBe(second)
    expect(first).toBe(third)
  })

  it('resolves a far-future date to a valid member of the set (never exhausts)', () => {
    const result = selectGrooveForDate(new Date('2099-01-01'), grooves)
    expect(grooves).toContain(result)
  })

  it('returns a member of the set for any date', () => {
    for (const d of ['2026-01-01', '2026-06-15', '2030-12-31', '2050-07-04']) {
      expect(grooves).toContain(selectGrooveForDate(new Date(d), grooves))
    }
  })
})
