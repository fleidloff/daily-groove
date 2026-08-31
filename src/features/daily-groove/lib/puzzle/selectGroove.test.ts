import { describe, it, expect } from 'vitest'
import type { Groove } from '../../types'
import { selectGrooveForDate, isoDate, dayIndexOf, parseIsoDate } from './selectGroove'

const grooves: Groove[] = [
  { id: 'a', audioSrc: '/grooves/a.mp3', name: 'Test Groove', bpm: 90, root: 'C', flavour: 'Minor', bars: 4, scale: 'C minor', chord: 'Cm', progression: 'Cm–F–G', headDelaySeconds: 0.025057 },
  { id: 'b', audioSrc: '/grooves/b.mp3', name: 'Test Groove', bpm: 90, root: 'A', flavour: 'Dorian', bars: 4, scale: 'A dorian', chord: 'Am7', progression: 'Am–D–G', headDelaySeconds: 0.025057 },
  { id: 'c', audioSrc: '/grooves/c.mp3', name: 'Test Groove', bpm: 90, root: 'E', flavour: 'Phrygian', bars: 4, scale: 'E phrygian', chord: 'Em', progression: 'Em–Am–B7', headDelaySeconds: 0.025057 },
]

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
    // Noon, not midnight: a DST step of ±1h can never move the calendar day.
    expect(date.getHours()).toBe(12)
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

/**
 * The determinism net. Every date of 2026 is mapped to a groove id and the
 * whole year is pinned as literals. A player's groove of the day is a promise
 * about a date, not about a release — if this sweep changes, every past date
 * has been reassigned a different puzzle.
 *
 * The literals were re-captured once, in feature-7 Epic 1, when the pick stopped
 * hashing a date into the set and started walking a shuffled lap of it. That
 * re-assignment is the epic's declared cost (PRD, "What a growing catalogue
 * does"): nothing reads the pick for a past date, and a played day carries its
 * own `grooveId` in `DailyResult`. It is not a licence to re-capture again —
 * the next time this sweep fails, the pick has drifted.
 *
 * Two set sizes are swept because a groove id is picked modulo the set size:
 * agreement modulo 16 does not imply agreement modulo 3, so both are pinned.
 */
const sweepGroove = (id: string): Groove => ({
  id,
  audioSrc: `/grooves/${id}.mp3`,
  name: 'n',
  bpm: 90,
  root: 'C',
  flavour: 'Minor',
  bars: 4,
  scale: 's',
  chord: 'c',
  progression: 'p',
  headDelaySeconds: 0.025057,
})

const SWEEP_START = new Date(2026, 0, 1)
const SWEEP_DAYS = 365

const sweep = (set: Groove[]): string => {
  let out = ''
  for (let i = 0; i < SWEEP_DAYS; i++) {
    const day = new Date(SWEEP_START.getFullYear(), SWEEP_START.getMonth(), SWEEP_START.getDate() + i)
    out += selectGrooveForDate(day, set).id
  }
  return out
}

const SWEEP_OVER_THREE = [
  'acbacbcabcbacababcacbabcabcabcbcacabcbacababcacbacbcbacbabcabcabacacbabca',
  'cbabcbacbacbacacbcabcabcbacababcabcacbcbacabacbcababcbacbcacabcbabcabacbc',
  'abacabcabcbacacbacbcabcbacabacbcbacabcbabacacbcabcabacbcbacabcabacbabcacb',
  'abcabcacbabcbcabacbcabcabacbacbcabacacbcabcbacabcbacbabacbacacbcbacbabacb',
  'cabcabcacbabacacbabcacbcbacbabcabacbcacbabacacbcbacabcababcabcbcacababcba',
].join('')

const SWEEP_OVER_SIXTEEN = [
  '560cef7a42b5e81a9d624f07c3a749125ed6cf38b04af3c67b05d982e1ab816f73095edc2',
  '4d57304196ef8b2ac97d815bfa06c423e84bda1f7c562093eabd4e728695f30c1f3b258d9',
  '170c6ae494260eb5cd817af314a39ed856b07f2cac831eb295d67f04ced68107a3295fb43',
  '71658a9fd4ce0b2951decb346027a8f52bc84af79e061d34b25c39aef6701d8a894bfd26e',
  '05317c0c13a975bdf284e67394bec1df85a0262fc1a46db9e58370a4e9185c73f2bd60f60',
].join('')

