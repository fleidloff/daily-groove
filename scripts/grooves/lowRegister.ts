// How the sign-off table picks the groove that anchors a feel: the share of a groove's
// bass note-time that sounds below MIDI 28. Nothing here renders audio and nothing the
// CLI reaches imports it — its three consumers are all in the tooling around the table.
// gate.test.ts's `pins the groove that moved most in every registered feel` asserts the
// rule, feature-28's gate-B track picks the grooves it renders for a listening with it,
// and its sign-off track reads it again when it writes the entries.
//
// 28 is the metric's own constant and is deliberately not BASS_FLOOR_MIDI. It is the
// four-string's open low E — the register boundary the change that motivated this metric
// was about — and binding it to the live floor would make every groove read zero again
// the day the floor moves.

import { readCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { templateById } from './templates/index.ts'
import type { GrooveSpec, NoteEvent } from './types.ts'

export const LOW_REGISTER_CEILING_MIDI = 28

/**
 * Share of a groove's bass note-time that sounds below MIDI 28, in 0..1.
 *
 * Note-time is `Σ durationSec`, not a note count: `fitToLoop` truncates whatever
 * overruns the loop end, so a groove's bass durations are not uniform and counting
 * notes would weigh a clipped note like a whole one.
 *
 * A bass event with no `midi` is time with no pitch and is absent from both sums. So is
 * a rest — `buildEvents` pushes no event for one at all, which is why nothing here
 * synthesises a zero-duration stand-in. Returns 0, never NaN, when a groove has no
 * pitched bass event.
 */
export function lowRegisterShare(events: readonly NoteEvent[]): number {
  let total = 0
  let low = 0
  for (const event of events) {
    if (event.voice !== 'bass' || event.midi === undefined) continue
    total += event.durationSec
    if (event.midi < LOW_REGISTER_CEILING_MIDI) low += event.durationSec
  }
  return total === 0 ? 0 : low / total
}

/**
 * The feel's grooves, sorted by `lowRegisterShare` descending, over the event stream
 * `buildEvents` produces today — post-swing, post-humanize, post-drift, post-`fitToLoop`,
 * which is the stream that becomes audio.
 *
 * Ties keep catalogue order: the sort is stable and there is no secondary comparator, so
 * the argmax is whichever of the tied grooves `catalogue.json` lists first.
 */
export function lowRegisterRanking(
  feel: string,
  catalogue: readonly GrooveSpec[] = readCatalogue(),
): { id: string; share: number }[] {
  return catalogue
    .filter((spec) => spec.template === feel)
    .map((spec) => ({
      id: spec.id,
      share: lowRegisterShare(buildEvents(spec, templateById(spec.template)).events),
    }))
    .sort((a, b) => b.share - a.share)
}
