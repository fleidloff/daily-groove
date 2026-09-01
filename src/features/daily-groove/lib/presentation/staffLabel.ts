/**
 * The staff's accessible name: each degree with the note it names, in order.
 * `staffLabel(['1','2','♭3'], ['G','A','B♭'])` → '1 G, 2 A, ♭3 B♭'.
 *
 * The staff is an SVG with `role="img"`, so this one string is everything a
 * screen reader gets from the drawing — and the note names are not drawn at all
 * (R6a), which makes it their only home. Each degree stays beside its own note
 * so the pairing survives being read aloud in one pass, and the comma gives a
 * pause between pairs rather than one unbroken run of tokens.
 *
 * It pairs by index and stops at the shorter array: the blues scale has six
 * notes and a mode has seven, and a disagreement between the two lists is a
 * `lib/` test's business, not this function's — it names what it can rather than
 * throwing or reading `undefined` aloud.
 */
export function staffLabel(degrees: string[], notes: string[]): string {
  const paired = Math.min(degrees.length, notes.length)

  return Array.from(
    { length: paired },
    (_, index) => `${degrees[index]} ${notes[index]}`,
  ).join(', ')
}
