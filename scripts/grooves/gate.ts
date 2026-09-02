import { rmsDbfs } from './level.ts'
import { PEAK_CEILING, SEAM_THRESHOLD, truePeak } from './mix.ts'
import { offScalePitches } from './theory/pitches.ts'
import { isValidHarmony } from './theory/validity.ts'
import type { Harmony } from './theory/harmony.ts'
import type { FeelTemplate, GateFailure, MusicMeta, NoteEvent, Pcm } from './types.ts'

export const SILENCE_FLOOR = 0.01

export const SILENCE_RMS_FLOOR = 0.001

const FULL_SCALE = 1

const PEAK_TOLERANCE = 1e-4

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

function checkLoudness(pcm: Pcm): GateFailure | null {
  const level = rmsDbfs(pcm)
  if (level >= LOUDNESS_FLOOR_DB && level <= LOUDNESS_CEILING_DB) return null
  return {
    check: 'loudness',
    detail: `measured ${level.toFixed(1)} dBFS RMS, outside ${LOUDNESS_FLOOR_DB}..${LOUDNESS_CEILING_DB}`,
  }
}

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

function checkHarmony(music: MusicMeta, harmony: Harmony): GateFailure | null {
  if (isValidHarmony(music, harmony)) return null
  return {
    check: 'harmony',
    detail: `${music.chord} / ${music.progression} is not valid in ${music.root} ${music.flavour} (harmony plays ${harmony.chordName} / ${harmony.progressionName})`,
  }
}

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
