import { describe, expect, it } from 'vitest'
import { puzzle } from '@/lib/snippets'
import { writtenRoot } from '@/lib/theory/transpose'
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
    expect(dateLine(new Date(2026, 7, 30))).toMatch(/^\w+, \d{1,2} \w+$/)
  })
})

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
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${dateLine(new Date(2026, 7, 31))}`,
    )
  })

  it('spells the day exactly as dateLine spells it', () => {
    const day = new Date(2026, 7, 31)
    expect(metaLine(GROOVE, day)).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${dateLine(day)}`,
    )
  })

  it('writes "shared groove" in the day\'s place when there is no day', () => {
    expect(metaLine(GROOVE, null)).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${puzzle.sharedGroove}`,
    )
  })

  it('shows no date at all on a shared groove', () => {
    const line = metaLine(GROOVE, null)
    expect(line).not.toMatch(/\d{1,2} [A-Z][a-z]+/)
    expect(line).not.toMatch(
      /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/,
    )
  })

  const ANSWER = { root: 'C' as const, flavour: 'Mixolydian' }

  it('puts the answer between the tempo and the day, once there is one', () => {
    expect(metaLine(GROOVE, new Date(2026, 7, 30), ANSWER)).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${ANSWER.root} ${ANSWER.flavour} · ${dateLine(new Date(2026, 7, 30))}`,
    )
  })

  it('puts it in the same place on a shared groove', () => {
    expect(metaLine(GROOVE, null, ANSWER)).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${ANSWER.root} ${ANSWER.flavour} · ${puzzle.sharedGroove}`,
    )
  })

  it('omits it entirely while the day is still on', () => {
    const day = new Date(2026, 7, 30)
    expect(metaLine(GROOVE, day, null)).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${dateLine(day)}`,
    )
    expect(metaLine(GROOVE, day)).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${dateLine(day)}`,
    )
    expect(metaLine(GROOVE, null)).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${puzzle.sharedGroove}`,
    )
  })

  it('names the answer in the written pitch when asked (F23 E1 R7, AC9)', () => {
    const day = new Date(2026, 7, 30)
    expect(metaLine(GROOVE, day, ANSWER, 'E♭')).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${writtenRoot(ANSWER.root, 'E♭')} ${ANSWER.flavour} · ${dateLine(day)}`,
    )
    expect(metaLine(GROOVE, null, ANSWER, 'B♭')).toBe(
      `${puzzle.bpm({ bpm: GROOVE.bpm })} · ${writtenRoot(ANSWER.root, 'B♭')} ${ANSWER.flavour} · ${puzzle.sharedGroove}`,
    )
  })

  it('reads as today on concert, with or without the argument (F23 E1 R4, AC5)', () => {
    const day = new Date(2026, 7, 30)
    expect(metaLine(GROOVE, day, ANSWER, 'C')).toBe(metaLine(GROOVE, day, ANSWER))
    expect(metaLine(GROOVE, day, null, 'E♭')).toBe(metaLine(GROOVE, day))
  })

  it('carries whichever tempo the groove has', () => {
    expect(metaLine({ ...GROOVE, bpm: 84 }, null)).toBe(
      `${puzzle.bpm({ bpm: 84 })} · ${puzzle.sharedGroove}`,
    )
    expect(metaLine({ ...GROOVE, bpm: 140 }, new Date(2026, 8, 4))).toBe(
      `${puzzle.bpm({ bpm: 140 })} · ${dateLine(new Date(2026, 8, 4))}`,
    )
  })
})
