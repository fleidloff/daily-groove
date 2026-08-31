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

  // The ghosts (R10), drawn after the four pattern draws above so that adding
  // them left every one of those choices where it was. The rhythm stream is
  // free to grow; the music stream is not.
  const snareGhostSteps = ghostSteps(
    pick(rhythmRng, SNARE_GHOST_PATTERNS),
    template.subdivision,
  ).filter((step) => !snareSteps.includes(step))
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
  ) => {
    const event: NoteEvent = {
      voice,
      timeSec: (bar * template.subdivision + step) * stepSec,
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
      const chord =
        harmony.progressionMidi[barInPass % harmony.progressionMidi.length]

      // Drums — the same figure every bar, because this epic is not yet played.
      if (plays('kick')) for (const step of kickSteps) add('kick', bar, step, 2)
      if (plays('snare')) {
        for (const step of snareSteps) add('snare', bar, step, 2)
        // The ghosts: short, quiet strokes on the off-subdivisions between the
        // backbeats. They are what makes GHOST_VELOCITY_THRESHOLD mean what it
        // says — before them, only the hats ever fell under it (R10).
        for (const step of snareGhostSteps) add('snare', bar, step, 1, undefined, ghostVelocity)
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
