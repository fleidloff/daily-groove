export const BEAT_TOLERANCE_SECONDS = 0.06

export function beatSeconds(bpm: number): number {
  return Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0
}

export function secondsToNextBeat(
  grooveSeconds: number,
  beatLength: number,
  tolerance: number = BEAT_TOLERANCE_SECONDS,
): number {
  if (!Number.isFinite(beatLength) || beatLength <= 0) return 0
  if (!Number.isFinite(grooveSeconds)) return 0

  const position = grooveSeconds > 0 ? grooveSeconds : 0
  const since = position % beatLength
  if (since === 0) return 0

  const until = beatLength - since
  return until <= Math.max(tolerance, 0) ? 0 : until
}

export type BeatSource = {
  getStartTime(): number | null
  subscribe(listener: () => void): () => void
}

export type GrooveClock = {
  nextBeat(now: number): number | null
  isRunning(): boolean
  subscribe(listener: () => void): () => void
}

export function createGrooveClock(source: BeatSource, bpm: number): GrooveClock {
  const beat = beatSeconds(bpm)

  return {
    nextBeat(now: number): number | null {
      const startedAt = source.getStartTime()
      if (startedAt === null || !Number.isFinite(now)) return null
      return now + secondsToNextBeat(now - startedAt, beat)
    },
    isRunning(): boolean {
      return source.getStartTime() !== null
    },
    subscribe(listener: () => void): () => void {
      return source.subscribe(listener)
    },
  }
}
