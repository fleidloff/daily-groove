import type { Answer, DailyResult } from '../types'

/**
 * How a past day ended. Derived at read time rather than stored: a record dated
 * before today whose `solved` is false is a miss, so nothing has to run at
 * midnight to close a day out.
 */
export type Outcome = 'first-try' | 'solved' | 'missed'

/** One past day, shaped for the archive strip. */
export type ArchiveEntry = {
  date: string
  /** "Yesterday", a weekday name within the last week, or a date beyond that. */
  label: string
  /** The day's correct pair — read off the record, never off the last guess. */
  answer: Answer
  outcome: Outcome
  /** How many attempts were spent on the day. */
  tries: number
}

/** Local Date at noon, so a DST step can never land on the wrong calendar day. */
function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Whole calendar days from `date` back to `today`, by noon-anchored dates. */
function daysBefore(date: string, today: string): number {
  const diff = parseIsoDate(today).getTime() - parseIsoDate(date).getTime()
  return Math.round(diff / MS_PER_DAY)
}

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

/**
 * A day's label: relative while it stays unambiguous, absolute after. The cut-off
 * is six days back — seven would repeat today's own weekday name and read as this
 * week rather than last.
 */
export function dayLabel(date: string, today: string): string {
  const distance = daysBefore(date, today)
  if (distance === 1) return 'Yesterday'
  const day = parseIsoDate(date)
  if (distance >= 2 && distance <= 6) return weekdayFormat.format(day)
  return dateFormat.format(day)
}

function outcomeOf(result: DailyResult): Outcome {
  if (!result.solved) return 'missed'
  return result.attempts.length <= 1 ? 'first-try' : 'solved'
}

/**
 * The short mark shown on an archive card. Text, not colour, carries the
 * distinction between the three outcomes.
 */
export function outcomeMark(entry: ArchiveEntry): string {
  switch (entry.outcome) {
    case 'first-try':
      return 'solved'
    case 'solved':
      return `${entry.tries} tries`
    case 'missed':
      return 'missed'
  }
}

/**
 * Shape stored records into archive entries: past days only — today is the
 * puzzle above, not history — most recent first.
 */
export function toArchiveEntries(results: DailyResult[], today: string): ArchiveEntry[] {
  return results
    .filter((r) => r.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((r) => ({
      date: r.date,
      label: dayLabel(r.date, today),
      answer: r.answer,
      outcome: outcomeOf(r),
      tries: r.attempts.length,
    }))
}
