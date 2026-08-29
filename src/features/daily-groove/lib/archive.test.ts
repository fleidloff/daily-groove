import { describe, it, expect } from 'vitest'
import type { Answer, Attempt, DailyResult } from '../types'
import { toArchiveEntries, dayLabel, outcomeMark } from './archive'

const TODAY = '2026-08-21' // a Friday

function attempt(answer: Answer, correct: boolean): Attempt {
  return {
    root: correct ? answer.root : 'B',
    flavour: correct ? answer.flavour : 'Blues',
    correct,
    rootMatched: correct,
    flavourMatched: correct,
  }
}

/** A record for `date` whose answer is `answer`, solved on attempt `solvedOn`. */
function record(
  date: string,
  answer: Answer,
  { tries, solved }: { tries: number; solved: boolean },
): DailyResult {
  const attempts: Attempt[] = []
  for (let i = 0; i < tries; i += 1) {
    attempts.push(attempt(answer, solved && i === tries - 1))
  }
  return { date, answer, attempts, solved }
}

const dorian: Answer = { root: 'D', flavour: 'Dorian' }

describe('toArchiveEntries — past days only, most recent first (R8, R9, AC7)', () => {
  const results = [
    record('2026-08-18', { root: 'F', flavour: 'Lydian' }, { tries: 3, solved: true }),
    record(TODAY, dorian, { tries: 1, solved: true }),
    record('2026-08-20', { root: 'E♭', flavour: 'Mixolydian' }, { tries: 1, solved: true }),
    record('2026-08-19', { root: 'A', flavour: 'Minor' }, { tries: 2, solved: false }),
  ]

  it('excludes today', () => {
    const entries = toArchiveEntries(results, TODAY)
    expect(entries.map((e) => e.date)).not.toContain(TODAY)
  })

  it('returns one entry per past day', () => {
    expect(toArchiveEntries(results, TODAY)).toHaveLength(3)
  })

  it('orders most-recent first', () => {
    expect(toArchiveEntries(results, TODAY).map((e) => e.date)).toEqual([
      '2026-08-20',
      '2026-08-19',
      '2026-08-18',
    ])
  })

  it('carries each day’s answer', () => {
    expect(toArchiveEntries(results, TODAY).map((e) => e.answer)).toEqual([
      { root: 'E♭', flavour: 'Mixolydian' },
      { root: 'A', flavour: 'Minor' },
      { root: 'F', flavour: 'Lydian' },
    ])
  })

  it('returns an empty list when there is no history', () => {
    expect(toArchiveEntries([], TODAY)).toEqual([])
    expect(toArchiveEntries([record(TODAY, dorian, { tries: 1, solved: true })], TODAY)).toEqual([])
  })

  it('excludes a future-dated record as well as today', () => {
    const withFuture = [
      record('2026-08-22', dorian, { tries: 1, solved: true }),
      record('2026-08-20', dorian, { tries: 1, solved: true }),
    ]
    expect(toArchiveEntries(withFuture, TODAY).map((e) => e.date)).toEqual(['2026-08-20'])
  })
})

describe('toArchiveEntries — outcomes (R10, R11, AC8)', () => {
  it('marks a past day solved in one attempt as first-try', () => {
    const [entry] = toArchiveEntries(
      [record('2026-08-20', dorian, { tries: 1, solved: true })],
      TODAY,
    )
    expect(entry.outcome).toBe('first-try')
    expect(entry.tries).toBe(1)
  })

  it('marks a past day solved in three attempts as solved, with tries of three', () => {
    const [entry] = toArchiveEntries(
      [record('2026-08-20', dorian, { tries: 3, solved: true })],
      TODAY,
    )
    expect(entry.outcome).toBe('solved')
    expect(entry.tries).toBe(3)
  })

  it('marks a past day with attempts but solved: false as missed', () => {
    const [entry] = toArchiveEntries(
      [record('2026-08-20', dorian, { tries: 6, solved: false })],
      TODAY,
    )
    expect(entry.outcome).toBe('missed')
    expect(entry.tries).toBe(6)
  })

  it('gives the three outcomes distinct marks, by text alone', () => {
    const entries = toArchiveEntries(
      [
        record('2026-08-20', dorian, { tries: 1, solved: true }),
        record('2026-08-19', dorian, { tries: 3, solved: true }),
        record('2026-08-18', dorian, { tries: 6, solved: false }),
      ],
      TODAY,
    )
    const marks = entries.map(outcomeMark)
    expect(new Set(marks).size).toBe(3)
    expect(marks).toEqual(['solved', '3 tries', 'missed'])
  })
})

describe('toArchiveEntries — a missed day still carries its answer (R11, AC9)', () => {
  it('reads the answer off the record, not off the last guess', () => {
    const answer: Answer = { root: 'C♯', flavour: 'Phrygian' }
    const missed = record('2026-08-20', answer, { tries: 6, solved: false })
    // Every attempt guessed something else.
    expect(missed.attempts.every((a) => a.root !== answer.root)).toBe(true)

    const [entry] = toArchiveEntries([missed], TODAY)
    expect(entry.outcome).toBe('missed')
    expect(entry.answer).toEqual(answer)
    expect(entry.answer).not.toEqual({
      root: missed.attempts[5].root,
      flavour: missed.attempts[5].flavour,
    })
  })

  it('carries the answer even for a missed day with no attempts recorded', () => {
    const answer: Answer = { root: 'G', flavour: 'Blues' }
    const [entry] = toArchiveEntries(
      [record('2026-08-20', answer, { tries: 0, solved: false })],
      TODAY,
    )
    expect(entry.answer).toEqual(answer)
    expect(entry.outcome).toBe('missed')
  })
})

describe('dayLabel — relative, then absolute (R9, A8)', () => {
  it('labels the previous day "Yesterday"', () => {
    expect(dayLabel('2026-08-20', TODAY)).toBe('Yesterday')
  })

  it('labels four days back with its weekday name', () => {
    expect(dayLabel('2026-08-17', TODAY)).toBe('Mon')
  })

  it('labels six days back — still within the last week — with its weekday name', () => {
    expect(dayLabel('2026-08-15', TODAY)).toBe('Sat')
  })

  it('labels twenty days back with a date', () => {
    expect(dayLabel('2026-08-01', TODAY)).toBe('Aug 1')
  })

  it('labels a week back with a date, not the same weekday name as today', () => {
    expect(dayLabel('2026-08-14', TODAY)).toBe('Aug 14')
  })

  it('crosses a month boundary without drifting', () => {
    expect(dayLabel('2026-07-31', '2026-08-01')).toBe('Yesterday')
    expect(dayLabel('2026-07-28', '2026-08-01')).toBe('Tue')
  })

  it('is used for each entry’s label', () => {
    const entries = toArchiveEntries(
      [
        record('2026-08-20', dorian, { tries: 1, solved: true }),
        record('2026-08-17', dorian, { tries: 1, solved: true }),
        record('2026-08-01', dorian, { tries: 1, solved: true }),
      ],
      TODAY,
    )
    expect(entries.map((e) => e.label)).toEqual(['Yesterday', 'Mon', 'Aug 1'])
  })
})
