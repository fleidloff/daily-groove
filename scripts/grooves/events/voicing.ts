export const COMP_REGISTER_LOW = 55
export const COMP_REGISTER_CEILING = 76

export const COMP_SPREAD_RANGE: [number, number] = [0.005, 0.015]

export const COMP_VOICE_DROP = 0.12

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

function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
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
