import type { Answer, DailyResult } from '../../types'

/**
 * How a day ended, or has yet to end. Derived at read time rather than stored: a
 * record dated before today whose `solved` is false is a miss, so nothing has to
 * run at midnight to close a day out. `in-play` belongs to today alone — the day
 * is in the row but still winnable, so it is not a miss.
 */
export type Outcome = 'first-try' | 'solved' | 'missed' | 'in-play'

/** One played day, shaped for the archive strip. */
export type ArchiveEntry = {
  date: string
  /** 'Today', 'Yesterday', a weekday within the last week, or a date beyond. */
  label: string
  /**
   * The day's correct pair — read off the record, never off the last guess.
   * Absent while today is shown and unsolved: the puzzle above is still
   * winnable, so the row must not give away what the page is still asking.
   */
  answer: Answer | null
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
  if (distance === 0) return 'Today'
  if (distance === 1) return 'Yesterday'
  const day = parseIsoDate(date)
  if (distance >= 2 && distance <= 6) return weekdayFormat.format(day)
  return dateFormat.format(day)
}

/**
 * Today's unsolved day is `in-play`, never `missed`: the attempts are spent but
 * the puzzle above is still open, and 'missed' would state something untrue of a
 * day that can still be won. A past unsolved day is a miss, because it cannot.
 */
function outcomeOf(result: DailyResult, today: string): Outcome {
  if (!result.solved) return result.date === today ? 'in-play' : 'missed'
  return result.attempts.length <= 1 ? 'first-try' : 'solved'
}

/**
 * The short mark shown on an archive card. Text, not colour, carries the
 * distinction between the outcomes.
 */
export function outcomeMark(entry: ArchiveEntry): string {
  switch (entry.outcome) {
    case 'first-try':
      return 'solved'
    case 'solved':
      return `${entry.tries} tries`
    case 'missed':
      return 'missed'
    case 'in-play':
      return 'In play'
  }
}

/**
 * A day is finished — and so showable in the row — once it is solved, or once
 * three attempts have been spent on it. `>= 3` rather than `=== 3` so a record
 * that somehow carries four unsolved attempts is still admitted.
 *
 * Being finished never ends the day: today's puzzle stays playable, and a later
 * attempt that solves it simply re-derives the same card.
 */
function isFinished(result: DailyResult): boolean {
  return result.solved || result.attempts.length >= 3
}

/**
 * Shape stored records into archive entries, most recent first. Past days, plus
 * today once it is finished — today's card sorts first with no special case,
 * since ISO dates compare lexicographically. An unfinished today is omitted; an
 * unsolved one is admitted without its answer.
 */
export function toArchiveEntries(results: DailyResult[], today: string): ArchiveEntry[] {
  return results
    .filter((r) => r.date < today || (r.date === today && isFinished(r)))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((r) => ({
      date: r.date,
      label: dayLabel(r.date, today),
      answer: r.date === today && !r.solved ? null : r.answer,
      outcome: outcomeOf(r, today),
      tries: r.attempts.length,
    }))
}
