import type { Answer, Flavour } from '../../types'
import { familyOf, type Family } from './families'
import { seededShuffle } from './options'
import { isoDate } from '../puzzle/selectGroove'

/** What a simple-mode chip needs to know to decide what it sounds like. */
type SimpleLickInput = {
  /** The chip that was tapped: `Major` or `Minor`. */
  family: Family
  /** The day's answer. */
  answer: Answer
  /** The catalogue's flavours, as `flavourPool(GROOVES)` derives them. */
  pool: Flavour[]
  /** The day, for the seed. */
  date: Date
}

/**
 * Which mode a simple-mode chip plays.
 *
 * Simple mode's row offers families, not modes, but a lick has to be *in*
 * something — so each chip stands for one real mode:
 *
 * - The chip whose family matches the day's mode plays the day's actual mode,
 *   so the correct answer sounds like the groove the player is on (R15).
 * - The other chip plays a real mode of *its own* family, picked for the day
 *   by the same ISO-date seed the option rows use, so every player hears the
 *   same pair all day and a reload hears it again (R16, R17).
 *
 * Neither mode is ever named on the card (R18): this decides what sounds, not
 * what is written.
 *
 * **There is no filter against the day's mode, and there must not be one.**
 * The guard is the families table itself: every mode belongs to exactly one
 * family, so a pick from the family the day's mode is *not* in cannot be the
 * day's mode. `families.test.ts` asserts that partition over the shipped pool
 * rather than leaving it assumed — a filter here would paper over the day it
 * stopped being true, and the two chips would quietly start disagreeing about
 * which family the answer is in.
 *
 * Returns `null` when the family has no members in the pool, so a caller with
 * a truncated catalogue stays silent instead of sounding the wrong thing. The
 * shipped pool has six of each; that too is asserted, not assumed.
 */
export function simpleLickMode(input: SimpleLickInput): Flavour | null {
  const { family, answer, pool, date } = input

  if (familyOf(answer.flavour) === family) return answer.flavour

  const candidates = pool.filter((flavour) => familyOf(flavour) === family)
  if (candidates.length === 0) return null

  return seededShuffle(candidates, isoDate(date))[0]
}
