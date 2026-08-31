import type { FeelTemplate, GrooveSpec, MusicMeta, NoteEvent, VoiceName } from './types.ts'
import { intBetween, pick, rngFor } from './rng.ts'
import { applyDrift, applySwing, fitToLoop, humanize } from './humanize.ts'
import { ROOTS } from './theory/notes.ts'
import { buildHarmony } from './theory/harmony.ts'
import type { Harmony } from './theory/harmony.ts'
import { scaleName } from './theory/scales.ts'

/** 4/4 throughout the feature. */
const BEATS_PER_BAR = 4

/** The musical figure every groove is written as: four bars. */
const BARS_PER_PASS = 4

/**
 * The label of the stream that draws what a groove IS — its tempo, root,
 * flavour and harmony.
 *
 * FROZEN. Eighteen committed answers are derived from this exact string, drawn
 * in exactly the order below, so a player's record of solving `groove-07` keeps
 * describing the groove it described the day they solved it. Changing the
 * string, the draw order, or the number of draws taken before `buildHarmony`
 * re-keys the whole catalogue. The same class of rule as `src/lib/hash.ts`.
 *
 * Nothing may be added to this stream. Later epics draw from `RHYTHM_LABEL` or
 * from a labelled stream of their own.
 */
export const MUSIC_LABEL = 'events'

/**
 * The label of the stream that draws how a groove is PLAYED — which kick, hat,
 * bass and comp pattern it uses.
 *
 * Separate from `MUSIC_LABEL` on purpose. A single sequential stream means one
 * added draw on the rhythm side shifts every draw after it, so a change to how
 * a hi-hat pattern is chosen would silently re-key every answer in the
 * catalogue (R6). Split, the rhythm side is free to change.
 */
export const RHYTHM_LABEL = 'rhythm'

/**
 * The stream the snare's ghost strokes are drawn from, one draw per bar.
 *
 * Its own label rather than a share of `RHYTHM_LABEL`, because it is consumed a
 * number of times that depends on the loop's length: a four-pass groove takes
 * sixteen draws and a two-pass groove eight, and any choice made after them on
 * a shared stream would move when a template's pass count changed.
 */
export const GHOST_LABEL = 'ghosts'

/** The octave the bass plays in, as a MIDI offset applied to a pitch class. */
const BASS_BASE_MIDI = 36

/**
 * How far a displaced bass note drops: one octave, into the register below
 * `BASS_BASE_MIDI`. Down and never up, because up would put the line inside the
 * comp's window and break the "bass under the comp" rule the arrangement rests
 * on. `BASS_BASE_MIDI - 12` is the lowest note the sample pack carries.
 */
const BASS_OCTAVE_DROP = 12

/**
 * How the bass line is written, as the chances one draw of the rhythm stream is
 * tested against per note.
 *
 * These three numbers are the whole of R7. Before them the bass was
 * `chord[i % chord.length]` — every available step sounded, in a fixed order,
 * inside one octave, which is an arpeggiator rather than a player. A rest, a
 * repeat and an octave drop are the three things a bass player does that an
 * arpeggiator does not, and they are drawn per note of the four-bar figure so
 * the figure still repeats exactly in every pass (AC3).
 *
 * The downbeat is exempt from all three: it is always the bar's root, in the
 * base octave. It anchors the bar, it is what the comp's rootless voicing
 * depends on being there (R6), and it is what an approach note in the bar
 * before resolves onto (R8).
 */
const BASS_REST_CHANCE = 0.18
const BASS_REPEAT_CHANCE = 0.4
const BASS_OCTAVE_CHANCE = 0.32

/**
 * How wide a comp chord is rolled, in seconds — the whole chord, first note to
 * last, not a per-note step. One value is drawn per groove inside this band.
 *
 * A few milliseconds is the point (R4, AC5): enough that the notes do not all
 * begin on the same sample, not so much that the chord reads as an arpeggio or
 * that a note is heard as landing on the next subdivision.
 */
const COMP_SPREAD_RANGE: [number, number] = [0.005, 0.015]

/**
 * How much quieter each voice is than the one above it, as a fraction of the
 * chord's metric velocity.
 *
 * The top voice is the melody a listener follows, so it keeps the full accent
 * and everything under it steps down (R5, AC6). A drop rather than a fixed
 * table, so a triad and a seventh are shaped by the same rule.
 */
