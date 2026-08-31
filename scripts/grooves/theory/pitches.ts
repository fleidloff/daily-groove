/**
 * The event-level pitch rule: what the audio actually plays, checked against
 * the scale the manifest names.
 *
 * `validity.ts` compares the harmony *object* — chord names, degrees, pitch
 * classes — against the scale, and never reads a `NoteEvent`. That was
 * sufficient for as long as every emitted pitch was derived from
 * `harmony.progressionMidi`: the events could not disagree with the harmony
 * without someone editing the code that writes them. The bass's chromatic
 * approach note is that edit, so "the events are in scale" stops being true by
 * construction and becomes something to check.
 *
 * This module is that check. It lives beside the harmony rules rather than
 * inside the gate because it is a musical rule, not a mastering one:
 *
 *     every pitched event is in scale
 *       EXCEPT one bass event per chord change, on the last off-beat before
 *       it, a semitone from the next chord's root
 */

import type { MusicMeta, NoteEvent, VoiceName } from '../types.ts'
import type { Harmony } from './harmony.ts'
import { pitchesOf } from './scales.ts'

export type PitchFailure = { voice: VoiceName; midi: number; timeSec: number }

/** 4/4 throughout the feature, as in `events.ts`. */
const BEATS_PER_BAR = 4

/**
 * How much of the bar's end counts as "the last off-beat subdivision".
 *
 * The check is handed no `FeelTemplate`, so it cannot read the grid the bar was
 * written on. It does not need to: the templates are written on eighths or
 * sixteenths, and the closing eighth of a bar is the last off-beat step of an
 * eighth grid and the last two steps of a sixteenth one. A note on the first
 * beat, or anywhere in the first seven eighths, is nowhere near it.
 */
const APPROACH_WINDOW = 1 / 8

/**
 * Slack on both ends of that window, as a fraction of a bar — a thirty-second
 * note. Swing, lean, per-hit timing slop and drift all move an onset by a few
 * milliseconds after it is written, and an approach note that was nudged off
 * the grid is still the approach note.
 */
const APPROACH_SLACK = 1 / 32

/**
 * THE ONE HOLE IN THE IN-SCALE GUARANTEE.
 *
 * Written here, next to the rule it bends, the way `IDIOMS` in `harmony.ts`
 * states the chords the blues plays that its own scale does not contain.
 *
 * The bass — and only the bass — may play one chromatic note per chord change:
 * on the last off-beat subdivision of the bar preceding the change, a semitone
 * above or below the *next* chord's root, resolving into it. Anywhere else in
 * the bar the same pitch is rejected; any other voice playing it is rejected;
 * and a second one in the same bar is rejected.
 *
 * The loop's end is a chord change like any other — the final bar's "next
 * chord" is bar one's — and the note sounds inside the loop rather than being
 * written past its end.
 *
 * This is deliberately the narrowest hole that buys the device. "The bass may
 * play passing tones" is not testable; a named, single-position,
 * single-interval, once-per-change exception is.
 */
function isApproachNote(event: NoteEvent, midi: number, change: BarChange): boolean {
  return event.voice === 'bass' && semitoneDistance(midi, change.nextRootMidi) === 1
}

type BarChange = { bar: number; nextRootMidi: number }

/**
 * Every pitched event the scale does not admit, approach notes aside.
 *
 * Returned in time order, so the first failure is the earliest one and a gate
 * can name it.
 */
export function offScalePitches(
  events: NoteEvent[],
  music: MusicMeta,
  harmony: Harmony,
): PitchFailure[] {
  const allowed = admittedPitchClasses(music, harmony)
  const barSec = (60 / music.bpm) * BEATS_PER_BAR
  const bars = Math.max(1, Math.round(music.loopBars))
  const loopSec = barSec * bars
  const changes = chordChanges(music, harmony, bars)

  const slackSec = barSec * APPROACH_SLACK
  const windowSec = barSec * APPROACH_WINDOW

  /** One approach note per change: the bar whose end it leads over. */
  const claimed = new Set<number>()
  const failures: PitchFailure[] = []

  const ordered = [...events].sort((a, b) => a.timeSec - b.timeSec)

  for (const event of ordered) {
    if (event.midi === undefined) continue
    if (allowed.has(pitchClass(event.midi))) continue

    // The change this event could be approaching: the one whose bar line it
    // sits just before. `timeSec < loopSec` is R8a's other half — the note
    // sounds inside the loop, never past its end.
    const change =
      event.timeSec < loopSec
        ? (changes.find(({ bar }) => {
            const barEnd = (bar + 1) * barSec
            return (
              event.timeSec >= barEnd - windowSec - slackSec &&
              event.timeSec < barEnd + slackSec
            )
          }) ?? null)
        : null

    if (change && !claimed.has(change.bar) && isApproachNote(event, event.midi, change)) {
      claimed.add(change.bar)
      continue
    }

    failures.push({ voice: event.voice, midi: event.midi, timeSec: event.timeSec })
  }

  return failures
}

/**
 * The pitch classes an event may sound: the scale, plus the tones of the chords
 * the harmony itself declares.
 *
 * The second half is empty for seven of the eight flavours — `chordsForScale`
 * only ever builds a chord whose every tone is already in the scale — and
 * `pitches.test.ts` asserts exactly that. It exists for blues, whose I7, IV7
 * and V7 carry a major third that no strict reading of the six-note blues
 * scale holds. `harmony.ts`'s `IDIOMS` states those chords and
 * `validity.ts`'s blues rule admits them, so a blues comp playing them is the
 * words and the audio agreeing, not disagreeing. `gateCandidate` runs
 * `checkHarmony` before this check, so by the time it reads an event the
 * chords it defers to have already been validated against the flavour.
 */
function admittedPitchClasses(music: MusicMeta, harmony: Harmony): Set<number> {
  const allowed = new Set(pitchesOf(music.root, music.flavour))
  for (const chord of [harmony.chordMidi, ...harmony.progressionMidi]) {
    for (const midi of chord ?? []) allowed.add(pitchClass(midi))
  }
  return allowed
}

/**
 * Every bar whose chord differs from the following bar's, with that following
 * chord's root.
 *
 * The harmony repeats every `music.bars` — the four-bar figure — however many
 * passes were rendered, so the bar after the last is bar one and the loop's end
 * falls out of the same modular arithmetic as every other bar line rather than
 * being special-cased (R8a).
 */
function chordChanges(music: MusicMeta, harmony: Harmony, bars: number): BarChange[] {
  const chords = harmony.progressionMidi
  if (chords.length === 0) return []
  const figure = music.bars > 0 ? Math.round(music.bars) : bars
  const chordIndex = (bar: number) => (((bar % figure) + figure) % figure) % chords.length

  const changes: BarChange[] = []
  for (let bar = 0; bar < bars; bar++) {
    const next = chordIndex(bar + 1)
    if (next === chordIndex(bar)) continue
    // Chords are written root-first by `harmony.ts`, lowest tone first.
    const nextRootMidi = chords[next][0]
    if (nextRootMidi === undefined) continue
    changes.push({ bar, nextRootMidi })
  }
  return changes
}

/** Semitones between two pitches, ignoring octave: 0..6. */
function semitoneDistance(a: number, b: number): number {
  const interval = pitchClass(Math.round(a) - Math.round(b))
  return Math.min(interval, 12 - interval)
}

function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}
