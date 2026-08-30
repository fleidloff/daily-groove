import { describe, it, expect } from 'vitest'
import type { Groove } from '../../types'
import { selectGrooveForDate, isoDate } from './selectGroove'

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
 * whole year is pinned as literals, captured from the implementation as it
 * stood before `hashString` moved into `src/lib/`. A player's groove of the day
 * is a promise about a date, not about a release — if this sweep changes, every
 * past date has been reassigned a different puzzle.
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
  'acbacbacbabcacabcbccbbaaccbacbcaabbccaabbaaccbbaacbcababcaaccbcbbacbcaaba',
  'bbcbcbacbcbaccbbcbcabcabcabacbacacacabbccaabbcccbabacbcbcabcabcabcbaacacc',
  'bcbabbbcbccacabaacaccbaccabcabcaabcccbbaacbacaabbccabcbacbacbacbababcabca',
  'abacbabacbbabccacaababbabacbacbcbcabcbcabbcbaaccbbaaccccbbaaccbbccaabbcca',
  'cbacbacbbabcaababbcabaccbcbbababcabcababccacbcbaccbabcabcabbccbbabaacbabc',
].join('')

const SWEEP_OVER_SIXTEEN = [
  '369cf258b963052fc1e25cf6903adb8096fc52b8ad47e18b251eb8da74918bad476974dab',
  '81efccf2503694752eb8da74968be147ad033096fc52b8a7ad8be1cfda741eb852690325c',
  'fe1fc4dab81efce18bad476952fc9630dac5cf6903adb81e74da300369cf258b962fc9630',
  'dacf2503694774dab81efce1be147ad031eb8da7496ad47e18b253d47e18b253096fc52b8',
  '8be147ad031ec52309674690325cfe1da741eb8524f2503694752fc9630dae18bad476974',
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
