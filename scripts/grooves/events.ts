import type {
  FeelTemplate,
  GrooveSpec,
  MusicMeta,
  NoteEvent,
  VoiceName,
} from './types.ts'
import { assertFigures, assertPatterns } from './patterns.ts'
import { intBetween, pick, rngFor } from './rng.ts'
import { applyDrift, applySwing, fitToLoop, humanize } from './humanize.ts'
import { ROOTS } from '../../src/lib/theory/roots.ts'
import { buildHarmony } from './theory/harmony.ts'
import type { Harmony } from './theory/harmony.ts'
import { scaleName } from '../../src/lib/theory/scales.ts'
import {
  BARS_PER_PASS,
  BEATS_PER_BAR,
  PATTERN_RESOLUTION,
  featherSteps,
  figureBars,
  ghostSteps,
  gridSteps,
  middlePassOf,
  sixteenthOf,
} from './events/grid.ts'
import {
  BASS_PATTERNS,
  BONGO_PATTERNS,
  COMP_PATTERNS,
  HAT_PATTERNS,
  HAT_PUNCTUATION_PATTERNS,
  KICK_PATTERNS,
  RIDE_PATTERNS,
  RIDE_SUSTAIN_SIXTEENTHS,
  SNARE_GHOST_PATTERNS,
} from './events/pools.ts'
import {
  BONGO_ACCENTS,
  COMP_ACCENTS,
  FEATHER_VELOCITY,
  GHOST_VELOCITY_RANGE,
  HAT_ACCENTS,
  RIDE_ACCENTS,
  accentCycle,
  clampVelocity,
  velocityFor,
} from './events/velocity.ts'
import {
  DEFAULT_FILL,
  FILLS,
  FILL_DURATIONS,
  PLACEMENTS,
  assertFill,
  placementFor,
  withoutToms,
  type FillPhrase,
} from './events/fills.ts'
import {
  COMP_SPREAD_RANGE,
  COMP_VOICE_DROP,
  playedVoicing,
  voiceLead,
} from './events/voicing.ts'
import { BASS_FLOOR_MIDI, buildBassLine, type BassDecisions } from './events/bass.ts'

