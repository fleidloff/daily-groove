import type { FeelTemplate, GrooveSpec, MusicMeta, NoteEvent, VoiceName } from './types.ts'
import { intBetween, pick, rngFor } from './rng.ts'
import { applySwing, fitToLoop, humanize } from './humanize.ts'
import { ROOTS } from './theory/notes.ts'
import { buildHarmony } from './theory/harmony.ts'
import type { Harmony } from './theory/harmony.ts'
import { scaleName } from './theory/scales.ts'

/** 4/4 throughout the feature. */
const BEATS_PER_BAR = 4

/** Every groove is a four-bar loop. */
const BARS = 4

/** The octave the bass plays in, as a MIDI offset applied to a pitch class. */
const BASS_BASE_MIDI = 36

/**
 * A groove is a backing track (R8): drums, a bass and a comp, and no lead. This
 * is the whole set of voices any template may play.
 */
export const BACKING_VOICES: VoiceName[] = [
  'kick',
  'snare',
  'hatClosed',
  'hatOpen',
  'rim',
  'bass',
  'comp',
]

/**
 * The window the comp is voiced in, in MIDI. Chords are folded into it rather
 * than transposed as a block, so a groove in B does not sit a major seventh
 * above one in C. The ceiling is what keeps the comp out of the register a
 * soloist plays in (R8), and the floor keeps it above the bass (R10).
 */
export const COMP_REGISTER_LOW = 55
export const COMP_REGISTER_CEILING = 76

/**
 * A note at or below this velocity reads as a ghost note rather than a played
 * one. Tests assert a groove contains some; nothing in the render path branches
 * on it.
 */
export const GHOST_VELOCITY_THRESHOLD = 0.5

/**
 * How hard each voice hits, by metric position on the sixteenth grid:
 * `strong` is a quarter-note position, `medium` an off-eighth, `weak` an
 * off-sixteenth. This is the whole of R6 — the backbeat lands above every hat
 * around it, and the hats' own off-positions fall into ghost territory.
 */
const VELOCITIES: Record<VoiceName, { strong: number; medium: number; weak: number }> = {
  kick: { strong: 0.98, medium: 0.86, weak: 0.74 },
  snare: { strong: 1, medium: 0.7, weak: 0.45 },
  hatClosed: { strong: 0.75, medium: 0.45, weak: 0.32 },
  hatOpen: { strong: 0.75, medium: 0.68, weak: 0.6 },
  rim: { strong: 0.55, medium: 0.5, weak: 0.42 },
  bass: { strong: 0.92, medium: 0.8, weak: 0.68 },
  comp: { strong: 0.72, medium: 0.62, weak: 0.52 },
}

/**
 * How loud a voice plays at a given step of the sixteenth-note bar. Callers on
 * a coarser grid convert their step back to this one first, so an eighth-note
 * template's downbeats are read as downbeats rather than as off-sixteenths.
 */
function velocityFor(voice: VoiceName, step: number): number {
  const shape = VELOCITIES[voice]
  if (step % 4 === 0) return shape.strong
  if (step % 2 === 0) return shape.medium
  return shape.weak
}

/**
 * Rhythms are written against a sixteenth-note bar and scaled to whatever
 * subdivision the template declares, so a future eighth-note template reuses
 * them rather than restating them.
 */
const PATTERN_RESOLUTION = 16

const KICK_PATTERNS: number[][] = [
  [0, 6, 10],
  [0, 3, 6, 10],
  [0, 6, 10, 14],
  [0, 7, 10],
  [0, 6, 8, 14],
]

const HAT_PATTERNS: number[][] = [
  [0, 2, 4, 6, 8, 10, 12, 14],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
]

const BASS_PATTERNS: number[][] = [
  [0, 6, 10],
  [0, 3, 10],
  [0, 6, 10, 14],
  [0, 8, 14],
]

const COMP_PATTERNS: number[][] = [
  [2, 10],
  [2, 6, 10],
  [0, 10],
  [2, 11],
]

/**
 * Where the fixed hits land, on the sixteenth grid: the backbeat, the open hat
 * that closes the bar, and the cross-stick pickup with the bars that carry it.
 *
 * These are the placements every template gets unless it asks for others. The
 * variable patterns above are drawn per seed; these are not, because a groove
 * whose backbeat moves is a different groove, not the same one in another key.
 */
