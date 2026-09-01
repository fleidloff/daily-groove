/**
 * How this app writes a calendar day, in one place.
 *
 * Pinned to en-GB so the line reads "Sunday, 30 August" regardless of the
 * viewer's locale, which is the form the design sets. The *day* itself is still
 * the viewer's local calendar day; only its wording is fixed.
 *
 * Two formatters composed rather than one `Intl` call: en-GB's combined
 * weekday/day/month format omits the comma this line needs.
 *
 * It lives here, rather than beside the header that first needed it, because
 * the groove card repeats the same day next to the tempo. Two components
 * spelling a date two ways is the drift this module exists to prevent.
 */
import type { Answer, Groove } from '../../types'

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
})

/** The day as the page writes it, e.g. `Sunday, 30 August`. */
export function dateLine(date: Date): string {
  return `${WEEKDAY.format(date)}, ${DAY_MONTH.format(date)}`
}

/**
 * The groove card's meta line: the tempo, then the day the groove belongs to —
 * or the words "shared groove" where a shared groove has no day (F12 E3 R1a).
 *
 * Composed here rather than in the card, so the card branches on nothing and
 * the two pages that render it differ in data rather than in logic. Lowercase,
 * matching the sentence case of the tempo beside it. No date is written on a
 * shared groove at all: today's date there would imply this *is* today's
 * puzzle, which is the exact confusion the words replace.
 */
export function metaLine(
  groove: Groove,
  date: Date | null,
  answer: Answer | null = null,
): string {
  return [
    `${groove.bpm} bpm`,
    // Between the tempo and the day, which is where feature-11 put it and
    // where it stays: this function composing the whole line is what lets
    // `GrooveCard` render one opaque string without the daily page's copy
    // moving to make room for the shared page's.
    ...(answer ? [`${answer.root} ${answer.flavour}`] : []),
    date ? dateLine(date) : 'shared groove',
  ].join(' · ')
}