export {
  BARS_PER_PASS,
  PATTERN_RESOLUTION,
  QUARTER_STEPS_16,
  featherSteps,
  figureBars,
  gridSteps,
  middlePassOf,
} from './events/grid.ts'
export {
  HAT_PUNCTUATION_PATTERNS,
  RIDE_PATTERNS,
  RIDE_SUSTAIN_SIXTEENTHS,
} from './events/pools.ts'
export {
  COMP_ACCENTS,
  FEATHER_VELOCITY,
  GHOST_VELOCITY_THRESHOLD,
  HAT_ACCENTS,
  RIDE_ACCENTS,
  VELOCITIES,
} from './events/velocity.ts'
export {
  DEFAULT_FILL,
  DEFAULT_PLACEMENT,
  FILLS,
  FILL_DURATIONS,
  PLACEMENTS,
  assertFill,
  type FillPhrase,
} from './events/fills.ts'
export {
  COMP_REGISTER_CEILING,
  COMP_REGISTER_LOW,
  playedVoicing,
  voiceLead,
} from './events/voicing.ts'
export {
  BASS_SUSTAIN_DEFAULT,
  BASS_SUSTAIN_FLOOR,
  BASS_WALK_CEILING,
  type BassDecisions,
} from './events/bass.ts'

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
  const sixteenth = (step: number) => sixteenthOf(step, template.subdivision)
  const placement = placementFor(template.id)

  const plays = (voice: VoiceName) => template.voices.includes(voice)
  const rides = plays('ride')
  const walking = (spec.bassType ?? template.bassType ?? 'normal') === 'walking-bass'

  const pools = template.patterns

  const kickSteps = grid(pick(rhythmRng, pools?.kick ?? KICK_PATTERNS))
  const hatSteps = grid(
    pick(rhythmRng, pools?.hatClosed ?? (rides ? HAT_PUNCTUATION_PATTERNS : HAT_PATTERNS)),
  )
  const bassSteps = grid(pick(rhythmRng, pools?.bass ?? BASS_PATTERNS))
  const compPhrase = figureBars(pick(rhythmRng, pools?.comp ?? COMP_PATTERNS), template.subdivision)

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

  const rideAccents = accentCycle(rideSteps, RIDE_ACCENTS)

  const playsBongo = template.voices.includes('bongoHigh')
  const bongoFigure = playsBongo
    ? pick(rngFor(`${spec.template}:${spec.seed}:${BONGO_LABEL}`), pools?.bongos ?? BONGO_PATTERNS)
    : { high: [], low: [] }
  const bongoHighSteps = grid(bongoFigure.high)
  const bongoLowSteps = grid(bongoFigure.low)

  const bongoLine = [...new Set([...bongoHighSteps, ...bongoLowSteps])].sort((a, b) => a - b)
  const bongoAccents = accentCycle(bongoLine, BONGO_ACCENTS)

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

  const hatLine = [
    ...new Set([...hatSteps, ...(plays('hatOpen') ? hatOpenSteps : [])]),
  ].sort((a, b) => a - b)
  const hatAccents = accentCycle(hatLine, HAT_ACCENTS)

  // The accent cycle indexes the hit's position in the whole phrase rather than in the
  // bar, so a two-bar figure gives its second bar a different shape from its first. It
  // restarts each phrase, not each bar: only `pass` walks the pair.
  const compPhraseOffsets = compPhrase.reduce<number[]>(
    (offsets, bar) => [...offsets, offsets[offsets.length - 1] + bar.length],
    [0],
  )
  const compAccent = (position: number, pass: number) =>
    COMP_ACCENTS[(position + pass) % COMP_ACCENTS.length]

  const accentedVelocity = (voice: VoiceName, step: number, sixteenthStep: number) => {
    const base = velocityFor(voice, sixteenthStep)
    if (voice === 'hatClosed' || voice === 'hatOpen') {
      return clampVelocity(base * (hatAccents.get(step) ?? 1))
    }
    if (voice === 'ride') {
      return clampVelocity(base * (rideAccents.get(step) ?? 1))
    }
    return base
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
      velocity: velocity ?? accentedVelocity(voice, step, sixteenth(step)),
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

  const bass = buildBassLine({
    template,
    walking,
    bassSteps,
    chordFor,
    nextRootAt,
    rhythmRng,
    bassFloor,
    decisions,
  })

  const compFigure: number[][] = []
  let previousVoicing: number[] | null = null
  for (let barInPass = 0; barInPass < BARS_PER_PASS; barInPass++) {
    const chord = chordFor(barInPass)
    const voicing = voiceLead(previousVoicing, chord)
    previousVoicing = voicing
    const bassMidi = plays('bass') ? bass.figure[barInPass].map((note) => note.midi) : []
    compFigure.push(playedVoicing(voicing, chord, bassMidi))
  }

  const passRanges: { start: number; end: number }[] = []

  const resolvePhrase = (phrase: FillPhrase): [VoiceName, number[]][] =>
    (Object.entries(phrase) as [VoiceName, number[]][])
      .filter(([voice]) => plays(voice))
      .map(([voice, steps]) => [voice, grid(steps)] as [VoiceName, number[]])

  const declared = FILLS[template.id] ?? { fill: DEFAULT_FILL }
  assertFill(template.id, 'fill', declared.fill)
  if (declared.variation) assertFill(template.id, 'variation', declared.variation)
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

  const addAccented = (voice: VoiceName, bar: number, step: number, accents: Map<number, number>) => {
    const base = velocityFor(voice, sixteenth(step))
    add(voice, bar, step, 1, undefined, clampVelocity(base * (accents.get(step) ?? 1)))
  }

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
          for (const step of bongoHighSteps) addAccented('bongoHigh', bar, step, bongoAccents)
        }
        if (plays('bongoLow')) {
          for (const step of bongoLowSteps) addAccented('bongoLow', bar, step, bongoAccents)
        }
      }

      for (const figure of template.figures ?? []) {
        if (!plays(figure.voice)) continue
        for (const step of grid(figure.bars[barInPass % figure.bars.length])) {
          add(
            figure.voice,
            bar,
            step,
            FILL_DURATIONS[figure.voice],
            undefined,
            velocityFor(figure.voice, sixteenth(step)),
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
        for (const note of bass.figure[barInPass]) {
          add(
            'bass',
            bar,
            note.step,
            note.sustain ?? bass.ring(barInPass, note.step),
            note.midi,
            note.velocity,
          )
        }
      }

      if (plays('comp')) {
        const voicing = compFigure[barInPass]
        const spread = voicing.length > 1 ? compSpreadSec / (voicing.length - 1) : 0
        const phraseBar = barInPass % compPhrase.length
        compPhrase[phraseBar].forEach((step, inBar) => {
          const base = clampVelocity(
            velocityFor('comp', sixteenth(step)) *
              compAccent(compPhraseOffsets[phraseBar] + inBar, pass),
          )
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
        })
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
