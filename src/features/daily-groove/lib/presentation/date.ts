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
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
})

/** The day as the page writes it, e.g. `Sunday, 30 August`. */
export function dateLine(date: Date): string {
  return `${WEEKDAY.format(date)}, ${DAY_MONTH.format(date)}`
}
