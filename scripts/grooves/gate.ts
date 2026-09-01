/**
 * The quality gate: a rendered candidate is accepted, or rejected with a named
 * reason.
 *
 * Three of these six checks already existed as assertions in Epics 2 and 3.
 * This module lifts them out of the test suite and into the pipeline, so they
 * run on every groove ever minted rather than only on the ones someone wrote a
 * test for. A minted groove enters the catalogue only if `gateCandidate`
 * returns `null` (R5, R6).
 *
 * Every failure carries the check that fired AND the value it measured, so a
 * rejection tells the operator what was wrong rather than only that something
 * was (R7).
 */

import { rmsDbfs } from './level.ts'
import { PEAK_CEILING, SEAM_THRESHOLD, truePeak } from './mix.ts'
import { offScalePitches } from './theory/pitches.ts'
import { isValidHarmony } from './theory/validity.ts'
import type { Harmony } from './theory/harmony.ts'
import type { FeelTemplate, GateFailure, MusicMeta, NoteEvent, Pcm } from './types.ts'

/**
 * Below this true peak the render has nothing audible in it. Well under the
 * ceiling the mix normalises to, so only a genuinely dead render trips it.
 */
export const SILENCE_FLOOR = 0.01

/**
 * A second floor, on energy rather than on the single highest sample: a buffer
 * that is silent apart from one stray click clears the peak floor and is still
 * not a groove.
 */
export const SILENCE_RMS_FLOOR = 0.001

/** Full scale. At or above it the encoder clips whatever the true peak says. */
const FULL_SCALE = 1

/**
 * Slack on the ceiling comparison.
 *
 * `mixTracks` normalises true peak *onto* `PEAK_CEILING`, so a correctly
 * mastered groove measures the ceiling exactly — and floating-point rounding
 * puts it a hair above as often as a hair below. Comparing strictly rejects the
 * very output the mix stage is built to produce, which is not a quality signal
 * but an arithmetic one. The gate is here to catch a master that is genuinely
 * too hot, so it allows the ceiling plus one part in ten thousand.
 */
const PEAK_TOLERANCE = 1e-4

/**
 * The band every groove's integrated level must fall inside, in dBFS RMS.
 *
 * Peak cannot do this job, and the pack makes that vivid: every one of the six
 * feels renders to a true peak of exactly `PEAK_CEILING`, because the master is
 * normalised there. Peak is the one quantity already equalised across the
 * catalogue, so it says nothing about whether a groove *sounds* as loud as its
 * neighbour. RMS over the whole loop measures precisely that.
 *
 * The width is honest about what it is: a guard against a gross error - a voice
 * left at the wrong gain, a template mis-levelled by ten decibels - and not a
 * mastering tolerance. The six feels as committed span -27.1 dB (half-time) to
 * -22.1 dB (bright-straight), a five-decibel spread, and closing that spread
 * means changing the *balance* between voices rather than any master trim: with
 * the peak pinned, RMS is a function of crest factor. That is a judgement made
 * by ear, so the band accommodates the measured spread rather than asserting a
 * balance nobody has listened to.
 */
export const LOUDNESS_FLOOR_DB = -29
export const LOUDNESS_CEILING_DB = -20

export function gateCandidate(args: {
  pcm: Pcm
  events: NoteEvent[]
  music: MusicMeta
  harmony: Harmony
  template: FeelTemplate
}): GateFailure | null {
  return (
    checkPeak(args.pcm) ??
    checkSilence(args.pcm) ??
    checkSeam(args.pcm) ??
    checkHarmony(args.music, args.harmony) ??
    checkPitch(args.events, args.music, args.harmony) ??
    checkDensity(args.events, args.music, args.template) ??
    checkLoudness(args.pcm)
  )
}

/**
 * Outside the loudness band.
 *
 * Last in the chain deliberately. The checks before it catch grooves that are
 * broken; this one catches a groove that is intact but mixed wrong, and
 * reporting "too quiet" about a groove that is also clipping would bury the
 * fault worth fixing.
 */
function checkLoudness(pcm: Pcm): GateFailure | null {
  const level = rmsDbfs(pcm)
  if (level >= LOUDNESS_FLOOR_DB && level <= LOUDNESS_CEILING_DB) return null
  return {
    check: 'loudness',
    detail: `measured ${level.toFixed(1)} dBFS RMS, outside ${LOUDNESS_FLOOR_DB}..${LOUDNESS_CEILING_DB}`,
  }
}

/** Over the ceiling, or clipping outright. */
function checkPeak(pcm: Pcm): GateFailure | null {
  const peak = truePeak(pcm)
  const stored = storedPeak(pcm)

  if (stored >= FULL_SCALE) {
    return {
      check: 'peak',
      detail: `clips: stored peak ${stored.toFixed(4)} is at or above full scale ${FULL_SCALE} (ceiling ${PEAK_CEILING})`,
    }
  }
  if (peak > PEAK_CEILING + PEAK_TOLERANCE) {
    return {
      check: 'peak',
      detail: `true peak ${peak.toFixed(4)} exceeds the ceiling ${PEAK_CEILING}`,
    }
  }
  return null
}