type Placement = {
  snare: number[]
  hatOpen: number[]
  rim: number[]
  /** Bars (0-based) that carry the rim pickup into the next one. */
  rimBars: number[]
}

export const DEFAULT_PLACEMENT: Placement = {
  snare: [4, 12],
  hatOpen: [14],
  rim: [15],
  rimBars: [1, 3],
}

/**
 * Per-template overrides, keyed by template id.
 *
 * `FeelTemplate` is frozen, and none of its fields can say "this feel is
 * half-time" — the pulse is not in the subdivision, the tempo range or the
 * voice set. So the one placement that a feel genuinely changes lives here,
 * next to the rule it overrides, rather than in a field that would have meant
 * editing the contract. A template with no entry gets `DEFAULT_PLACEMENT`.
 */
export const PLACEMENTS: Record<string, Partial<Placement>> = {
  // Half-time is the wide backbeat: one snare on beat three, where a straight
  // feel would play two. It is the whole reason this table exists.
  'half-time': { snare: [8] },
  // No open hat on this kit, and a single light pickup into the turnaround
  // rather than one every other bar.
  'bright-straight': { rim: [14], rimBars: [3] },
}

function placementFor(templateId: string): Placement {
  return { ...DEFAULT_PLACEMENT, ...(PLACEMENTS[templateId] ?? {}) }
}

/** Map a sixteenth-grid step onto the template's own grid. */
function scaleStep(step: number, subdivision: number): number {
  // Clamped, because a sixteenth late in the bar rounds up past the last step
  // of a coarser grid — step 15 on an eighth-note grid is 8, which would place
  // the hit in the following bar and, in bar four, outside the loop entirely.
  return Math.min(subdivision - 1, Math.round((step * subdivision) / PATTERN_RESOLUTION))
}

/**
 * A sixteenth-grid rhythm, resolved onto the template's own grid.
 *
 * Rounding a finer rhythm onto a coarser grid collapses neighbouring steps
 * together, so the result is deduped: without that, a sixteenth-note hat
 * pattern on an eighth-note template would stack two events on every eighth
 * and play at twice the level of one that was written in eighths. Ascending
 * order is preserved, so the bass still walks the chord in the order the
 * pattern was written.
 */
function gridSteps(steps: number[], subdivision: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const source of [...steps].sort((a, b) => a - b)) {
    const step = scaleStep(source, subdivision)
    if (seen.has(step)) continue
    seen.add(step)
    out.push(step)
  }
  return out
}

/** Lift a pitch class into the register a voice plays in. */
function inRegister(midi: number, base: number): number {
  return base + (((midi % 12) + 12) % 12)
}

/** Fold a chord tone into the comp's fixed register window. */
function inCompRegister(midi: number): number {
  let folded = midi
  while (folded >= COMP_REGISTER_CEILING) folded -= 12
  while (folded < COMP_REGISTER_LOW) folded += 12
  return folded
}

/**
 * Turn a spec and a feel template into the note events of a four-bar loop, plus
 * the words that describe them.
 *
 * Every choice — tempo, key, flavour, harmony, and which rhythm variant is used
 * — is drawn from a generator seeded by `{ template, seed }` alone, so the same
 * two values always describe the same groove no matter what it is called, and
 * the audio can never drift from the metadata that ships beside it.
 */
