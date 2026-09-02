export type LoopWindow = {
  loopStart: number
  loopEnd: number
}

function nonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function deriveLoopWindow(
  headDelaySeconds: number,
  loopSeconds: number,
  bufferSeconds: number,
): LoopWindow {
  const buffer = nonNegative(bufferSeconds, 0)
  const head = nonNegative(headDelaySeconds, 0)
  const length = nonNegative(loopSeconds, 0)

  const loopStart = head < buffer ? head : 0
  const loopEnd = Math.min(loopStart + length, buffer)

  return { loopStart, loopEnd: Math.max(loopEnd, loopStart) }
}

export function loopPosition(elapsed: number, loopSeconds: number): number {
  if (!Number.isFinite(loopSeconds) || loopSeconds <= 0) return 0
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0
  return (elapsed % loopSeconds) / loopSeconds
}
