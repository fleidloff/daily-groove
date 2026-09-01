import { Lettering } from '@/components/typography/Lettering'

type LeadSheetProps = {
  /** One symbol per bar, in order. Four for the four-bar figure. */
  chords: string[]
  /**
   * One numeral per bar, same length and order as `chords`. `''` draws no
   * numeral; the prop absent draws none at all and leaves the accessible name
   * as the symbols alone.
   */
  numerals?: string[]
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
 * It derives nothing. `SolvedPanel` hands it the symbols `barChords` worked out
 * and the numerals `barNumerals` worked out, so the same drawing serves any four
 * chords — which is what lets the bar mapping be reused without the drawing
 * coming with it. Nothing here knows what a flavour or a scale degree is.
 *
 * The numeral is absolutely positioned in the `pb-9` air its bar already
 * reserves, so a numeral changes no geometry and a long one cannot make its bar
 * taller than its neighbour (R7). A bar whose numeral is missing or empty draws
 * its symbol and nothing below it: four blank bars beat a crash, and a numeral
 * is less load-bearing than a bar (R8).
 *
 * It sets no colour. The sheet is read on the panel's inverted accent surface,
 * and the ink — the lettering and the rules alike — is that surface's
 * `currentColor`, so it flips with the palette without naming a token here (R8).
 *
 * HTML rather than SVG on purpose: the wrap and the inherited ink are both free
 * here, and there is no geometry in four symbols with rules between them.
 */
export function LeadSheet({ chords, numerals }: LeadSheetProps) {
  return (
    <div
      role="img"
      // `role="img"` hides the subtree from assistive technology, so a numeral
      // that is not in the accessible name is a numeral no screen-reader user
      // ever hears. Each bar reads as its symbol and, where it has one, its
      // numeral; a bar without one reads exactly as it did before.
      aria-label={chords
        .map((chord, bar) =>
          numerals?.[bar] ? `${chord} ${numerals[bar]}` : chord,
        )
        .join(' · ')}
      // `border-r-[3px]` is the thick half of the closing double bar; the thin
      // half is the rule below, held just inside it. Both span the full height
      // of the grid, however many rows it has.
      className="relative grid grid-cols-2 sm:grid-cols-4 items-stretch border-r-[3px] border-current/60"
    >
      {chords.map((chord, bar) => (
        <div key={bar} data-bar={bar} className={BAR}>
          <Lettering size="md">{chord}</Lettering>
          {numerals?.[bar] ? (
            <span data-numeral="" className="absolute bottom-2 left-3">
              <Lettering size="sm">{numerals[bar]}</Lettering>
            </span>
          ) : null}
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