const COMP_VOICE_DROP = 0.12

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
 * one. The snare's ghost strokes are emitted well under it (R10), and the
 * tests read a snare's role from it: at or above is a backbeat, below is a
 * ghost.
 */
export const GHOST_VELOCITY_THRESHOLD = 0.5

/**
 * How hard a ghost stroke is struck, as a band the rhythm stream draws one
 * value from per groove. Well under `GHOST_VELOCITY_THRESHOLD`, with the
 * humanize slop on top, so a ghost can never be mistaken for a backbeat.
 *
 * Literals rather than template data on purpose: if a feel turns out to want
 * its own, that is a field on `FeelTemplate`, and it should land with the rest
 * of them rather than trickling in later.
 */
const GHOST_VELOCITY_RANGE: [number, number] = [0.15, 0.25]

/** A velocity floor, so an accent multiplier can never silence a hit. */
const MIN_VELOCITY = 0.05

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
 * The hats' accent shape: a repeating cycle of multipliers on top of the metric
 * accent (R11).
 *
 * `velocityFor` is a pure function of metric position, so without this every
 * hat at a given step class is the same velocity forever, which is the flat,
 * machine-like hat the epic is about. The cycle is applied by the hat's
 * position in the bar's hat sequence rather than by its step: indexing by step
 * would partition the bar exactly the way `velocityFor` already does and change
 * nothing.
 *
 * Hats only. Kick, snare, bass and comp keep reading their accent from metric
 * position alone — that is R12, and the backbeat has to stay the loudest thing
 * around it.
 */
const HAT_ACCENTS = [1, 0.72, 0.88, 0.66]

