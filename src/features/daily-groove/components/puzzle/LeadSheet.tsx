import { Lettering } from '@/components/typography/Lettering'

type LeadSheetProps = {
  /** One symbol per bar, in order. Four for the four-bar figure. */
  chords: string[]
}

/**
 * A bar line is a rule, so each bar is drawn as a box with a rule down its
 * left-hand side and the chord symbol sitting on top of it. Nothing boxes the
 * symbol in: the padding below it is the bar's air, and the next bar's rule is
 * where this one ends.
 *
 * The closing double bar is drawn on the row's right edge rather than on the
 * last bar, so it is as tall as the sheet: one row deep across four bars, two
 * rows deep when they break 2 × 2. A rule that closed only the last cell would
 * stop half way up the right-hand side of a broken sheet and read as a stray
 * mark rather than the end of the figure.
 *
 * The row is a grid, not a wrapping flex row, and that is the whole point: a
 * grid can only ever break 2 × 2 on a phone and 1 × 4 above `sm`. Flex wrapping
 * decides per item, so one wide symbol — `C♯m7♭5` in a bar with padding — pushes
 * its neighbour down and the four bars fall 3 + 1, which reads as a mistake
 * rather than a line break. Document order is bar order either way (R10).
 */
const BAR = 'relative border-l border-current/60 pl-3 pr-4 pt-1 pb-9'

/**
 * The day's changes, written out the way four bars of harmony are written out:
 * ruled bar lines, one chord symbol to a bar, a doubled bar line at the end.
 *
 * It derives nothing. `SolvedPanel` hands it the symbols `barChords` worked out,
 * so the same drawing serves any four chords — which is what lets the bar
 * mapping be reused without the drawing coming with it.
 *
 * It sets no colour. The sheet is read on the panel's inverted accent surface,
 * and the ink — the lettering and the rules alike — is that surface's
 * `currentColor`, so it flips with the palette without naming a token here (R8).
 *
 * HTML rather than SVG on purpose: the wrap and the inherited ink are both free
 * here, and there is no geometry in four symbols with rules between them.
 */
export function LeadSheet({ chords }: LeadSheetProps) {
  return (
    <div
      role="img"
      aria-label={chords.join(' · ')}
      // `border-r-[3px]` is the thick half of the closing double bar; the thin
      // half is the rule below, held just inside it. Both span the full height
      // of the grid, however many rows it has.
      className="relative grid grid-cols-2 sm:grid-cols-4 items-stretch border-r-[3px] border-current/60"
    >
      {chords.map((chord, bar) => (
        <div key={bar} data-bar={bar} className={BAR}>
          <Lettering size="md">{chord}</Lettering>
        </div>
      ))}
      <span
        data-double-bar=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[3px] border-r border-current/60"
      />
    </div>
  )
}
