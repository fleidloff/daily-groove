import type { VoiceName } from '../types.ts'

export type Placement = {
  snare: number[]
  hatOpen: number[]
  rim: number[]
  rimBars: number[]
}

export const DEFAULT_PLACEMENT: Placement = {
  snare: [4, 12],
  hatOpen: [14],
  rim: [15],
  rimBars: [1, 3],
}

export const PLACEMENTS: Record<string, Partial<Placement>> = {
  'half-time': { snare: [8] },
  'bright-straight': { rim: [14], rimBars: [3] },
  // No snare key: patterns.kit owns this feel's snare line, and declaring both throws.
  // The cross-stick clicks on the "e" of 4 — the one sixteenth every kit figure and
  // every tom accent leaves empty — and it clicks in all four bars, so a pass whose
  // last bar is a fill still has it three times.
  'second-line': { hatOpen: [14], rim: [13], rimBars: [0, 1, 2, 3] },
}

export function placementFor(templateId: string): Placement {
  return { ...DEFAULT_PLACEMENT, ...(PLACEMENTS[templateId] ?? {}) }
}

export type FillPhrase = Partial<Record<VoiceName, number[]>>

export const DEFAULT_FILL: FillPhrase = {
  kick: [0],
  snare: [0, 2, 4, 6, 14],
  tomHigh: [8, 10],
  tomLow: [12],
}

export const FILLS: Record<string, { fill: FillPhrase; variation?: FillPhrase }> = {
  'half-time': { fill: { snare: [8, 12], tomHigh: [10], tomLow: [14] } },
  // Declared to close a hole rather than to add a gesture: DEFAULT_FILL names no
  // hatClosed, and a marked bar emits only the phrase's voices, so open-ballad's last
  // bar had no hi-hat at all for three and a half seconds.
  //
  // The bar marks itself by *changing* the hat — sixteenths give way to eighths —
  // rather than by out-counting an ordinary bar, which is what a ballad drummer plays.
  // It keeps the kick on 1 and 3 and both backbeats, because a ballad does not abandon
  // them for a roll, and the toms answer from the "and" of 3 into the second half of
  // beat 4 so the downbeat arrives on its own. Steps 10 and 14 are left out of the hat
  // for the reason the template's pool leaves them out: the hatOpen figure plays
  // through fills and supplies both here, so the two lines together state the eighths.
  // hatOpen is deliberately unnamed — the figure already sounds it, and `add` does not
  // dedupe.
  'open-ballad': {
    fill: {
      kick: [0, 8],
      snare: [4, 12],
      hatClosed: [0, 2, 4, 6, 8, 12],
      tomHigh: [10, 11],
      tomLow: [13, 14],
    },
  },
  shuffle: {
    fill: { kick: [0], snare: [0, 4, 14], tomHigh: [6, 8], tomLow: [10, 12] },
  },
  // A bossa has no drum fill: the hat and the clave never stop, and the turnaround is
  // a snare push rather than a roll. Both phrases are declared because the feel carries
  // no toms, which would make the default `withoutToms` variation identical to its fill.
  //
  // What marks the bar is the surdo opening to quarters. Every figure in the template's
  // kick pool leaves beat 2 empty, so `[0, 4, 8, 12]` states a position no ordinary bar
  // of this feel ever states, and it is the phrase end the surdo player actually plays.
  // Both marked bars open it; the fill's extra snare on beat 3 is all that separates
  // them, which is why the fill still marks more than the variation.
  //
  // Every step here must be even. This feel is on the eighth grid, and `scaleStep`
  // rounds `step * 8 / 16`, so an odd step lands on its neighbour and `gridSteps`
  // dedupes the collision without an error — half of a written odd figure would
  // silently vanish.
  'bossa-nova': {
    fill: { kick: [0, 4, 8, 12], snare: [4, 8, 10, 12, 14], hatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
    variation: { kick: [0, 4, 8, 12], snare: [4, 10, 12, 14], hatClosed: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  // The fill is the style, not a punctuation on it: a bar-long snare figure with the
  // toms answering it into beat 4, and no crash to arrive at, because the kit has
  // none. The kick keeps step 0 — the downbeat after this bar is position zero of the
  // file — and adds beat 4 under the low tom. The hat holds quarters so the roll has a
  // floor; the open hat and the rim stand down, which is what makes the bar read as an
  // event.
  //
  // The variation is the same groove with its tom answer taken away and its snare
  // thinned to the four struck steps. It is declared rather than left to
  // withoutToms(fill) because this feel's ordinary bars already carry toms, so the
  // thinning has to be visible against them rather than against the fill.
  // The fill's low tom keeps the big four and pushes past it into the downbeat: in an
  // ordinary bar the low tom *is* beat 4, so a fill that lands there and stops repeats
  // the groove instead of answering it. The variation keeps the turnaround click — a
  // thinning takes the answer out, not the timekeeping — and the fill still drops it,
  // because the roll wants that sixteenth. Both are what make the middle bar read as
  // less than the drawn figure and the last bar as more; measured over 400 seeds the
  // middle bar is nearer an ordinary bar than the fill is at every one of the 48
  // combinations the three pools can draw.
  'second-line': {
    fill: {
      kick: [0, 12],
      snare: [0, 1, 2, 4, 5, 6, 8, 14],
      tomHigh: [10, 11],
      tomLow: [12, 14],
      hatClosed: [0, 4, 8, 12],
    },
    variation: {
      kick: [0, 6, 12],
      snare: [0, 6, 10, 14],
      hatClosed: [0, 4, 8, 12],
      hatOpen: [14],
      rim: [13],
    },
  },
}

const TOM_VOICES: VoiceName[] = ['tomHigh', 'tomLow']

const PITCHED_VOICES: VoiceName[] = ['bass', 'comp']

export const FILL_DURATIONS: Record<VoiceName, number> = {
  kick: 2,
  snare: 2,
  hatClosed: 1,
  hatOpen: 2,
  ride: 8,
  rideBell: 8,
  claves: 1,
  cowbell: 1,
  rim: 1,
  tomHigh: 2,
  tomLow: 2,
  bongoHigh: 1,
  bongoLow: 1,
  bass: 2,
  comp: 4,
}

// A fill phrase carries no midi, so a pitched voice in one renders the chord at the
// sample's root note with no error — the same trap assertFigure closes for figures.
export function assertFill(templateId: string, subject: string, phrase: FillPhrase): void {
  for (const voice of PITCHED_VOICES) {
    if (voice in phrase) {
      throw new Error(
        `${templateId}: FILLS.${subject} names ${voice}: a fill phrase emits no midi, so the ` +
          `note would sound at the sample's root pitch — a fill may not name a pitched voice`,
      )
    }
  }
}

export function withoutToms(phrase: FillPhrase): FillPhrase {
  const thinned: FillPhrase = {}
  for (const [voice, steps] of Object.entries(phrase) as [VoiceName, number[]][]) {
    if (TOM_VOICES.includes(voice)) continue
    thinned[voice] = steps
  }
  return thinned
}
