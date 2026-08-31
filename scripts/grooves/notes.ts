/**
 * Reference notes: one chromatic root, played once, rendered from the pack.
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
 * Evenness across the twelve (R8) is not calculated here. `mixTracks`
 * normalises every mix onto `PEAK_CEILING`, so all twelve arrive at the same
 * peak for free, and every one is the same voice, register and length by
 * construction.
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
 * The register the row sounds in, scientific pitch: C4 is 60, so the twelve run
 * 60..71. One fixed octave for every root — the row stays even, and the chip
 * that sounds tells the player nothing except which chip they pressed.
 */
export const NOTE_OCTAVE = 4

/**
 * Loud enough to take the pack's top velocity layer without reading as a stab.
 * `renderVoices` scales relative to the layer's nominal, so this is a request
 * for a firm note rather than a raw multiplier.
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
  root: Root
  audioSrc: string
  midi: number
}

/**
 * The file one root renders to.
 *
 * ASCII, lowercase, and named by the root rather than by an index: `♯` and `♭`
 * are fine in a `Root` and awkward in a URL, and `note-e-flat.mp3` survives a
 * reordering of `ROOTS` where `note-04.mp3` would quietly point at a new pitch.
 */
export function noteFileName(root: Root): string {
  const slug = root.toLowerCase().replace(/♯/g, '-sharp').replace(/♭/g, '-flat')
  return `note-${slug}.mp3`
}

/** The twelve notes to render, in `ROOTS` order. */
export function noteSpecs(): ReferenceNote[] {
  return ROOTS.map((root) => ({
    root,
    audioSrc: `/notes/${noteFileName(root)}`,
    midi: midiOf(root, NOTE_OCTAVE),
  }))
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
