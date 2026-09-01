import type { Groove } from '../../types'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from './selectGroove'

/**
 * Is this the groove `/` is serving on `now`?
 *
 * The one question a shared link has to ask before it decides whether it has
 * anything to offer: a shared page for today's own groove would be the same
 * groove played as practice, recording nothing, so a player who solved it would
 * have spent the day on a copy that never counted (F12 addendum).
 *
 * `now` is a parameter rather than a clock read here, because the answer depends
 * on *whose* day it is. The daily pick is the viewer's calendar day, so only the
 * client can supply it — a server reading its own clock would answer for the
 * wrong day for any viewer whose midnight has not arrived, or has already gone.
 * Keeping it a parameter also keeps this a plain function with a plain test.
 *
 * Compared by `uuid`, not by identity or by `id`: the uuid is the identity that
 * survives a renumbering, and it is what the link carried in the first place.
 */
export function isTodaysGroove(groove: Groove, now: Date): boolean {
  return selectGrooveForDate(now, GROOVES)?.uuid === groove.uuid
}
