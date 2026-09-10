import type { FeelTemplate } from '../types.ts'
import { BARS_PER_PASS, PATTERN_RESOLUTION } from './grid.ts'

const BASS_BASE_MIDI = 24

const BASS_OCTAVE_LIFT = 12

const BASS_CEILING_MIDI = 48

export const BASS_FLOOR_MIDI = 25

// A walking line needs room to step four times a bar without hitting the fold window's
// wall; the drawn figure never moves far enough to care. G2, a fourth under the drawn
// figure's ceiling and twelve semitones under the comp's floor.
export const BASS_WALK_CEILING = 43

// A walking bass steps; it does not leap. Nothing may move further than a fifth.
const BASS_WALK_MAX_STEP = 7

// Two symbols, not one: raising a single constant would have skipped the clamp below
// and given every feel a flat 3. quick-24; docs/music.md § Voicing.
export const BASS_SUSTAIN_FLOOR = 2

export const BASS_SUSTAIN_DEFAULT = 3

// One length for all four quarters, and detached quarters read as a march rather than a
// line; even quarters are what a walking bass is. Under four, so the note-off still
// lands before the next attack. A shorter approach note was tried and rejected — it made
// beat 4 a pickup at the cost of the evenness that carries the line.
const BASS_WALK_SUSTAIN = 3.5

// Every walking note is a quarter, so `velocityFor` calls all four `strong` and the
// whole line plays one velocity layer. These cross the pack's layer boundaries at 0.86
// and 0.74 on purpose: beats 2 and 4 get a softer attack, not merely a quieter one.
const BASS_WALK_VELOCITIES = [0.92, 0.78, 0.85, 0.74]

const BASS_REST_CHANCE = 0.18
const BASS_REPEAT_CHANCE = 0.4
const BASS_OCTAVE_CHANCE = 0.32

function inRegister(midi: number, base: number, floor: number): number {
  const placed = base + (((midi % 12) + 12) % 12)
  return placed < floor ? placed + 12 : placed
}

function walkPool(pitchClasses: Set<number>, floor: number): number[] {
  const pool: number[] = []
  for (let midi = floor; midi <= BASS_WALK_CEILING; midi++) {
    if (pitchClasses.has(((midi % 12) + 12) % 12)) pool.push(midi)
  }
  return pool
}

// The smallest move in `direction` that stays a step from `from` and, where a later note
// is already fixed, leaves that note reachable too. Falling back to `from` is what the
// ticket's allowed repeat is: the line ran out of room, not a coin flip.
function walkStep(
  from: number,
  pool: number[],
  direction: number,
  toward: number | null,
  towardLimit = BASS_WALK_MAX_STEP,
): number {
  const reachable = pool.filter(
    (midi) =>
      Math.abs(midi - from) <= BASS_WALK_MAX_STEP &&
      (toward === null || Math.abs(toward - midi) <= towardLimit),
  )
  const forward = reachable.filter((midi) => Math.sign(midi - from) === direction)
  const nearest = (candidates: number[]) =>
    [...candidates].sort((a, b) => Math.abs(a - from) - Math.abs(b - from))[0]

  if (forward.length > 0) return nearest(forward)

  const sideways = reachable.filter((midi) => midi !== from)
  if (sideways.length > 0) return nearest(sideways)

  // `toward` and the step limit could not both be met. The pool is the harder
  // constraint — beat three has to stay a chord tone — so the step limit gives first.
  const inStep = pool.filter((midi) => Math.abs(midi - from) <= BASS_WALK_MAX_STEP)
  return nearest(inStep.length > 0 ? inStep : pool) ?? from
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

export type BassNote = { step: number; midi: number; sustain?: number; velocity?: number }

export type BassLine = {
  figure: BassNote[][]
  ring: (barInPass: number, step: number) => number
}

export type BassLineInput = {
  template: FeelTemplate
  walking: boolean
  bassSteps: number[]
  chordFor: (barInPass: number) => number[]
  nextRootAt: (barInPass: number) => number | null
  rhythmRng: () => number
  bassFloor: number
  decisions?: BassDecisions
}

export function buildBassLine({
  template,
  walking,
  bassSteps,
  chordFor,
  nextRootAt,
  rhythmRng,
  bassFloor,
  decisions,
}: BassLineInput): BassLine {
  const quarterBassSteps = [0, 1, 2, 3].map((beat) => (beat * template.subdivision) / 4)

  const bassFigure: BassNote[][] = []
  const approaches = new Set<number>()
  let previousBass: number | null = null
  for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
    const chord = chordFor(barInPass)
    const notes: BassNote[] = []

    if (walking) {
      const nextRoot = nextRootAt(barInPass)
      const target = inRegister(nextRoot ?? chord[0], BASS_BASE_MIDI, bassFloor)
      const direction = rhythmRng()

      const beatOne = inRegister(chord[0], BASS_BASE_MIDI, bassFloor)
      const approach =
        nextRoot === null
          ? null
          : direction < 0.5 && target - 1 >= bassFloor
            ? target - 1
            : target + 1

      const chordTones = new Set(chord.map((midi) => ((midi % 12) + 12) % 12))
      const rootClass = ((chord[0] % 12) + 12) % 12
      const away = new Set([...chordTones].filter((pitchClass) => pitchClass !== rootClass))
      const stepping = walkPool(chordTones, bassFloor)
      const restating = walkPool(away.size > 0 ? away : chordTones, bassFloor)

      const heading = Math.sign((approach ?? target) - beatOne) || (direction < 0.5 ? -1 : 1)
      const beatTwo = walkStep(beatOne, stepping, heading, approach ?? target, BASS_WALK_MAX_STEP * 2)
      const beatThree = walkStep(beatTwo, restating, heading, approach)
      const beatFour = approach ?? walkStep(beatThree, stepping, heading, target)

      for (const [index, midi] of [beatOne, beatTwo, beatThree, beatFour].entries()) {
        notes.push({
          step: quarterBassSteps[index],
          midi,
          sustain: BASS_WALK_SUSTAIN,
          velocity: BASS_WALK_VELOCITIES[index],
        })
      }
      if (nextRoot !== null) {
        decisions?.approaches.push({ bar: barInPass, target, wantsBelow: direction < 0.5, belowOk: target - 1 >= bassFloor, approach: beatFour })
      }
      bassFigure.push(notes)
      continue
    }

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

  if (!walking && !restsSomewhere()) {
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
  if (!walking && liftable.length > 0) {
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
  if (!walking && !repeatsSomewhere()) {
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

  // Gap off the grid, not off the humanized onsets, so length does not jitter with the
  // timing walk kick and bass share.
  const bassRing = (barInPass: number, step: number): number => {
    const cap = template.bassSustain ?? BASS_SUSTAIN_DEFAULT
    if (cap <= BASS_SUSTAIN_FLOOR) return BASS_SUSTAIN_FLOOR

    const later = bassFigure[barInPass].map((note) => note.step).filter((s) => s > step)
    const following = bassFigure[(barInPass + 1) % BARS_PER_PASS].map((note) => note.step)
    const gap =
      later.length > 0
        ? Math.min(...later) - step
        : template.subdivision - step + (following.length > 0 ? Math.min(...following) : 0)

    const sixteenths = (gap * PATTERN_RESOLUTION) / template.subdivision
    return Math.max(BASS_SUSTAIN_FLOOR, Math.min(cap, sixteenths))
  }

  return { figure: bassFigure, ring: bassRing }
}
