/**
 * Reference notes: one chromatic pitch, played once, rendered from the pack.
 *
 * A reference note is a degenerate groove — a single `comp` event with no feel,
 * no swing and no humanize — so it reuses the pipeline the grooves already run
 * through rather than growing a synthesiser of its own. Two departures from a
 * groove render, both deliberate:
 *
 * - **No loop wrap.** `mixTracks`' `loopFrames` option folds whatever was
 *   rendered past the loop end back onto the start. For a four-bar groove that
 *   is how a cymbal rings over bar 1; for a single note it would fold the
 *   note's own tail onto its own attack. The note is mixed with no loop option.
 * - **Truncate, then fade.** Length is imposed after the mix, not before: the
 *   note is cut at `NOTE_SECONDS` and ramped to silence over the final
 *   `RELEASE_SECONDS`, so it ends on zero rather than on a step.
 *
 * Evenness across the set (R8) is not calculated here. `mixTracks` normalises
 * every mix onto `PEAK_CEILING`, so all twenty-four arrive at the same peak for
 * free, and every one is the same voice and the same length by construction.
 *
 * **Two registers, and they are not equally loud.** Since feature-16 the render
 * covers C4–B5, not one octave, and "even by construction" no longer covers
 * loudness: measured RMS runs about 7.8 dB across the twenty-four, because the
 * pack's higher recordings are genuinely more transient than its lower ones.
 * That slope is the instrument's own register behaviour and is deliberately not
 * compensated:
 *
 * - It cannot be made continuous. R27 pins octave 4 to the bytes it already
 *   shipped, so any correction would have to be a branch above the boundary —
 *   and the boundary is where the discontinuity is currently *smallest* (C5 is
 *   0.65 dB louder than B4, not quieter).
 * - Peak equality, not RMS equality, is what the app's single `REFERENCE_LEVEL`
 *   is built on, and peak is exactly equal across all twenty-four.
 *
 * So: same voice, same length, same peak; two registers and a measured 7.8 dB
 * RMS slope across them, accepted on purpose. Measure before citing evenness.
 */

import type { Root } from '../../src/lib/groove.ts'
import { mixTracks } from './mix.ts'
import { ROOTS, midiOf } from './theory/notes.ts'
import type { FeelTemplate, NoteEvent, Pcm, SamplePack } from './types.ts'
import { renderVoices } from './voices.ts'

/** How long a reference note rings. Long enough to hum against, short enough not to outstay it. */
export const NOTE_SECONDS = 2.0

/** The fade at the end of that. A note has to stop somewhere; it must not click. */
export const RELEASE_SECONDS = 0.15

/**
 * The lower of the two registers, scientific pitch: C4 is 60.
 *
 * It is the base in two senses. It is where the root row sounds, and it is the
 * octave whose twelve files shipped before the render widened — so it is the
 * one that keeps the bare file names (R27). Moving this constant renames those
 * twelve and invalidates every hash in the lock.
 */
export const BASE_OCTAVE = 4

/**
 * The registers rendered, ascending: C4–B5, twenty-four pitches, midi 60..83.
 *
 * Two octaves rather than one because a lick is transposed to the day's root
 * (60..71) and may reach an octave above it — root B4 plus an octave is B5, the
 * top of this range. A pitch a lick can name and the render cannot produce is a
 * silent note, so the range is the phrase's reach, not a round number.
 */
export const NOTE_OCTAVES = [4, 5] as const

/**
 * Loud enough to take the pack's top velocity layer without reading as a stab.
 * `renderVoices` scales relative to the layer's nominal, so this is a request
 * for a firm note rather than a raw multiplier.
 *
 * Global to the render, and it must stay global: a per-octave velocity would
 * have to be a branch, and a branch would move the twelve committed files'
 * bytes. `notes.test.ts` asserts one velocity across all twenty-four.
 */
const NOTE_VELOCITY = 0.85

/**
 * The mix stage wants a template. A reference note has no feel to declare, so
 * it gets one with nothing in it: no gain entry leaves the voice at unity, no
 * pan entry leaves it centred, and every other field is inert for a render of
 * one event. Local and private — this is not a feel anybody can author against.
 */
