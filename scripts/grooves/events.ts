import type {
  FeelTemplate,
  GrooveSpec,
  MusicMeta,
  NoteEvent,
  Subdivision,
  VoiceName,
} from './types.ts'
import { assertFigures, assertPatterns } from './patterns.ts'
import { intBetween, pick, rngFor } from './rng.ts'
import { applyDrift, applySwing, fitToLoop, humanize } from './humanize.ts'
import { ROOTS } from '../../src/lib/theory/roots.ts'
import { buildHarmony } from './theory/harmony.ts'
import type { Harmony } from './theory/harmony.ts'
import { scaleName } from '../../src/lib/theory/scales.ts'

const BEATS_PER_BAR = 4

export const BARS_PER_PASS = 4

// FROZEN. The committed answers derive from this exact string and draw
// order, so a change re-keys the whole catalogue.
export const MUSIC_LABEL = 'events'

// One stream per concern, so an added draw on one side cannot shift the
// draws on another and re-key the catalogue.
export const RHYTHM_LABEL = 'rhythm'

export const GHOST_LABEL = 'ghosts'

export const BONGO_LABEL = 'bongo'

export const RIDE_LABEL = 'ride'

// The kit figure is a per-template snare line, so it takes its own stream:
// nothing may be inserted into an existing one.
export const KIT_LABEL = 'kit'

const BASS_BASE_MIDI = 24

const BASS_OCTAVE_LIFT = 12

const BASS_CEILING_MIDI = 48

const BASS_FLOOR_MIDI = 25

const BASS_REST_CHANCE = 0.18
const BASS_REPEAT_CHANCE = 0.4
const BASS_OCTAVE_CHANCE = 0.32

const COMP_SPREAD_RANGE: [number, number] = [0.005, 0.015]

const COMP_VOICE_DROP = 0.12

export const BACKING_VOICES: VoiceName[] = [
  'kick',
  'snare',
  'hatClosed',
  'hatOpen',
  'ride',
  'rim',
  'tomHigh',
  'tomLow',
  'bass',
  'comp',
]

export const COMP_REGISTER_LOW = 55
export const COMP_REGISTER_CEILING = 76

export const GHOST_VELOCITY_THRESHOLD = 0.5

const GHOST_VELOCITY_RANGE: [number, number] = [0.15, 0.25]

const MIN_VELOCITY = 0.05

export const VELOCITIES: Record<VoiceName, { strong: number; medium: number; weak: number }> = {
  kick: { strong: 0.98, medium: 0.86, weak: 0.74 },
  snare: { strong: 1, medium: 0.7, weak: 0.45 },
  hatClosed: { strong: 0.75, medium: 0.45, weak: 0.32 },
  hatOpen: { strong: 0.75, medium: 0.68, weak: 0.6 },
  ride: { strong: 0.78, medium: 0.62, weak: 0.55 },
  rideBell: { strong: 0.8, medium: 0.66, weak: 0.55 },
  claves: { strong: 0.7, medium: 0.6, weak: 0.5 },
  cowbell: { strong: 0.74, medium: 0.62, weak: 0.52 },
  rim: { strong: 0.55, medium: 0.5, weak: 0.42 },
  tomHigh: { strong: 0.92, medium: 0.8, weak: 0.68 },
  tomLow: { strong: 0.95, medium: 0.83, weak: 0.71 },
  bongoHigh: { strong: 0.66, medium: 0.56, weak: 0.46 },
  bongoLow: { strong: 0.7, medium: 0.6, weak: 0.5 },
  bass: { strong: 0.92, medium: 0.8, weak: 0.68 },
  comp: { strong: 0.72, medium: 0.62, weak: 0.52 },
}

function velocityFor(voice: VoiceName, step: number): number {
  const shape = VELOCITIES[voice]
  if (step % 4 === 0) return shape.strong
  if (step % 2 === 0) return shape.medium
  return shape.weak
}

