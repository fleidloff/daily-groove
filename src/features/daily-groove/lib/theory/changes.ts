/**
 * Every groove loops a four-bar figure, so the changes are always read four
 * bars at a time. Declared here because the lead sheet, and anything else that
 * lays harmony over the figure, needs the same number `barChords` returns.
 */
export const BAR_COUNT = 4

/** The character the generator writes between chord symbols: an en dash. */
const SEPARATOR = '–'

/**
 * The value sounding in each of the four bars, in order.
 *
 * The generator comps `progressionMidi[bar % length]` (scripts/grooves/events.ts,
 * `chordFor`), so a three-chord progression plays 1 2 3 1 and bar four is a
 * return, not a change. The sheet is wrong the moment it disagrees with what is
 * sounding, so this is that same arithmetic and has to stay it.
 *
 * `barChords` and `barNumerals` both go through this one function, so a symbol
 * and a numeral in one bar always describe the same chord by construction
 * rather than by two mappings that happen to agree today.
 *
 * Total: never throws, always `BAR_COUNT` entries. A list longer than four bars
 * is truncated; a shorter one cycles. An empty list yields `BAR_COUNT`
 * `undefined`s rather than an exception, because a missing value is a data
 * problem and four blank bars beat the day's payoff crashing.
 */
export function perBar<T>(values: readonly T[]): (T | undefined)[] {
  if (values.length === 0) return Array.from({ length: BAR_COUNT }, () => undefined)

  return Array.from({ length: BAR_COUNT }, (_, bar) => values[bar % values.length])
}

/**
 * The chord sounding in each bar of the four-bar figure, in order.
 *
 * The progression arrives as one string of `–`-joined symbols, so this splits
 * it, trims each symbol and drops empty segments before handing the list to
 * `perBar`, which owns the bar arithmetic.
 *
 * Total: never throws, always `BAR_COUNT` entries. An unusable progression —
 * empty, or nothing but separators — yields four empty bars rather than an
 * exception.
 */
export function barChords(progression: string): string[] {
  const chords = progression
    .split(SEPARATOR)
    .map((chord) => chord.trim())
    .filter((chord) => chord.length > 0)

  return perBar(chords).map((chord) => chord ?? '')
}
