import { GROOVES } from '../../data/grooves.generated'
import type { Groove } from '../../types'

/**
 * The groove a share link points at, or `undefined` when no groove holds that
 * uuid — unknown, retired, or simply malformed (R12, R14).
 *
 * It reads no clock and takes no date. That is what makes "the same URL
 * resolves to the same groove on any day, for any player" (R13) a property of
 * the function rather than something a test has to keep watch over: there is no
 * input a caller could vary to make the answer day-dependent, so the rotation's
 * position is irrelevant here by construction.
 *
 * The comparison is on lowercased uuids (R1b, AC15). The manifest's uuids are
 * canonical lowercase, but a link that has been through a chat client, a mail
 * program or an over-helpful URL rewriter may not be, and a player who followed
 * a link is owed their groove either way. Case is the only normalisation: the
 * uuid is carried whole, so there is no short form to expand and no prefix to
 * strip.
 */
export function grooveByUuid(uuid: string): Groove | undefined {
  const wanted = uuid.toLowerCase()
  return GROOVES.find((groove) => groove.uuid.toLowerCase() === wanted)
}