export const HAT_ACCENTS = [1, 0.72, 0.88, 0.66]

// Three, so the cycle is coprime with the four-beat bar and never locks to
// it, and shallow, because a wavering pulse reads worse than a flat one.
export const RIDE_ACCENTS = [1, 0.9, 0.95]

export const RIDE_SUSTAIN_SIXTEENTHS = 8

const COMP_ACCENTS = [1.12, 1, 0.88, 1.12, 0.88]

function clampVelocity(velocity: number): number {
  return Math.min(1, Math.max(MIN_VELOCITY, velocity))
}

export const PATTERN_RESOLUTION = 16

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

// A riding feel's hat is the left foot under the ride, so every figure holds
// beats 2 and 4; the second picks up the "and" of 4 that hatOpen vacated.
export const HAT_PUNCTUATION_PATTERNS: number[][] = [
  [4, 12],
  [4, 12, 14],
  [0, 4, 8, 12],
]

// On a riding feel the ride is the pulse, so every figure keeps every quarter
// and outnumbers the busiest foot hat.
export const RIDE_PATTERNS: Partial<Record<Subdivision, number[][]>> = {
  8: [
    [0, 2, 4, 6, 8, 10, 12, 14],
    [0, 4, 6, 8, 12, 14],
    [0, 4, 6, 8, 12],
  ],
  // At swing 0.44 applySwing delays the odd sixteenths, so a step on 3, 7, 11
  // or 15 is the "a" of its beat — a late flick, not the shuffle's triplet ping.
  //
  // Signed off 2026-09-05: Fred heard six renders of groove-40 and said "5 sounds
  // best, go with the proposal" — cell 5, the 6-hit member below. A listening pass,
  // not a measurement. The 8-hit member it replaces was heard first and rejected
  // ("in groove 40, the ride is too loud. It get's a bit too much"). The members
  // differ by where the flick lands rather than by how many there are, because this
  // feel's bar is 25-35 % shorter than the shuffle's and the count that matters is
  // per second, not per bar.
  16: [
    [0, 3, 4, 8, 11, 12],
    [0, 4, 7, 8, 12, 15],
    [0, 4, 8, 12, 15],
  ],
}

export const QUARTER_STEPS_16 = [0, 4, 8, 12]

// The loudest round value whose humanized ceiling (0.21 + 0.13) still sits
// inside the softest recorded kick layer, whose maxVelocity is 0.3465.
export const FEATHER_VELOCITY = 0.21

export function featherSteps(
  sounding: number[],
  subdivision: FeelTemplate['subdivision'],
): number[] {
  return gridSteps(QUARTER_STEPS_16, subdivision).filter((step) => !sounding.includes(step))
}

const BASS_PATTERNS: number[][] = [
  [0, 6, 10],
  [0, 3, 10],
  [0, 6, 10, 14],
  [0, 8, 14],
]

const SNARE_GHOST_PATTERNS: number[][] = [
  [3, 11],
  [7, 15],
  [11, 15],
  [3, 7, 11],
  [3, 11, 15],
]

const BONGO_PATTERNS: { high: number[]; low: number[] }[] = [
  { high: [3, 11], low: [6] },
  { high: [7, 15], low: [2, 10] },
  { high: [3, 7, 13], low: [10] },
  { high: [11], low: [3, 14] },
]

const BONGO_ACCENTS = [1, 0.82, 0.94, 0.74]

const COMP_PATTERNS: number[][] = [
  [2, 10],
  [2, 6, 10],
  [0, 10],
  [2, 11],
]

type Placement = {
  snare: number[]
  hatOpen: number[]
  rim: number[]
  rimBars: number[]
}

export const DEFAULT_PLACEMENT: Placement = {
  snare: [4, 12],
  hatOpen: [14],
  rim: [15],
  rimBars: [1, 3],
}

