import { describe, expect, it } from 'vitest'
import { dateLine, metaLine } from './date'
import type { Groove } from '../../types'

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

/**
 * The groove card's meta line (F12 E3 R1a, R4, AC11).
 *
 * It is composed here rather than in the card, so the two pages that render the
 * same card differ in *data* — the finished string — rather than in logic. The
 * card branches on nothing, and this function is the one place that knows a
 * shared groove belongs to no day.
 */
describe('metaLine', () => {
  const GROOVE: Groove = {
    id: 'groove-01',
    uuid: '15a29033-2902-4b56-9166-4b8c8bf17cbc',
    audioSrc: '/grooves/groove-01.mp3',
    name: 'Sunroom Shuffle',
    bpm: 96,
    root: 'G',
    flavour: 'Dorian',
    bars: 4,
    scale: 'G dorian',
    chord: 'Gm9',
    progression: 'Gm9–C13',
    headDelaySeconds: 0.025057,
  }

  it('writes the tempo, then the day, for a groove that belongs to one', () => {
    expect(metaLine(GROOVE, new Date(2026, 7, 31))).toBe(
      '96 bpm · Monday, 31 August',
    )
  })

  it('spells the day exactly as dateLine spells it', () => {
    // The header writes the same day through `dateLine`. Asserting the shared
    // output rather than a second literal is what stops the two drifting.
    const day = new Date(2026, 7, 31)
    expect(metaLine(GROOVE, day)).toBe(`96 bpm · ${dateLine(day)}`)
  })

  it('writes "shared groove" in the day\'s place when there is no day', () => {
    expect(metaLine(GROOVE, null)).toBe('96 bpm · shared groove')
  })

  it('shows no date at all on a shared groove', () => {
    // The whole point of R1a: today's date here would be the exact confusion
    // this line exists to prevent.
    const line = metaLine(GROOVE, null)
    expect(line).not.toMatch(/\d{1,2} [A-Z][a-z]+/)
    expect(line).not.toMatch(
      /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/,
    )
  })

  /**
   * Where the answer sits, once the day is over.
   *
   * This is `metaLine`'s subject rather than `GrooveCard`'s, because the card is
   * handed one finished string and branches on nothing. It sits between the
   * tempo and the day — where feature-11 put it — and it must keep sitting
   * there: the daily page's copy is not allowed to move to make room for the
   * shared page's (F12 E3, "Out of scope: any change to /").
   */
  const ANSWER = { root: 'C' as const, flavour: 'Mixolydian' }

  it('puts the answer between the tempo and the day, once there is one', () => {
    expect(metaLine(GROOVE, new Date(2026, 7, 30), ANSWER)).toBe(
      '96 bpm · C Mixolydian · Sunday, 30 August',
    )
  })

  it('puts it in the same place on a shared groove', () => {
    expect(metaLine(GROOVE, null, ANSWER)).toBe(
      '96 bpm · C Mixolydian · shared groove',
    )
  })

  it('omits it entirely while the day is still on', () => {
    const day = new Date(2026, 7, 30)
    // `null` and no argument at all must read the same: the root and the mode
    // are the puzzle until the day ends.
    expect(metaLine(GROOVE, day, null)).toBe('96 bpm · Sunday, 30 August')
    expect(metaLine(GROOVE, day)).toBe('96 bpm · Sunday, 30 August')
    expect(metaLine(GROOVE, null)).toBe('96 bpm · shared groove')
  })

  it('carries whichever tempo the groove has', () => {
    expect(metaLine({ ...GROOVE, bpm: 84 }, null)).toBe('84 bpm · shared groove')
    expect(metaLine({ ...GROOVE, bpm: 140 }, new Date(2026, 8, 4))).toBe(
      '140 bpm · Friday, 4 September',
    )
  })
})