/** Silent, or so quiet it may as well be. */
function checkSilence(pcm: Pcm): GateFailure | null {
  const peak = truePeak(pcm)
  if (peak < SILENCE_FLOOR) {
    return {
      check: 'silence',
      detail: `true peak ${peak.toFixed(6)} is below the audible floor ${SILENCE_FLOOR}`,
    }
  }

  const rms = rmsOf(pcm)
  if (rms < SILENCE_RMS_FLOOR) {
    return {
      check: 'silence',
      detail: `rms ${rms.toFixed(6)} is below the audible floor ${SILENCE_RMS_FLOOR}`,
    }
  }
  return null
}

/**
 * The loop's last sample sits next to its first every time it repeats. A step
 * between them is a click, once a bar, forever.
 */
function checkSeam(pcm: Pcm): GateFailure | null {
  const left = seamOf(pcm.left)
  const right = seamOf(pcm.right)
  const worst = Math.max(left, right)
  if (worst <= SEAM_THRESHOLD) return null

  const channel = left >= right ? 'left' : 'right'
  return {
    check: 'seam',
    detail: `${channel} seam ${worst.toFixed(4)} exceeds ${SEAM_THRESHOLD} (left ${left.toFixed(4)}, right ${right.toFixed(4)})`,
  }
}

/** The words shipped beside the audio must describe the audio. */
function checkHarmony(music: MusicMeta, harmony: Harmony): GateFailure | null {
  if (isValidHarmony(music, harmony)) return null
  return {
    check: 'harmony',
    detail: `${music.chord} / ${music.progression} is not valid in ${music.root} ${music.flavour} (harmony plays ${harmony.chordName} / ${harmony.progressionName})`,
  }
}

/**
 * The same claim as `checkHarmony`, one level down: the *events* must describe
 * the audio too.
 *
 * `checkHarmony` reads the harmony object — chord names, degrees, pitch classes
 * — and never a `NoteEvent`. That was enough while every emitted pitch was
 * derived from `harmony.progressionMidi` and could not disagree with it. The
 * bass's chromatic approach note ends that, so this check reads what is
 * actually played. The rule, and its one named exception, live in
 * `theory/pitches.ts` beside the harmony they bend.
 *
 * A hard failure with no warning mode and no exemptions: the whole catalogue
 * passed it on the day it landed, which is the proof that the grooves shipped
 * before it were already honest (R10a).
 */
function checkPitch(
  events: NoteEvent[],
  music: MusicMeta,
  harmony: Harmony,
): GateFailure | null {
  const failures = offScalePitches(events, music, harmony)
  if (failures.length === 0) return null

  const [first] = failures
  const rest = failures.length > 1 ? ` (and ${failures.length - 1} more)` : ''
  return {
    check: 'pitch',
    detail: `${first.voice} plays MIDI ${first.midi} at ${first.timeSec.toFixed(3)}s, which ${music.scale} does not contain${rest}`,
  }
}

/**
 * Too sparse to state its harmony, or so dense it turns to mush.
 *
 * Measured over `loopBars` — what was actually rendered — and not over `bars`,
 * which is the four-bar figure. A groove is several passes of that figure, so
 * dividing by the figure would report the density of one pass multiplied by the
 * pass count and reject a perfectly playable groove for being four times as
 * busy as it is (R13).
 */
function checkDensity(
  events: NoteEvent[],
  music: MusicMeta,
  template: FeelTemplate,
): GateFailure | null {
  const { minPerBar, maxPerBar } = template.density
  const bars = music.loopBars

  if (bars <= 0) {
    return {
      check: 'density',
      detail: `${events.length} events over ${bars} bars cannot be measured per bar`,
    }
  }

  const perBar = events.length / bars
  if (perBar >= minPerBar && perBar <= maxPerBar) return null

  const direction = perBar < minPerBar ? 'below' : 'above'
  return {
    check: 'density',
    detail: `${perBar.toFixed(2)} events per bar (${events.length} over ${bars} bars) is ${direction} the template's ${minPerBar}–${maxPerBar}`,
  }
}

function storedPeak(pcm: Pcm): number {
  let peak = 0
  for (const v of pcm.left) peak = Math.max(peak, Math.abs(v))
  for (const v of pcm.right) peak = Math.max(peak, Math.abs(v))
  return peak
}

function rmsOf(pcm: Pcm): number {
  const n = pcm.left.length + pcm.right.length
  if (n === 0) return 0
  let sum = 0
  for (const v of pcm.left) sum += v * v
  for (const v of pcm.right) sum += v * v
  return Math.sqrt(sum / n)
}

function seamOf(channel: Float32Array): number {
  if (channel.length === 0) return 0
  return Math.abs(channel[channel.length - 1] - channel[0])
}
