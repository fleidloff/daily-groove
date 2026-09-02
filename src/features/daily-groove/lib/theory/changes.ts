export const BAR_COUNT = 4

const SEPARATOR = '–'

export function perBar<T>(values: readonly T[]): (T | undefined)[] {
  if (values.length === 0) return Array.from({ length: BAR_COUNT }, () => undefined)

  return Array.from({ length: BAR_COUNT }, (_, bar) => values[bar % values.length])
}

export function barChords(progression: string): string[] {
  const chords = progression
    .split(SEPARATOR)
    .map((chord) => chord.trim())
    .filter((chord) => chord.length > 0)

  return perBar(chords).map((chord) => chord ?? '')
}