export function buildEvents(
  spec: GrooveSpec,
  template: FeelTemplate,
): { events: NoteEvent[]; music: MusicMeta; harmony: Harmony } {
  const rng = rngFor(`${spec.template}:${spec.seed}:events`)

  const bpm = intBetween(rng, template.tempoRange[0], template.tempoRange[1])
  const root = pick(rng, ROOTS)
  const flavour = pick(rng, template.flavours)
  const harmony = buildHarmony(root, flavour, rng)

  // Every rhythm is written on the sixteenth grid and resolved onto the
  // template's own, so an eighth-note template plays the same vocabulary at its
  // own resolution rather than needing a second set of patterns.
  const grid = (steps: number[]) => gridSteps(steps, template.subdivision)
  const placement = placementFor(template.id)

  const kickSteps = grid(pick(rng, KICK_PATTERNS))
  const hatSteps = grid(pick(rng, HAT_PATTERNS))
  const bassSteps = grid(pick(rng, BASS_PATTERNS))
  const compSteps = grid(pick(rng, COMP_PATTERNS))
  const snareSteps = grid(placement.snare)
  const hatOpenSteps = grid(placement.hatOpen)
  const rimSteps = grid(placement.rim)

  const secPerBeat = 60 / bpm
  const barSec = secPerBeat * BEATS_PER_BAR
  const stepSec = barSec / template.subdivision
  /** Durations are written in sixteenths, so a note is the same length at any grid. */
  const sixteenthSec = barSec / PATTERN_RESOLUTION

  const events: NoteEvent[] = []
  const plays = (voice: VoiceName) => template.voices.includes(voice)

  const add = (
    voice: VoiceName,
    bar: number,
    step: number,
    sixteenths: number,
    midi?: number,
  ) => {
    const event: NoteEvent = {
      voice,
      timeSec: (bar * template.subdivision + step) * stepSec,
      durationSec: sixteenths * sixteenthSec,
      // Read the accent from where the hit lands in the bar, not from which
      // step of the template's grid it is: on an eighth grid, step 1 is the
      // second eighth, which is an off-eighth and not an off-sixteenth.
      velocity: velocityFor(voice, (step * PATTERN_RESOLUTION) / template.subdivision),
    }
    if (midi !== undefined) event.midi = midi
    events.push(event)
  }

  for (let bar = 0; bar < BARS; bar++) {
    const chord = harmony.progressionMidi[bar % harmony.progressionMidi.length]

    // Drums — the same figure every bar, because this epic is not yet played.
    if (plays('kick')) for (const step of kickSteps) add('kick', bar, step, 2)
    if (plays('snare')) for (const step of snareSteps) add('snare', bar, step, 2)
    if (plays('hatClosed')) {
      const closed = plays('hatOpen')
        ? hatSteps.filter((s) => !hatOpenSteps.includes(s))
        : hatSteps
      for (const step of closed) add('hatClosed', bar, step, 1)
    }
    if (plays('hatOpen')) for (const step of hatOpenSteps) add('hatOpen', bar, step, 2)
    if (plays('rim') && placement.rimBars.includes(bar)) {
      for (const step of rimSteps) add('rim', bar, step, 1)
    }

    // Bass — the bar's chord tones, root first, in the bass register.
    if (plays('bass')) {
      bassSteps.forEach((step, i) => {
        add('bass', bar, step, 2, inRegister(chord[i % chord.length], BASS_BASE_MIDI))
      })
    }

    // Comp — the whole chord, as written by the harmony module, so bar 1's
    // pitches are exactly the ones `music.chord` names.
    if (plays('comp')) {
      for (const step of compSteps) {
        for (const midi of chord) add('comp', bar, step, 4, inCompRegister(midi))
      }
    }
  }

  // The feel stages, in order: the accents are already in place above, so the
  // grid is swung, then every note is nudged, and then the loop is pinned back
  // to exactly four bars. The humanize generator is labelled from
  // { template, seed } like every other draw here, so a groove's feel travels
  // with its identity rather than with its name.
  const barsSec = barSec * BARS
  const swung = applySwing(events, template.swing, template.subdivision, bpm)
  const nudged = humanize(
    swung,
    template,
    rngFor(`${spec.template}:${spec.seed}:humanize`),
    bpm,
  )
  const shaped = fitToLoop(nudged, barsSec)

  const voiceOrder = (voice: VoiceName) => {
    const index = template.voices.indexOf(voice)
    return index < 0 ? template.voices.length : index
  }
  shaped.sort(
    (a, b) =>
      a.timeSec - b.timeSec ||
      voiceOrder(a.voice) - voiceOrder(b.voice) ||
      (a.midi ?? 0) - (b.midi ?? 0),
  )

  const music: MusicMeta = {
    bpm,
    bars: BARS,
    root,
    flavour,
    scale: scaleName(root, flavour),
    chord: harmony.chordName,
    progression: harmony.progressionName,
  }

  return { events: shaped, music, harmony }
}
