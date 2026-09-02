export function staffLabel(degrees: string[], notes: string[]): string {
  const paired = Math.min(degrees.length, notes.length)

  return Array.from(
    { length: paired },
    (_, index) => `${degrees[index]} ${notes[index]}`,
  ).join(', ')
}
