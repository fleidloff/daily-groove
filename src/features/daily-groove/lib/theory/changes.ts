/**
 * Every groove loops a four-bar figure, so the changes are always read four
 * bars at a time. Declared here because the lead sheet, and anything else that
 * lays harmony over the figure, needs the same number `barChords` returns.
 */
export const BAR_COUNT = 4

/** The character the generator writes between chord symbols: an en dash. */
const SEPARATOR = '–'

/**
 * The chord sounding in each bar of the four-bar figure, in order.
 *
 * The generator comps `progressionMidi[bar % length]` (scripts/grooves/events.ts,
 * `chordFor`), so a three-chord progression plays 1 2 3 1 and bar four is a
 * return, not a change. The sheet is wrong the moment it disagrees with what is
 * sounding, so this is that same arithmetic and has to stay it.
 *
 * Total: never throws, always `BAR_COUNT` entries. A progression longer than
 * four bars is truncated; a shorter one cycles. An unusable progression — empty,
 * or nothing but separators — yields four empty bars rather than an exception,
 * because a missing progression is a data problem and four blank bars beat the
 * day's payoff crashing.
 */
export function barChords(progression: string): string[] {
  const chords = progression
    .split(SEPARATOR)
    .map((chord) => chord.trim())
    .filter((chord) => chord.length > 0)

  if (chords.length === 0) return Array.from({ length: BAR_COUNT }, () => '')

  return Array.from({ length: BAR_COUNT }, (_, bar) => chords[bar % chords.length])
}