export const PLACEMENTS: Record<string, Partial<Placement>> = {
  'half-time': { snare: [8] },
  'bright-straight': { rim: [14], rimBars: [3] },
  // No snare key: patterns.kit owns this feel's snare line, and declaring both throws.
  // The cross-stick clicks on the "e" of 4 — the one sixteenth every kit figure and
  // every tom accent leaves empty — and it clicks in all four bars, so a pass whose
  // last bar is a fill still has it three times.
  'second-line': { hatOpen: [14], rim: [13], rimBars: [0, 1, 2, 3] },
}

function placementFor(templateId: string): Placement {
  return { ...DEFAULT_PLACEMENT, ...(PLACEMENTS[templateId] ?? {}) }
}

export type FillPhrase = Partial<Record<VoiceName, number[]>>

export const DEFAULT_FILL: FillPhrase = {
  kick: [0],
  snare: [0, 2, 4, 6, 14],
  tomHigh: [8, 10],
  tomLow: [12],
}

export const FILLS: Record<string, { fill: FillPhrase; variation?: FillPhrase }> = {
  'half-time': { fill: { snare: [8, 12], tomHigh: [10], tomLow: [14] } },
  shuffle: {
    fill: { kick: [0], snare: [0, 4, 14], tomHigh: [6, 8], tomLow: [10, 12] },
  },
  // A bossa has no drum fill: the hat and the clave never stop, and the turnaround is
  // a snare push rather than a roll. Both phrases are declared because the feel carries
  // no toms, which would make the default `withoutToms` variation identical to its fill.
  'bossa-nova': {
    fill: { kick: [0, 8], snare: [4, 10, 12, 14], hatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
    variation: { kick: [0, 8], snare: [4, 12, 14], hatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  // The fill is the style, not a punctuation on it: a bar-long snare figure with the
  // toms answering it into beat 4, and no crash to arrive at, because the kit has
  // none. The kick keeps step 0 — the downbeat after this bar is position zero of the
  // file — and adds beat 4 under the low tom. The hat holds quarters so the roll has a
  // floor; the open hat and the rim stand down, which is what makes the bar read as an
  // event.
  //
  // The variation is the same groove with its tom answer taken away and its snare
  // thinned to the four struck steps. It is declared rather than left to
  // withoutToms(fill) because this feel's ordinary bars already carry toms, so the
  // thinning has to be visible against them rather than against the fill.
  // The fill's low tom keeps the big four and pushes past it into the downbeat: in an
  // ordinary bar the low tom *is* beat 4, so a fill that lands there and stops repeats
  // the groove instead of answering it. The variation keeps the turnaround click — a
  // thinning takes the answer out, not the timekeeping — and the fill still drops it,
  // because the roll wants that sixteenth. Both are what make the middle bar read as
  // less than the drawn figure and the last bar as more; measured over 400 seeds the
  // middle bar is nearer an ordinary bar than the fill is at every one of the 48
  // combinations the three pools can draw.
  'second-line': {
    fill: {
      kick: [0, 12],
      snare: [0, 1, 2, 4, 5, 6, 8, 14],
      tomHigh: [10, 11],
      tomLow: [12, 14],
      hatClosed: [0, 4, 8, 12],
    },
    variation: {
      kick: [0, 6, 12],
      snare: [0, 6, 10, 14],
      hatClosed: [0, 4, 8, 12],
      hatOpen: [14],
      rim: [13],
    },
  },
}

const TOM_VOICES: VoiceName[] = ['tomHigh', 'tomLow']

export const FILL_DURATIONS: Record<VoiceName, number> = {
  kick: 2,
  snare: 2,
  hatClosed: 1,
  hatOpen: 2,
  ride: 8,
  rideBell: 8,
  claves: 1,
  cowbell: 1,
  rim: 1,
  tomHigh: 2,
  tomLow: 2,
  bongoHigh: 1,
  bongoLow: 1,
  bass: 2,
  comp: 4,
}

function withoutToms(phrase: FillPhrase): FillPhrase {
  const thinned: FillPhrase = {}
  for (const [voice, steps] of Object.entries(phrase) as [VoiceName, number[]][]) {
    if (TOM_VOICES.includes(voice)) continue
    thinned[voice] = steps
  }
  return thinned
}

export function middlePassOf(passes: number): number | null {
  if (passes < 3) return null
  return Math.floor((passes - 1) / 2)
}

function scaleStep(step: number, subdivision: number): number {
  return Math.min(subdivision - 1, Math.round((step * subdivision) / PATTERN_RESOLUTION))
}

export function gridSteps(steps: number[], subdivision: number): number[] {
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

function inRegister(midi: number, base: number, floor: number): number {
  const placed = base + (((midi % 12) + 12) % 12)
  return placed < floor ? placed + 12 : placed
}

function inCompRegister(midi: number): number {
  let folded = midi
  while (folded >= COMP_REGISTER_CEILING) folded -= 12
  while (folded < COMP_REGISTER_LOW) folded += 12
  return folded
}

function compOctaves(midi: number): number[] {
  const octaves: number[] = []
  const lowest = COMP_REGISTER_LOW + (((midi - COMP_REGISTER_LOW) % 12) + 12) % 12
  for (let candidate = lowest; candidate < COMP_REGISTER_CEILING; candidate += 12) {
    octaves.push(candidate)
  }
  return octaves
}

function voicingMotion(from: number[], to: number[]): number {
  let total = 0
  for (let i = 0; i < Math.min(from.length, to.length); i += 1) {
    total += Math.abs(from[i] - to[i])
  }
  return total
}

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
    if (moved < least) {
      least = moved
      best = sorted
    }
  }
  return best
}

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

// Test-only. The bass register's three floor-dependent decision sites, reported
// so a test can compare the decisions across two floors instead of guessing them
// back out of final pitches — which cannot be done, because the pop and the lift
// both leave a note at 37-39 whatever the floor was.
// scripts/grooves/bassFloor.test.ts is the only consumer.
export type BassDecisions = {
  pops: {
    bar: number
    index: number
    step: number
    folded: number
    wants: boolean
    can: boolean
    final: number
  }[]
  approaches: {
    bar: number
    target: number
    wantsBelow: boolean
    belowOk: boolean
    approach: number
  }[]
  lifts: { bottom: number; bar: number; step: number; from: number; to: number }[]
}

// Test-only, and nothing on the normal path passes one: every production caller
// of buildEvents takes two arguments, so the floor is BASS_FLOOR_MIDI and no
// decisions are collected.
export type BuildEventsOptions = {
  bassFloorMidi?: number
  decisions?: BassDecisions
}

export function buildEvents(
  spec: GrooveSpec,
  template: FeelTemplate,
  options: BuildEventsOptions = {},
): { events: NoteEvent[]; music: MusicMeta; harmony: Harmony } {
  const bassFloor = options.bassFloorMidi ?? BASS_FLOOR_MIDI
  const decisions = options.decisions
  if (template.patterns) assertPatterns(template, PLACEMENTS)
  if (template.figures) assertFigures(template)

  const musicRng = rngFor(`${spec.template}:${spec.seed}:${MUSIC_LABEL}`)
  const rhythmRng = rngFor(`${spec.template}:${spec.seed}:${RHYTHM_LABEL}`)

  const bpm = intBetween(musicRng, template.tempoRange[0], template.tempoRange[1])
  const root = pick(musicRng, ROOTS)
  const flavour = pick(musicRng, template.flavours)
  const harmony = buildHarmony(root, flavour, musicRng)

  const grid = (steps: number[]) => gridSteps(steps, template.subdivision)
  const placement = placementFor(template.id)

  const plays = (voice: VoiceName) => template.voices.includes(voice)
  const rides = plays('ride')

  const pools = template.patterns

  const kickSteps = grid(pick(rhythmRng, pools?.kick ?? KICK_PATTERNS))
  const hatSteps = grid(
    pick(rhythmRng, pools?.hatClosed ?? (rides ? HAT_PUNCTUATION_PATTERNS : HAT_PATTERNS)),
  )
  const bassSteps = grid(pick(rhythmRng, pools?.bass ?? BASS_PATTERNS))
  const compSteps = grid(pick(rhythmRng, pools?.comp ?? COMP_PATTERNS))

  const ridePool = (pools?.ride ?? RIDE_PATTERNS)[template.subdivision]
  if (rides && !ridePool) {
    throw new Error(
      `${template.id}: no ride pattern pool for subdivision ${template.subdivision}`,
    )
  }
  const rideSteps =
    rides && ridePool
      ? grid(pick(rngFor(`${spec.template}:${spec.seed}:${RIDE_LABEL}`), ridePool))
      : []
  const quarterSteps = Array.from(
    { length: template.subdivision },
    (_, step) => step,
  ).filter((step) => step % (template.subdivision / BEATS_PER_BAR) === 0)

  const rideAccents = new Map<number, number>()
  rideSteps.forEach((step, index) => {
    rideAccents.set(step, RIDE_ACCENTS[index % RIDE_ACCENTS.length])
  })

  const playsBongo = template.voices.includes('bongoHigh')
  const bongoFigure = playsBongo
    ? pick(rngFor(`${spec.template}:${spec.seed}:${BONGO_LABEL}`), pools?.bongos ?? BONGO_PATTERNS)
    : { high: [], low: [] }
  const bongoHighSteps = grid(bongoFigure.high)
  const bongoLowSteps = grid(bongoFigure.low)

  const bongoAccents = new Map<number, number>()
  const bongoLine = [...new Set([...bongoHighSteps, ...bongoLowSteps])].sort((a, b) => a - b)
  bongoLine.forEach((step, index) => {
    bongoAccents.set(step, BONGO_ACCENTS[index % BONGO_ACCENTS.length])
  })
  const kitFigure = pools?.kit
    ? pick(rngFor(`${spec.template}:${spec.seed}:${KIT_LABEL}`), pools.kit)
    : null
  const snareSteps = grid(kitFigure ? kitFigure.snare : placement.snare)
  const kitTomHighSteps = grid(kitFigure?.tomHigh ?? [])
  const kitTomLowSteps = grid(kitFigure?.tomLow ?? [])

  const figureVoices = new Set(template.figures?.map((figure) => figure.voice) ?? [])
  const hatOpenSteps = figureVoices.has('hatOpen') ? [] : grid(placement.hatOpen)
  const rimSteps = figureVoices.has('rim') ? [] : grid(placement.rim)

  const ghostRng = rngFor(`${spec.template}:${spec.seed}:${GHOST_LABEL}`)
  const ghostsForBar = () =>
    ghostSteps(pick(ghostRng, pools?.snareGhosts ?? SNARE_GHOST_PATTERNS), template.subdivision).filter(
      (step) => !snareSteps.includes(step),
    )
  const ghostVelocity =
    GHOST_VELOCITY_RANGE[0] +
    (GHOST_VELOCITY_RANGE[1] - GHOST_VELOCITY_RANGE[0]) * rhythmRng()

  const hatAccents = new Map<number, number>()
  const hatLine = [
    ...new Set([...hatSteps, ...(plays('hatOpen') ? hatOpenSteps : [])]),
  ].sort((a, b) => a - b)
  hatLine.forEach((step, index) => {
    hatAccents.set(step, HAT_ACCENTS[index % HAT_ACCENTS.length])
  })

  const compIndex = new Map<number, number>()
  compSteps.forEach((step, index) => {
    compIndex.set(step, index)
  })

  const accentedVelocity = (voice: VoiceName, step: number, sixteenth: number, pass = 0) => {
    const base = velocityFor(voice, sixteenth)
    if (voice === 'hatClosed' || voice === 'hatOpen') {
      return clampVelocity(base * (hatAccents.get(step) ?? 1))
    }
    if (voice === 'ride') {
      return clampVelocity(base * (rideAccents.get(step) ?? 1))
    }
    if (voice !== 'comp') return base
    const index = compIndex.get(step)
    if (index === undefined) return base
    return clampVelocity(base * COMP_ACCENTS[(index + pass) % COMP_ACCENTS.length])
  }

  const secPerBeat = 60 / bpm
  const barSec = secPerBeat * BEATS_PER_BAR
  const stepSec = barSec / template.subdivision
  const sixteenthSec = barSec / PATTERN_RESOLUTION

  const events: NoteEvent[] = []

  const add = (
    voice: VoiceName,
    bar: number,
    step: number,
    sixteenths: number,
    midi?: number,
    velocity?: number,
    offsetSec = 0,
  ) => {
    const event: NoteEvent = {
      voice,
      timeSec: (bar * template.subdivision + step) * stepSec + offsetSec,
      durationSec: sixteenths * sixteenthSec,
      velocity:
        velocity ??
        accentedVelocity(voice, step, (step * PATTERN_RESOLUTION) / template.subdivision),
    }
    if (midi !== undefined) event.midi = midi
    events.push(event)
  }

  const chordFor = (barInPass: number) =>
    harmony.progressionMidi[barInPass % harmony.progressionMidi.length]

  const nextRootAt = (barInPass: number): number | null => {
    const here = chordFor(barInPass)[0]
    const next = chordFor((barInPass + 1) % BARS_PER_PASS)[0]
    return next === here ? null : next
  }

  const compSpreadSec =
    COMP_SPREAD_RANGE[0] + (COMP_SPREAD_RANGE[1] - COMP_SPREAD_RANGE[0]) * rhythmRng()

  type BassNote = { step: number; midi: number }

  const bassFigure: BassNote[][] = []
  const approaches = new Set<number>()
  let previousBass: number | null = null
  for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
    const chord = chordFor(barInPass)
    const notes: BassNote[] = []

    bassSteps.forEach((step, i) => {
      const rest = rhythmRng()
      const repeat = rhythmRng()
      const drop = rhythmRng()

      if (i === 0) {
        const root = inRegister(chord[0], BASS_BASE_MIDI, bassFloor)
        previousBass = root
        notes.push({ step, midi: root })
        return
      }
      if (rest < BASS_REST_CHANCE) return

      let midi: number
      if (repeat < BASS_REPEAT_CHANCE && previousBass !== null) {
        midi = previousBass
      } else {
        midi = inRegister(chord[i % chord.length], BASS_BASE_MIDI, bassFloor)
        const folded = midi
        const wants = drop < BASS_OCTAVE_CHANCE
        const can = midi + BASS_OCTAVE_LIFT <= BASS_CEILING_MIDI
        if (wants && can) {
          midi += BASS_OCTAVE_LIFT
        }
        decisions?.pops.push({ bar: barInPass, index: i, step, folded, wants, can, final: midi })
      }
      previousBass = midi
      notes.push({ step, midi })
    })

    const nextRoot = nextRootAt(barInPass)
    const direction = rhythmRng()
    if (nextRoot === null) {
      bassFigure.push(notes)
      continue
    }
    const target = inRegister(nextRoot, BASS_BASE_MIDI, bassFloor)
    const approachStep = template.subdivision - 1
    const wantsBelow = direction < 0.5
    const belowOk = target - 1 >= bassFloor
    const approach = wantsBelow && belowOk ? target - 1 : target + 1
    decisions?.approaches.push({ bar: barInPass, target, wantsBelow, belowOk, approach })
    previousBass = approach
    approaches.add(bassFigure.length)
    bassFigure.push(
      [...notes.filter((note) => note.step !== approachStep), { step: approachStep, midi: approach }]
        .sort((a, b) => a.step - b.step),
    )
  }

  const isApproach = (bar: number, note: BassNote) =>
    approaches.has(bar) && note.step === template.subdivision - 1

  const movable = () =>
    bassFigure.flatMap((notes, bar) =>
      notes
        .map((note, index) => ({ bar, index, note }))
        .filter(({ index, note }) => index > 0 && !isApproach(bar, note)),
    )

  const soundedIn = (bar: number) => bassFigure[bar].filter((note) => !isApproach(bar, note))
  const restsSomewhere = () => {
    const steps = new Set(
      bassFigure.flatMap((_, bar) => soundedIn(bar).map((note) => note.step)),
    )
    return bassFigure.some((_, bar) => soundedIn(bar).length < steps.size)
  }

  if (!restsSomewhere()) {
    const candidates = movable()
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
  const bottom = Math.min(...pitches())
  const liftable = bassFigure
    .flatMap((notes, bar) => notes.filter((note) => !isApproach(bar, note)))
    .filter(
      (note) => note.midi > bottom && note.midi + BASS_OCTAVE_LIFT <= BASS_CEILING_MIDI,
    )
  if (liftable.length > 0) {
    const highest = liftable.reduce((high, note) => (note.midi > high.midi ? note : high))
    const from = highest.midi
    highest.midi += BASS_OCTAVE_LIFT
    decisions?.lifts.push({
      bottom,
      bar: bassFigure.findIndex((notes) => notes.includes(highest)),
      step: highest.step,
      from,
      to: highest.midi,
    })
  }

  const repeatsSomewhere = () => {
    const line = pitches()
    return line.some((midi, i) => i > 0 && midi === line[i - 1])
  }
  if (!repeatsSomewhere()) {
    for (const candidate of movable().reverse()) {
      const before = bassFigure[candidate.bar][candidate.index - 1]
      if (!before) continue
      const was = candidate.note.midi
      candidate.note.midi = before.midi
      const line = pitches()
      if (repeatsSomewhere() && Math.max(...line) - Math.min(...line) > 12) break
      candidate.note.midi = was
    }
  }

  const compFigure: number[][] = []
  let previousVoicing: number[] | null = null
  for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
    const chord = chordFor(barInPass)
    const voicing = voiceLead(previousVoicing, chord)
    previousVoicing = voicing
    const bassMidi = plays('bass') ? bassFigure[barInPass].map((note) => note.midi) : []
    compFigure.push(playedVoicing(voicing, chord, bassMidi))
  }

  const passRanges: { start: number; end: number }[] = []

  const resolvePhrase = (phrase: FillPhrase): [VoiceName, number[]][] =>
    (Object.entries(phrase) as [VoiceName, number[]][])
      .filter(([voice]) => plays(voice))
      .map(([voice, steps]) => [voice, grid(steps)] as [VoiceName, number[]])

  const declared = FILLS[template.id] ?? { fill: DEFAULT_FILL }
  const fillPhrase = resolvePhrase(declared.fill)
  const variationPhrase = resolvePhrase(declared.variation ?? withoutToms(declared.fill))
  const middlePass = middlePassOf(template.passes)

  const barRole = (pass: number, barInPass: number): 'fill' | 'variation' | null => {
    if (barInPass !== BARS_PER_PASS - 1) return null
    if (pass === template.passes - 1) return 'fill'
    if (middlePass !== null && pass === middlePass) return 'variation'
    return null
  }

  const phraseForRole = (role: 'fill' | 'variation') =>
    role === 'fill' ? fillPhrase : variationPhrase

  for (let pass = 0; pass < template.passes; pass++) {
    const start = events.length

    for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
      const bar = pass * BARS_PER_PASS + barInPass

      const ghosts = plays('snare') ? ghostsForBar() : []

      const role = barRole(pass, barInPass)
      if (role) {
        for (const [voice, steps] of phraseForRole(role)) {
          for (const step of steps) add(voice, bar, step, FILL_DURATIONS[voice])
        }
        if (rides) {
          if (plays('hatClosed')) for (const step of hatSteps) add('hatClosed', bar, step, 1)
          if (role === 'variation') {
            for (const step of quarterSteps) add('ride', bar, step, RIDE_SUSTAIN_SIXTEENTHS)
          }
        }
      } else {
        if (plays('kick')) for (const step of kickSteps) add('kick', bar, step, 2)
        if (plays('snare')) {
          for (const step of snareSteps) add('snare', bar, step, 2)
          for (const step of ghosts) add('snare', bar, step, 1, undefined, ghostVelocity)
        }
        if (plays('tomHigh')) {
          for (const step of kitTomHighSteps) add('tomHigh', bar, step, FILL_DURATIONS.tomHigh)
        }
        if (plays('tomLow')) {
          for (const step of kitTomLowSteps) add('tomLow', bar, step, FILL_DURATIONS.tomLow)
        }
        if (plays('hatClosed')) {
          const closed = plays('hatOpen')
            ? hatSteps.filter((s) => !hatOpenSteps.includes(s))
            : hatSteps
          for (const step of closed) add('hatClosed', bar, step, 1)
        }
        if (plays('hatOpen')) for (const step of hatOpenSteps) add('hatOpen', bar, step, 2)
        if (rides) for (const step of rideSteps) add('ride', bar, step, RIDE_SUSTAIN_SIXTEENTHS)
        if (plays('rim') && placement.rimBars.includes(barInPass)) {
          for (const step of rimSteps) add('rim', bar, step, 1)
        }
        if (plays('bongoHigh')) {
          for (const step of bongoHighSteps) {
            const sixteenth = (step * PATTERN_RESOLUTION) / template.subdivision
            const base = velocityFor('bongoHigh', sixteenth)
            add('bongoHigh', bar, step, 1, undefined, clampVelocity(base * (bongoAccents.get(step) ?? 1)))
          }
        }
        if (plays('bongoLow')) {
          for (const step of bongoLowSteps) {
            const sixteenth = (step * PATTERN_RESOLUTION) / template.subdivision
            const base = velocityFor('bongoLow', sixteenth)
            add('bongoLow', bar, step, 1, undefined, clampVelocity(base * (bongoAccents.get(step) ?? 1)))
          }
        }
      }

      for (const figure of template.figures ?? []) {
        if (!plays(figure.voice)) continue
        for (const step of grid(figure.bars[barInPass % figure.bars.length])) {
          const sixteenth = (step * PATTERN_RESOLUTION) / template.subdivision
          add(
            figure.voice,
            bar,
            step,
            FILL_DURATIONS[figure.voice],
            undefined,
            velocityFor(figure.voice, sixteenth),
          )
        }
      }

      if (rides && plays('kick')) {
        const sounding = role
          ? (phraseForRole(role).find(([voice]) => voice === 'kick')?.[1] ?? [])
          : kickSteps
        for (const step of featherSteps(sounding, template.subdivision)) {
          add('kick', bar, step, 2, undefined, FEATHER_VELOCITY)
        }
      }

      if (plays('bass')) {
        for (const note of bassFigure[barInPass]) add('bass', bar, note.step, 2, note.midi)
      }

      if (plays('comp')) {
        const voicing = compFigure[barInPass]
        const spread = voicing.length > 1 ? compSpreadSec / (voicing.length - 1) : 0
        for (const step of compSteps) {
          const sixteenth = (step * PATTERN_RESOLUTION) / template.subdivision
          const base = accentedVelocity('comp', step, sixteenth, pass)
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
    progressionDegrees: harmony.progressionDegrees,
  }

  return { events: shaped, music, harmony }
}
