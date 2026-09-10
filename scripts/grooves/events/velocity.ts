import type { VoiceName } from '../types.ts'

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

export function velocityFor(voice: VoiceName, step: number): number {
  const shape = VELOCITIES[voice]
  if (step % 4 === 0) return shape.strong
  if (step % 2 === 0) return shape.medium
  return shape.weak
}

export function clampVelocity(velocity: number): number {
  return Math.min(1, Math.max(MIN_VELOCITY, velocity))
}

export const HAT_ACCENTS = [1, 0.72, 0.88, 0.66]

// Three, so the cycle is coprime with the four-beat bar and never locks to
// it, and shallow, because a wavering pulse reads worse than a flat one.
export const RIDE_ACCENTS = [1, 0.9, 0.95]

export const COMP_ACCENTS = [1.12, 1, 0.88, 1.12, 0.88]

export const BONGO_ACCENTS = [1, 0.82, 0.94, 0.74]

export const GHOST_VELOCITY_THRESHOLD = 0.5

export const GHOST_VELOCITY_RANGE: [number, number] = [0.15, 0.25]

// The loudest round value whose humanized ceiling (0.21 + 0.13) still sits
// inside the softest recorded kick layer, whose maxVelocity is 0.3465.
export const FEATHER_VELOCITY = 0.21

export function accentCycle(steps: number[], cycle: number[]): Map<number, number> {
  const accents = new Map<number, number>()
  steps.forEach((step, index) => {
    accents.set(step, cycle[index % cycle.length])
  })
  return accents
}
