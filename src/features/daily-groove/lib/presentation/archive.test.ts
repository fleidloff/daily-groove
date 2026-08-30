import { describe, it, expect } from 'vitest'
import type { Answer, Attempt, DailyResult } from '../../types'
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

describe('toArchiveEntries — past days, most recent first (R8, R9, AC7)', () => {
  const results = [
    record('2026-08-18', { root: 'F', flavour: 'Lydian' }, { tries: 3, solved: true }),
    // An unfinished today: two attempts, unsolved. Epic 4 admits today only once
    // it is finished, so this record stays out of the row.
    record(TODAY, dorian, { tries: 2, solved: false }),
    record('2026-08-20', { root: 'E♭', flavour: 'Mixolydian' }, { tries: 1, solved: true }),
    record('2026-08-19', { root: 'A', flavour: 'Minor' }, { tries: 2, solved: false }),
  ]

  it('excludes an unfinished today', () => {
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
    expect(toArchiveEntries([record(TODAY, dorian, { tries: 2, solved: false })], TODAY)).toEqual([])
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

describe('toArchiveEntries — today joins the row once it is finished (E4)', () => {
  const past = [
    record('2026-08-20', { root: 'E♭', flavour: 'Mixolydian' }, { tries: 1, solved: true }),
    record('2026-08-19', { root: 'A', flavour: 'Minor' }, { tries: 2, solved: false }),
  ]

  // A1 — a solved today appears first, labelled "Today" (R1, R3, R4, AC1, AC5)
  it('puts a today solved on the first attempt first, labelled “Today”', () => {
    const entries = toArchiveEntries(
      [...past, record(TODAY, dorian, { tries: 1, solved: true })],
      TODAY,
    )
    expect(entries[0].date).toBe(TODAY)
    expect(entries[0].label).toBe('Today')
    expect(entries.map((e) => e.date)).toEqual([TODAY, '2026-08-20', '2026-08-19'])
    expect(entries.map((e) => e.label)).toEqual(['Today', 'Yesterday', 'Wed'])
  })

  it('labels today “Today” via dayLabel', () => {
    expect(dayLabel(TODAY, TODAY)).toBe('Today')
  })

  // A2 — three spent attempts admit an unsolved today (R1, AC2)
  it('admits an unsolved today once three attempts are spent', () => {
    const entries = toArchiveEntries(
      [...past, record(TODAY, dorian, { tries: 3, solved: false })],
      TODAY,
    )
    expect(entries.filter((e) => e.date === TODAY)).toHaveLength(1)
    expect(entries[0].date).toBe(TODAY)
  })

  it('admits an unsolved today with more than three attempts', () => {
    const entries = toArchiveEntries([record(TODAY, dorian, { tries: 5, solved: false })], TODAY)
    expect(entries.map((e) => e.date)).toEqual([TODAY])
  })

  // A3 — fewer than three attempts admit nothing (R2, AC3, AC4)
  it('omits an unsolved today with two attempts', () => {
    const entries = toArchiveEntries(
      [...past, record(TODAY, dorian, { tries: 2, solved: false })],
      TODAY,
    )
    expect(entries.map((e) => e.date)).not.toContain(TODAY)
    expect(entries).toHaveLength(2)
  })

  it('omits a today with no attempts at all', () => {
    const entries = toArchiveEntries(
      [...past, record(TODAY, dorian, { tries: 0, solved: false })],
      TODAY,
    )
    expect(entries.map((e) => e.date)).not.toContain(TODAY)
    expect(entries).toHaveLength(2)
  })

  it('omits an unsolved today with one attempt', () => {
    expect(toArchiveEntries([record(TODAY, dorian, { tries: 1, solved: false })], TODAY)).toEqual([])
  })

  // A4 — an unsolved today carries no answer (R6a, AC6a)
  it('withholds the answer of an unsolved today', () => {
    const answer: Answer = { root: 'F♯', flavour: 'Dorian' }
    const [entry] = toArchiveEntries([record(TODAY, answer, { tries: 3, solved: false })], TODAY)
    expect(entry.date).toBe(TODAY)
    expect(entry.answer).toBeNull()
  })

  it('shows the answer of a solved today', () => {
    const answer: Answer = { root: 'F♯', flavour: 'Dorian' }
    const [entry] = toArchiveEntries([record(TODAY, answer, { tries: 2, solved: true })], TODAY)
    expect(entry.answer).toEqual(answer)
  })

  // A5 — solving reveals the answer without moving the card (R6, R6a, AC6, AC6b)
  it('reveals the answer in place when a fourth attempt solves the day', () => {
    const answer: Answer = { root: 'F♯', flavour: 'Dorian' }
    const unsolved = record(TODAY, answer, { tries: 3, solved: false })
    const solved = record(TODAY, answer, { tries: 4, solved: true })

    const before = toArchiveEntries([...past, unsolved], TODAY)
    const after = toArchiveEntries([...past, solved], TODAY)

    expect(before[0].date).toBe(TODAY)
    expect(before[0].answer).toBeNull()

    expect(after[0].date).toBe(TODAY)
    expect(after[0].answer).toEqual(answer)
    expect(after[0].label).toBe('Today')
    expect(after.map((e) => e.date)).toEqual(before.map((e) => e.date))
  })

  // A6 — an unsolved today is marked "In play" (R6b, AC6c)
  it('marks an unsolved today “in-play”, and its mark reads “In play”', () => {
    const [entry] = toArchiveEntries([record(TODAY, dorian, { tries: 3, solved: false })], TODAY)
    expect(entry.outcome).toBe('in-play')
    expect(entry.tries).toBe(3)
    expect(outcomeMark(entry)).toBe('In play')
  })

  it('marks the day solved once the fourth attempt lands', () => {
    const [entry] = toArchiveEntries([record(TODAY, dorian, { tries: 4, solved: true })], TODAY)
    expect(entry.outcome).toBe('solved')
    expect(outcomeMark(entry)).toBe('4 tries')
  })

  it('marks a today solved on the first attempt as first-try', () => {
    const [entry] = toArchiveEntries([record(TODAY, dorian, { tries: 1, solved: true })], TODAY)
    expect(entry.outcome).toBe('first-try')
    expect(outcomeMark(entry)).toBe('solved')
  })
})

// A7 — past days are untouched (R6c, R10, AC6d, AC11)
describe('toArchiveEntries — past days keep their answers and their miss (R10, AC11)', () => {
  it('keeps a past unsolved day’s answer non-null, and marks it missed', () => {
    const answer: Answer = { root: 'F♯', flavour: 'Dorian' }
    const [entry] = toArchiveEntries(
      [record('2026-08-20', answer, { tries: 3, solved: false })],
      TODAY,
    )
    expect(entry.answer).not.toBeNull()
    expect(entry.answer).toEqual(answer)
    expect(entry.outcome).toBe('missed')
    expect(outcomeMark(entry)).toBe('missed')
  })

  it('keeps the answer of a past unsolved day with no attempts at all', () => {
    const answer: Answer = { root: 'G', flavour: 'Blues' }
    const [entry] = toArchiveEntries(
      [record('2026-08-14', answer, { tries: 0, solved: false })],
      TODAY,
    )
    expect(entry.answer).toEqual(answer)
    expect(entry.outcome).toBe('missed')
  })

  it('never marks a past day “in-play”, however many attempts it has', () => {
    const entries = toArchiveEntries(
      [
        record('2026-08-20', dorian, { tries: 0, solved: false }),
        record('2026-08-19', dorian, { tries: 3, solved: false }),
        record('2026-08-18', dorian, { tries: 9, solved: false }),
      ],
      TODAY,
    )
    expect(entries.map((e) => e.outcome)).toEqual(['missed', 'missed', 'missed'])
    expect(entries.every((e) => e.answer !== null)).toBe(true)
  })
})