const NOTE_TEMPLATE: FeelTemplate = {
  id: 'reference-note',
  tempoRange: [96, 96],
  subdivision: 4,
  swing: 0,
  flavours: [],
  voices: ['comp'],
  humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  gain: {},
  pan: {},
  passes: 1,
  density: { minPerBar: 0, maxPerBar: 1 },
}

/**
 * One reference note, as the app's generated manifest describes it.
 *
 * Declared here rather than imported: the generated module the app reads is a
 * write target for this generator, never a dependency of it, and `scripts/`
 * may not import from a feature slice. `notes-cli.ts` is the one file that
 * knows where the module lands.
 */
export type ReferenceNote = {
  /** Scientific pitch, e.g. `'C♯5'`. The lock's id and the manifest's key. */
  id: string
  root: Root
  octave: number
  audioSrc: string
  midi: number
}

/**
 * The file one pitch renders to.
 *
 * ASCII, lowercase, and named by the root rather than by an index: `♯` and `♭`
 * are fine in a `Root` and awkward in a URL, and `note-e-flat.mp3` survives a
 * reordering of `ROOTS` where `note-04.mp3` would quietly point at a new pitch.
 *
 * `BASE_OCTAVE` is bare and every octave above it takes a `-<octave>` suffix.
 * That asymmetry is R27: the twelve files at `note-c.mp3` … `note-b.mp3` are
 * already committed, already hashed in `grooves.lock.json` and already served
 * at those URLs, so widening the render must add files and rename none.
 *
 * **The same rule is written a second time**, as `noteFile(dir, id)` in
 * `lock.ts`. It has to be: this module imports the renderer, and the guard may
 * import nothing that renders. Both copies are asserted against the same
 * literals, never against each other.
 */
export function noteFileName(root: Root, octave: number): string {
  const slug = root.toLowerCase().replace(/♯/g, '-sharp').replace(/♭/g, '-flat')
  const suffix = octave === BASE_OCTAVE ? '' : `-${octave}`
  return `note-${slug}${suffix}.mp3`
}

/** The twenty-four notes to render, ascending by midi: C4 up to B5. */
export function noteSpecs(): ReferenceNote[] {
  return NOTE_OCTAVES.flatMap((octave) =>
    ROOTS.map((root) => ({
      id: `${root}${octave}`,
      root,
      octave,
      audioSrc: `/notes/${noteFileName(root, octave)}`,
      midi: midiOf(root, octave),
    })),
  )
}

/** One mixed, truncated, faded note. Pure: the same pack renders the same PCM. */
export function renderNote(pack: SamplePack, midi: number, sampleRate: number): Pcm {
  const event: NoteEvent = {
    voice: 'comp',
    timeSec: 0,
    durationSec: NOTE_SECONDS,
    velocity: NOTE_VELOCITY,
    midi,
  }

  const tracks = renderVoices([event], pack, sampleRate)
  // No mix options: a loop length here would wrap the note's tail onto its
  // attack. See the module comment.
  const master = mixTracks(tracks, NOTE_TEMPLATE)

  const frames = Math.round(NOTE_SECONDS * sampleRate)
  return {
    sampleRate,
    left: release(truncate(master.left, frames), sampleRate),
    right: release(truncate(master.right, frames), sampleRate),
  }
}

/** Exactly `frames` long: cut if the mix ran over, zero-padded if it ran short. */
function truncate(channel: Float32Array, frames: number): Float32Array {
  if (channel.length === frames) return channel
  const cut = new Float32Array(frames)
  cut.set(channel.subarray(0, Math.min(frames, channel.length)))
  return cut
}

/**
 * Fade the final `RELEASE_SECONDS` linearly to zero, in place.
 *
 * The ramp reaches exactly 0 on the last sample rather than one step short of
 * it, so the file ends on silence and nothing has to be trusted to round down.
 */
function release(channel: Float32Array, sampleRate: number): Float32Array {
  const total = channel.length
  const ramp = Math.min(total, Math.max(2, Math.round(RELEASE_SECONDS * sampleRate)))
  const from = total - ramp

  for (let i = from; i < total; i += 1) {
    channel[i] *= (total - 1 - i) / (ramp - 1)
  }

  return channel
}