describe('selectGrooveForDate determinism', () => {
  it('assigns the same groove to every date of a year-long sweep (3 grooves)', () => {
    expect(sweep(['a', 'b', 'c'].map(sweepGroove))).toBe(SWEEP_OVER_THREE)
  })

  it('assigns the same groove to every date of a year-long sweep (16 grooves)', () => {
    expect(sweep('0123456789abcdef'.split('').map(sweepGroove))).toBe(SWEEP_OVER_SIXTEEN)
  })

  it('sweeps a full year of local calendar days', () => {
    expect(SWEEP_OVER_THREE).toHaveLength(SWEEP_DAYS)
    expect(SWEEP_OVER_SIXTEEN).toHaveLength(SWEEP_DAYS)
    expect(isoDate(SWEEP_START)).toBe('2026-01-01')
  })
})


/**
 * Rotation tests (feature-7 Epic 1). The catalogues here are hand-built
 * literals rather than the real `GROOVES`: the pick must be provably
 * size-agnostic, and the real catalogue changes size under this file.
 */
const makeGrooves = (count: number): Groove[] =>
  Array.from({ length: count }, (_, i) => sweepGroove(`g${String(i).padStart(2, '0')}`))

/** A local Date at noon, `offset` calendar days after 1970-01-01. */
const dayAt = (offset: number): Date => new Date(1970, 0, 1 + offset, 12, 0, 0, 0)

/** The day index the pick will actually see for `dayAt(offset)`. */
const indexAt = (offset: number): number => dayIndexOf(isoDate(dayAt(offset)))

/**
 * The first offset at or after `from` that opens a lap of `n`. Laps are fixed
 * blocks measured from the epoch (R5), so a window that proves R1 has to start
 * on a boundary; starting mid-lap spans two laps and proves nothing.
 */
const lapStart = (n: number, from = 0): number => {
  let offset = from
  while (indexAt(offset) % n !== 0) offset += 1
  return offset
}

/**
 * How many days the seam tests sweep. Two hundred is not enough: with sixteen
 * grooves the first collision between a lap's opener and the last lap's closer
 * does not fall inside it, so a 200-day sweep passes with the guard deleted.
 */
const SEAM_SPAN = 5_000

const idsOver = (grooves: Groove[], startOffset: number, days: number): string[] =>
  Array.from({ length: days }, (_, i) => selectGrooveForDate(dayAt(startOffset + i), grooves).id)

describe('dayIndexOf', () => {
  it('counts days from the 1970-01-01 epoch', () => {
    expect(dayIndexOf('1970-01-01')).toBe(0)
    expect(dayIndexOf('1970-01-02')).toBe(1)
  })

  it('advances by exactly one across a DST transition', () => {
    expect(dayIndexOf('2026-03-29')).toBe(dayIndexOf('2026-03-28') + 1)
    expect(dayIndexOf('2026-03-30')).toBe(dayIndexOf('2026-03-29') + 1)
    expect(dayIndexOf('2026-10-25')).toBe(dayIndexOf('2026-10-24') + 1)
  })

  it('is the same for any clock time on the same calendar day', () => {
    expect(dayIndexOf(isoDate(new Date(2026, 7, 30, 0, 0, 1)))).toBe(
      dayIndexOf(isoDate(new Date(2026, 7, 30, 23, 59, 59))),
    )
  })
})