function clampVelocity(velocity: number): number {
  return Math.min(1, Math.max(MIN_VELOCITY, velocity))
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

/**
 * Where the snare ghosts, written as off-sixteenths.
 *
 * Every step is odd: a ghost is what fills the space *between* the backbeats,
 * so it never lands on one. Drawn per groove from the rhythm stream like the
 * kick and hat patterns — never from the music stream, whose draw order is
 * frozen (see `MUSIC_LABEL`).
 */
const SNARE_GHOST_PATTERNS: number[][] = [
  [3, 11],
  [7, 15],
  [11, 15],
  [3, 7, 11],
  [3, 11, 15],
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

/**
 * A ghost's off-sixteenth, resolved onto the template's own grid — and kept
 * *off* the beat there too.
 *
 * `gridSteps` rounds to the nearest step, which on an eighth-note grid lands
 * half of the off-sixteenths on a downbeat: a ghost on the beat is not a ghost,
 * it is a weak backbeat. So a ghost snaps to the nearest ODD step of the
 * template's grid instead, which is that grid's own off-subdivision — the
 * off-eighth on an eighth-note feel, the off-sixteenth on a sixteenth-note one.
 * On a sixteenth grid the two agree exactly.
 */
function ghostSteps(steps: number[], subdivision: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const source of [...steps].sort((a, b) => a - b)) {
    const scaled = (source * subdivision) / PATTERN_RESOLUTION
    const odd = 2 * Math.round((scaled - 1) / 2) + 1
    const step = Math.min(subdivision - 1, Math.max(1, odd))
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

/** Fold a chord tone into the comp's fixed register window, on its own. */
function inCompRegister(midi: number): number {
  let folded = midi
  while (folded >= COMP_REGISTER_CEILING) folded -= 12
  while (folded < COMP_REGISTER_LOW) folded += 12
  return folded
}

/**
 * Every octave of a pitch class that fits inside the comp's window.
 *
 * Counted up from the window's floor, not from `inCompRegister`'s answer: that
 * one folds DOWN only when a tone is above the ceiling, so it can hand back the
 * upper of two legal octaves and hide the lower one — which is the octave a
 * voicing usually wants.
 */
function compOctaves(midi: number): number[] {
  const octaves: number[] = []
  const lowest = COMP_REGISTER_LOW + (((midi - COMP_REGISTER_LOW) % 12) + 12) % 12
  for (let candidate = lowest; candidate < COMP_REGISTER_CEILING; candidate += 12) {
    octaves.push(candidate)
  }
  return octaves
}

/**
 * Total semitone motion between two voicings, each voice to the one nearest it
 * in register: the lowest to the lowest, and so on up.
 *
 * Pairing two ascending sequences by index is the cheapest bijection between
 * them, so this is the motion a listener actually hears — not an artefact of
 * which order the tones were written in.
 */
function voicingMotion(from: number[], to: number[]): number {
  let total = 0
  for (let i = 0; i < Math.min(from.length, to.length); i += 1) {
    total += Math.abs(from[i] - to[i])
  }
  return total
}

/**
 * The comp's voicing for a chord, led from the one before it.
 *
 * `inCompRegister` folds every tone on its own, which is what made the comp
 * lurch: two chords a fourth apart come out in unrelated inversions, and the
 * whole hand jumps an octave to play a chord whose nearest voicing is two
 * semitones away. Leading is the fix, and after the note-offs it is the most
 * audible thing in this epic (R3).
 *
 * Every tone can sit at one of two octaves inside a 21-semitone window, so the
 * whole space of voicings for a seventh chord is sixteen of them. This walks
 * all of them and keeps the one that moves least from the previous voicing,
 * measured ascending voice by ascending voice. Choosing each tone's octave on
 * its own — the obvious reading — is not the same thing and is not always
 * better than folding independently: the tones re-sort once they are placed, so
 * a choice that looks nearest per tone can be worse as a chord. Searching is
 * what makes AC4's "no greater than the independent fold" true rather than
 * likely, since the independent fold is one of the sixteen.
 *
 * `previous` of `null` (or empty) is bar one: there is nothing to lead from, so
 * it is the independent fold, which is what keeps `music.chord` naming bar
 * one's pitches exactly.
 */
export function voiceLead(previous: number[] | null, chordMidi: number[]): number[] {
  const tones = [...chordMidi].sort((a, b) => a - b)
  const independent = tones.map(inCompRegister).sort((a, b) => a - b)
  if (!previous || previous.length === 0) return independent

  const anchors = [...previous].sort((a, b) => a - b)
  let best = independent
  let least = voicingMotion(anchors, independent)

  for (const voicing of octaveChoices(tones)) {
    const sorted = [...voicing].sort((a, b) => a - b)
    const moved = voicingMotion(anchors, sorted)
    // Strictly less, so a tie leaves the independent fold in place and the
    // answer is a function of the pitches rather than of the search order.
    if (moved < least) {
      least = moved
      best = sorted
    }
  }
  return best
}

/** Every way of placing each tone at one of its octaves inside the window. */
function octaveChoices(tones: number[]): number[][] {
  let voicings: number[][] = [[]]
  for (const tone of tones) {
    const next: number[][] = []
    for (const voicing of voicings) {
      for (const octave of compOctaves(tone)) next.push([...voicing, octave])
    }
    voicings = next
  }
  return voicings
}

/**
 * The notes the comp actually strikes: the voicing, minus its root when the
 * bass is already sounding it and the chord has four pitch classes (R6).
 *
 * Two instruments playing the same root an octave or two apart is the doubling
 * that makes a generated arrangement sound stacked rather than voiced, and a
 * seventh chord loses nothing by dropping it — the third and the seventh are
 * what name the chord. A triad keeps its root: a triad minus its root is two
 * notes, which is thinner than the fault being fixed.
 *
 * The chord the manifest names is untouched either way. This changes which
 * notes are struck, not which chord they spell.
 */
export function playedVoicing(
  voicing: number[],
  chordMidi: number[],
  bassMidi: number[],
): number[] {
  const tones = new Set(chordMidi.map(pitchClass))
  if (tones.size < 4) return voicing
  const root = pitchClass(chordMidi[0])
  if (!bassMidi.some((midi) => pitchClass(midi) === root)) return voicing
  return voicing.filter((midi) => pitchClass(midi) !== root)
}

function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
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
  // The two streams of R6. The draw order inside the music stream is frozen;
  // see MUSIC_LABEL.
  const musicRng = rngFor(`${spec.template}:${spec.seed}:${MUSIC_LABEL}`)
  const rhythmRng = rngFor(`${spec.template}:${spec.seed}:${RHYTHM_LABEL}`)

  const bpm = intBetween(musicRng, template.tempoRange[0], template.tempoRange[1])
  const root = pick(musicRng, ROOTS)
  const flavour = pick(musicRng, template.flavours)
  const harmony = buildHarmony(root, flavour, musicRng)

  // Every rhythm is written on the sixteenth grid and resolved onto the
  // template's own, so an eighth-note template plays the same vocabulary at its
  // own resolution rather than needing a second set of patterns.
  const grid = (steps: number[]) => gridSteps(steps, template.subdivision)
  const placement = placementFor(template.id)

  const kickSteps = grid(pick(rhythmRng, KICK_PATTERNS))
  const hatSteps = grid(pick(rhythmRng, HAT_PATTERNS))
  const bassSteps = grid(pick(rhythmRng, BASS_PATTERNS))
  const compSteps = grid(pick(rhythmRng, COMP_PATTERNS))
  const snareSteps = grid(placement.snare)
  const hatOpenSteps = grid(placement.hatOpen)
  const rimSteps = grid(placement.rim)

  /**
   * The ghosts get their own stream, and they are drawn per *bar*.
   *
   * Everything else about the figure is drawn once and repeated: the kick, the
   * hats, the bass and the comp are what makes a groove that groove, and a
   * listener must recognise pass three as the same music as pass one. Ghost
   * strokes are not that. They are the quiet strokes a drummer fills the space
   * between backbeats with, and no drummer fills it the same way twice — so a
   * fresh pattern is drawn for every bar of the loop, out of the same small
   * vocabulary so it stays in character.
   *
   * The stream is separate from `rhythmRng` because it is drawn a different
   * number of times per groove: sixteen bars take sixteen draws where eight
   * take eight, and sharing a stream would make the pass count shift every
   * choice made after it.
   */
  const ghostRng = rngFor(`${spec.template}:${spec.seed}:${GHOST_LABEL}`)
  const ghostsForBar = () =>
    ghostSteps(pick(ghostRng, SNARE_GHOST_PATTERNS), template.subdivision).filter(
      (step) => !snareSteps.includes(step),
    )
  const ghostVelocity =
    GHOST_VELOCITY_RANGE[0] +
    (GHOST_VELOCITY_RANGE[1] - GHOST_VELOCITY_RANGE[0]) * rhythmRng()

  /**
   * The accent multiplier for each hat step of the bar, by that step's position
   * in the hat sequence rather than by its metric class (R11). Closed and open
   * hats share one cycle, because a listener hears one hand.
   */
  const hatAccents = new Map<number, number>()
  const hatLine = [...new Set([...hatSteps, ...hatOpenSteps])].sort((a, b) => a - b)
  hatLine.forEach((step, index) => {
    hatAccents.set(step, HAT_ACCENTS[index % HAT_ACCENTS.length])
  })

  /**
   * How hard a hit lands: the metric accent, with the hats' accent cycle on top
   * of it. Every other voice reads from metric position alone (R12).
   */
  const accentedVelocity = (voice: VoiceName, step: number, sixteenth: number) => {
    const base = velocityFor(voice, sixteenth)
    if (voice !== 'hatClosed' && voice !== 'hatOpen') return base
    return clampVelocity(base * (hatAccents.get(step) ?? 1))
  }

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
    velocity?: number,
    /** Seconds past the step, for a note struck a hair after the ones beside it. */
    offsetSec = 0,
  ) => {
    const event: NoteEvent = {
      voice,
      timeSec: (bar * template.subdivision + step) * stepSec + offsetSec,
      durationSec: sixteenths * sixteenthSec,
      // Read the accent from where the hit lands in the bar, not from which
      // step of the template's grid it is: on an eighth grid, step 1 is the
      // second eighth, which is an off-eighth and not an off-sixteenth. A
      // caller may state a velocity instead — the ghosts do, because their
      // level says what they are rather than where they are.
      velocity:
        velocity ??
        accentedVelocity(voice, step, (step * PATTERN_RESOLUTION) / template.subdivision),
    }
    if (midi !== undefined) event.midi = midi
    events.push(event)
  }

  /** The chord a bar of the four-bar figure carries. */
  const chordFor = (barInPass: number) =>
    harmony.progressionMidi[barInPass % harmony.progressionMidi.length]

  /**
   * The root the bar line after `barInPass` lands on, or null when the chord
   * does not change there.
   *
   * This is the same arithmetic `theory/pitches.ts` uses to decide whether an
   * approach note is admissible, and it has to stay the same: the harmony
   * repeats every `BARS_PER_PASS` bars, so with a three-chord progression bar
   * four carries bar one's chord and the loop boundary is NOT a change. "The
   * last bar gets an approach note" is wrong, and the gate rejects the note it
   * would write (R8a).
   */
  const nextRootAt = (barInPass: number): number | null => {
    const chords = harmony.progressionMidi
    const here = barInPass % chords.length
    const next = ((barInPass + 1) % BARS_PER_PASS) % chords.length
    return next === here ? null : chords[next][0]
  }

  /** How wide the comp rolls a chord, drawn once for the whole groove (R4). */
  const compSpreadSec =
    COMP_SPREAD_RANGE[0] + (COMP_SPREAD_RANGE[1] - COMP_SPREAD_RANGE[0]) * rhythmRng()

  type BassNote = { step: number; midi: number }

  /**
   * The bass line of the four-bar figure, written once and played in every pass.
   *
   * Written once because a groove is several passes of one figure: a line drawn
   * afresh per bar of the loop would make pass three different music from pass
   * one, which is exactly what AC3 forbids. Drawing it per bar of the FIGURE
   * also fixes the number of values taken from the rhythm stream, so a
   * template's pass count cannot move any later draw.
   *
   * Every bar opens on its root in the base octave — no rest, no repeat, no
   * drop. That downbeat is what the comp's rootless voicing leans on (R6) and
   * what the previous bar's approach note resolves onto (R8).
   */
  const bassFigure: BassNote[][] = []
  /** Which bars of the figure carry an approach note, on their closing step. */
  const approaches = new Set<number>()
  let previousBass: number | null = null
  for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
    const chord = chordFor(barInPass)
    const notes: BassNote[] = []

    bassSteps.forEach((step, i) => {
      // Three draws per note whatever the note turns out to be, so which shape
      // the line takes never changes how much of the stream it consumes.
      const rest = rhythmRng()
      const repeat = rhythmRng()
      const drop = rhythmRng()

      if (i === 0) {
        const root = inRegister(chord[0], BASS_BASE_MIDI)
        previousBass = root
        notes.push({ step, midi: root })
        return
      }
      if (rest < BASS_REST_CHANCE) return

      let midi: number
      if (repeat < BASS_REPEAT_CHANCE && previousBass !== null) {
        // The same pitch again — the thing an arpeggiator never does.
        midi = previousBass
      } else {
        midi = inRegister(chord[i % chord.length], BASS_BASE_MIDI)
        if (drop < BASS_OCTAVE_CHANCE) midi -= BASS_OCTAVE_DROP
      }
      previousBass = midi
      notes.push({ step, midi })
    })

    // The approach note: on the bar's closing step — the last off-beat
    // subdivision of an eighth or a sixteenth grid alike — a semitone above or
    // below the root the next bar lands on, resolving into it (R8). It replaces
    // whatever the line had written there rather than sounding beside it.
    const nextRoot = nextRootAt(barInPass)
    const direction = rhythmRng()
    if (nextRoot === null) {
      bassFigure.push(notes)
      continue
    }
    const target = inRegister(nextRoot, BASS_BASE_MIDI)
    const approachStep = template.subdivision - 1
    const approach = direction < 0.5 ? target - 1 : target + 1
    previousBass = approach
    approaches.add(bassFigure.length)
    bassFigure.push(
      [...notes.filter((note) => note.step !== approachStep), { step: approachStep, midi: approach }]
        .sort((a, b) => a.step - b.step),
    )
  }

  /**
   * The three things a line has that an arpeggiator does not — a rest, a
   * repeated note and a note in the low octave — made certain rather than left
   * to the draw.
   *
   * The chances above give all three on average, and only on average: a figure
   * is eight or twelve drawn notes long, so a groove whose draws all came up
   * the same way sits in one octave, sounds on every step it has, and never
   * plays a pitch twice. That is the arpeggiator R7 is about, and it would make
   * AC8 a property of the seed rather than of the writer. So the writer states
   * all three, in this order: a rest first, since it removes a note; the octave
   * next, chosen so the line's top note is untouched and the span therefore
   * widens; the repeat last, since it only rewrites a pitch and is checked
   * against what the first two left behind.
   *
   * Approach notes are exempt from all of it. One is already a semitone off its
   * target, an octave below it is under the lowest note the pack samples, and
   * silencing or repeating one would take away the resolution it exists for.
   * Downbeats are exempt from the rest and the repeat, and not from the octave:
   * a root an octave down is still the root, so the comp's rootless voicing and
   * the previous bar's resolution both still hold.
   */
  const isApproach = (bar: number, note: BassNote) =>
    approaches.has(bar) && note.step === template.subdivision - 1

  /** Every note the writer may touch: not a downbeat, not an approach note. */
  const movable = () =>
    bassFigure.flatMap((notes, bar) =>
      notes
        .map((note, index) => ({ bar, index, note }))
        .filter(({ index, note }) => index > 0 && !isApproach(bar, note)),
    )

  /**
   * Whether any bar leaves a step unplayed that the line plays elsewhere.
   *
   * Read off the written figure rather than off the rest draws, and against the
   * other bars rather than against the drawn pattern, because that is what a
   * listener hears. A rest on a bar's closing step is inaudible as a rest when
   * every other bar writes an approach note over that step — nothing is missing
   * from the figure, the position simply belongs to the approach note.
   */
  const soundedIn = (bar: number) => bassFigure[bar].filter((note) => !isApproach(bar, note))
  const restsSomewhere = () => {
    const steps = new Set(
      bassFigure.flatMap((_, bar) => soundedIn(bar).map((note) => note.step)),
    )
    return bassFigure.some((_, bar) => soundedIn(bar).length < steps.size)
  }

  if (!restsSomewhere()) {
    const candidates = movable()
    // Silenced by preference: a note whose step the line still plays in another
    // bar, so the rest reads as a hole in the pattern rather than as a step the
    // groove simply never uses.
    const heard = candidates.filter(({ bar, note }) =>
      bassFigure.some(
        (other, otherBar) =>
          otherBar !== bar && other.some((n) => n.step === note.step && !isApproach(otherBar, n)),
      ),
    )
    const silenced = (heard.length > 0 ? heard : candidates).at(-1)
    if (silenced) {
      bassFigure[silenced.bar] = bassFigure[silenced.bar].filter((n) => n !== silenced.note)
    }
  }

  const pitches = () => bassFigure.flat().map((note) => note.midi)
  const top = Math.max(...pitches())
  // Under the top note, so dropping it can only widen the line's span.
  const droppable = bassFigure
    .flatMap((notes, bar) => notes.filter((note) => !isApproach(bar, note)))
    .filter((note) => note.midi >= BASS_BASE_MIDI && note.midi < top)
  if (droppable.length > 0) {
    droppable.reduce((low, note) => (note.midi < low.midi ? note : low)).midi -= BASS_OCTAVE_DROP
  }

  const repeatsSomewhere = () => {
    const line = pitches()
    return line.some((midi, i) => i > 0 && midi === line[i - 1])
  }
  if (!repeatsSomewhere()) {
    for (const candidate of movable().reverse()) {
      // Its predecessor inside the same bar, so a repeated pitch is still a
      // tone of the chord that bar is playing.
      const before = bassFigure[candidate.bar][candidate.index - 1]
      if (!before) continue
      const was = candidate.note.midi
      candidate.note.midi = before.midi
      const line = pitches()
      if (repeatsSomewhere() && Math.max(...line) - Math.min(...line) > 12) break
      candidate.note.midi = was
    }
  }

  /**
   * The comp's voicing for each bar of the figure, led from the bar before it
   * and written once for the same reason the bass line is.
   */
  const compFigure: number[][] = []
  let previousVoicing: number[] | null = null
  for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
    const chord = chordFor(barInPass)
    const voicing = voiceLead(previousVoicing, chord)
    // The next bar leads from the whole voicing, not from what is struck: the
    // root is dropped from the sound, not from where the hand is sitting.
    previousVoicing = voicing
    const bassMidi = plays('bass') ? bassFigure[barInPass].map((note) => note.midi) : []
    compFigure.push(playedVoicing(voicing, chord, bassMidi))
  }

  /**
   * Where each pass begins and ends in `events`. The feel stages below map over
   * the list one for one and in order, so these indices still address the same
   * pass afterwards — which is what lets every pass be humanized on a generator
   * of its own (R4).
   */
  const passRanges: { start: number; end: number }[] = []

  for (let pass = 0; pass < template.passes; pass++) {
    const start = events.length

    for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
      // The figure stays four bars long however many passes are rendered, so
      // bar 5 carries bar 1's chord (R5) and the progression the manifest names
      // still describes the figure rather than the whole loop.
      const bar = pass * BARS_PER_PASS + barInPass

      // Drums — the same figure every bar, because this epic is not yet played.
      if (plays('kick')) for (const step of kickSteps) add('kick', bar, step, 2)
      if (plays('snare')) {
        for (const step of snareSteps) add('snare', bar, step, 2)
        // The ghosts: short, quiet strokes on the off-subdivisions between the
        // backbeats. They are what makes GHOST_VELOCITY_THRESHOLD mean what it
        // says — before them, only the hats ever fell under it (R10).
        for (const step of ghostsForBar()) add('snare', bar, step, 1, undefined, ghostVelocity)
      }
      if (plays('hatClosed')) {
        const closed = plays('hatOpen')
          ? hatSteps.filter((s) => !hatOpenSteps.includes(s))
          : hatSteps
        for (const step of closed) add('hatClosed', bar, step, 1)
      }
      if (plays('hatOpen')) for (const step of hatOpenSteps) add('hatOpen', bar, step, 2)
      if (plays('rim') && placement.rimBars.includes(barInPass)) {
        for (const step of rimSteps) add('rim', bar, step, 1)
      }

      // Bass — the written line, the same one in every pass.
      if (plays('bass')) {
        for (const note of bassFigure[barInPass]) add('bass', bar, note.step, 2, note.midi)
      }

      // Comp — the voice-led chord, rolled across a few milliseconds and shaped
      // so the top voice sings over the ones under it (R3, R4, R5).
      if (plays('comp')) {
        const voicing = compFigure[barInPass]
        const spread = voicing.length > 1 ? compSpreadSec / (voicing.length - 1) : 0
        for (const step of compSteps) {
          const sixteenth = (step * PATTERN_RESOLUTION) / template.subdivision
          const base = accentedVelocity('comp', step, sixteenth)
          voicing.forEach((midi, index) => {
            const below = voicing.length - 1 - index
            add(
              'comp',
              bar,
              step,
              4,
              midi,
              clampVelocity(base * (1 - COMP_VOICE_DROP * below)),
              index * spread,
            )
          })
        }
      }
    }

    passRanges.push({ start, end: events.length })
  }

  // The feel stages, in order: the accents are already in place above, so the
  // grid is swung, then every note is nudged, and then the loop is pinned back
  // to exactly the length that was rendered. The generators are labelled from
  // { template, seed } like every other draw here, so a groove's feel travels
  // with its identity rather than with its name.
  //
  // Swing is a property of the figure, so it is applied once over the whole
  // loop. The nudge is a property of the performance, so every pass draws its
  // own from its own generator: that is what makes pass two a different take of
  // the same music rather than the same bytes again (R4).
  const barsSec = barSec * BARS_PER_PASS * template.passes
  const swung = applySwing(events, template.swing, template.subdivision, bpm)
  const nudged = passRanges.flatMap(({ start, end }, pass) =>
    humanize(
      swung.slice(start, end),
      template,
      rngFor(`${spec.template}:${spec.seed}:humanize:${pass}`),
      bpm,
    ),
  )
  // Drift last of the three, and before the loop is pinned: the tempo breathes
  // within each pass and resolves exactly at its boundary, so it displaces
  // every voice together — a section pushing and relaxing, not one player
  // wandering — and leaves `fitToLoop` nothing to correct at the seam (R13).
  const breathed = applyDrift(nudged, template.humanize.driftDepth, barSec * BARS_PER_PASS)
  const shaped = fitToLoop(breathed, barsSec)

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
    bars: BARS_PER_PASS,
    loopBars: BARS_PER_PASS * template.passes,
    root,
    flavour,
    scale: scaleName(root, flavour),
    chord: harmony.chordName,
    progression: harmony.progressionName,
  }

  return { events: shaped, music, harmony }
}