describe('selectGrooveForDate rotation', () => {
  it('plays every groove exactly once across a lap of N days (AC1)', () => {
    const grooves = makeGrooves(16)
    const start = lapStart(16, 20_000)
    const ids = idsOver(grooves, start, 16)
    expect(new Set(ids).size).toBe(16)
    expect([...ids].sort()).toEqual(grooves.map((g) => g.id).sort())
  })

  it('returns the same groove for the same date however often it is asked (AC2)', () => {
    const grooves = makeGrooves(16)
    const start = lapStart(16, 20_000)
    const first = selectGrooveForDate(dayAt(start + 5), grooves)
    expect(selectGrooveForDate(dayAt(start + 5), grooves)).toBe(first)
    expect(selectGrooveForDate(new Date(dayAt(start + 5).getTime()), grooves)).toBe(first)
  })

  it('returns the same groove at two different times of the same day (AC3)', () => {
    const grooves = makeGrooves(16)
    const morning = new Date(2026, 7, 30, 0, 30, 0)
    const night = new Date(2026, 7, 30, 23, 30, 0)
    expect(selectGrooveForDate(morning, grooves)).toBe(selectGrooveForDate(night, grooves))
  })

  it('plays every groove exactly twice across two laps (AC5)', () => {
    const grooves = makeGrooves(16)
    const start = lapStart(16, 20_000)
    const counts = new Map<string, number>()
    for (const id of idsOver(grooves, start, 32)) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBe(16)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
  })

  it('never opens a lap on the groove that closed the one before (AC4)', () => {
    const grooves = makeGrooves(16)
    const boundaries: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      if (indexAt(offset) % 16 !== 0) continue
      const closing = selectGrooveForDate(dayAt(offset - 1), grooves).id
      const opening = selectGrooveForDate(dayAt(offset), grooves).id
      if (closing === opening) boundaries.push(`day ${indexAt(offset)}: ${opening} twice`)
    }
    expect(boundaries).toEqual([])
  })

  it('never repeats on two consecutive days at all (AC4)', () => {
    const grooves = makeGrooves(16)
    const repeats: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      const today = selectGrooveForDate(dayAt(offset), grooves).id
      if (today === selectGrooveForDate(dayAt(offset - 1), grooves).id) {
        repeats.push(`day ${indexAt(offset)}: ${today} twice`)
      }
    }
    expect(repeats).toEqual([])
  })
})

describe('selectGrooveForDate with a degenerate rotation (AC7)', () => {
  it('throws on an empty rotation', () => {
    expect(() => selectGrooveForDate(new Date(2026, 7, 30), [])).toThrow(
      'selectGrooveForDate: grooves must not be empty',
    )
  })

  it('returns the only groove every day, without looping forever', () => {
    const one = makeGrooves(1)
    for (let offset = 0; offset < 10; offset += 1) {
      expect(selectGrooveForDate(dayAt(20_000 + offset), one)).toBe(one[0])
    }
  })

  it('strictly alternates a rotation of two, with no repeat at any seam', () => {
    const two = makeGrooves(2)
    const ids = idsOver(two, 20_000, 40)
    expect(new Set(ids).size).toBe(2)
    for (let i = 1; i < ids.length; i += 1) expect(ids[i]).not.toBe(ids[i - 1])
  })
})

describe('selectGrooveForDate with a grown rotation (AC6)', () => {
  it('keeps the once-per-lap guarantee at the new size', () => {
    const grooves = makeGrooves(18)
    const start = lapStart(18, 20_000)
    const ids = idsOver(grooves, start, 18)
    expect(new Set(ids).size).toBe(18)
  })

  it('keeps the lap seam guarded at the new size', () => {
    const grooves = makeGrooves(18)
    const boundaries: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      if (indexAt(offset) % 18 !== 0) continue
      const closing = selectGrooveForDate(dayAt(offset - 1), grooves).id
      const opening = selectGrooveForDate(dayAt(offset), grooves).id
      if (closing === opening) boundaries.push(`day ${indexAt(offset)}: ${opening} twice`)
    }
    expect(boundaries).toEqual([])
  })

  it('reassigns dates when the rotation changes size — the accepted cost (R6a)', () => {
    const sixteen = makeGrooves(16)
    const eighteen = makeGrooves(18)
    const start = lapStart(16, 20_000)
    const differs = Array.from({ length: 40 }, (_, i) => dayAt(start + i)).some(
      (date) => selectGrooveForDate(date, sixteen).id !== selectGrooveForDate(date, eighteen).id,
    )
    expect(differs).toBe(true)
  })
})
