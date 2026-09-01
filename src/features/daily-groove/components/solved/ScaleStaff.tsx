import { STAFF_FLOOR_STEP, type StaffNote } from '../../lib/theory/staff'

type ScaleStaffProps = {
  notes: StaffNote[]
  /** The accessible name: degree and note paired, in order (R6). */
  label: string
  /**
   * One label per note, in note order, exactly as `scaleDegrees` returns them
   * (R2, R3). The drawing pairs them by index and draws nothing for an index it
   * has no label for. It does not count, validate or derive: a disagreement
   * between the two arrays is a `lib/` test's business, not the drawing's (AC8).
   */
  degrees: string[]
}

/* ---------------------------------------------------------------------------
   Geometry. These are the drawing's own internals, not spacing anyone else can
   use, so they stay here rather than in the design system's token scale.

   Everything vertical comes off one number. A staff line is a letter, so one
   diatonic step is half the gap between two lines, and every y in the file is
   `yFor(step)`.
   --------------------------------------------------------------------------- */

/** The gap between two ruled lines. One diatonic step is half of it. */
const SPACE = 12
const HALF = SPACE / 2

/** The five lines, named as steps above middle C: E4, G4, B4, D5, F5. */
const BOTTOM_LINE_STEP = 2
const TOP_LINE_STEP = 10
const TOP_LINE_Y = 30

/** The first notehead's centre, and the gap to the next. */
const LEFT = 76
const ADVANCE = 48
/**
 * The extra room a note gets when it lands on the step the note before it
 * used. Only the blues scale does this — C Blues is C E♭ F G♭ G B♭ — and
 * without the extra advance the natural sign in front of the second one has to
 * share the gap with the first one's notehead.
 */
const SHARED_STEP_EXTRA = ADVANCE / 2

const NOTE_RX = 8
const NOTE_RY = 6
/** A notehead is an oval lying at an angle, not a circle. */
const NOTE_TILT = -22
/**
 * These are quarter notes: a filled head with a stem. Feature-11 drew whole
 * notes deliberately — an open head with no stem, on the grounds that a picture
 * of a scale carries no rhythm — and that reading has been overruled: a filled
 * head is what a player recognises as a note, and an open one reads as a
 * half-remembered exercise. The scale still has no rhythm to state; nothing
 * here is beamed, dotted or barred into time.
 *
 * The head has no stroke, so `NOTE_WIDTH` is gone with the outline it drew.
 */
const STEM_WIDTH = 1.7

/**
 * Stem length, in staff spaces — the engraver's default. Measured from the
 * notehead's centre, so a stem crosses three and a half spaces whatever the
 * note's position.
 */
const STEM_SPACES = 3.5

/**
 * The step at which a stem turns over. B4 is the middle line, and a note on or
 * above it takes its stem downwards on the left; below it the stem rises on the
 * right. That is the convention, and it is also what keeps a stem inside the
 * drawing at both extremes.
 */
const STEM_TURNS_AT = 6

/** Where the stem meets the head, as a fraction of the head's radius. */
const STEM_ATTACH = 0.9

const ACCIDENTAL_SIZE = 20
/** Between the glyph's right edge and the notehead it belongs to. */
const ACCIDENTAL_GAP = 4

/**
 * The degree numerals under the staff. Smaller than `ACCIDENTAL_SIZE`, so the
 * row reads as a caption to the notes rather than as a second voice competing
 * with them (R5).
 */
const DEGREE_SIZE = 14
/** One staff space of air between the lowest notehead and the numerals. */
const DEGREE_GAP = SPACE

/** Half a ledger line, measured from the notehead's centre. */
const LEDGER_HALF = 13

/**
 * The lead sheet rules its bar lines with a 1px `border-current/60`. The staff
 * matches it, so the two drawings read as one page rather than as a chart with
 * a diagram pasted under it. `non-scaling-stroke` is what keeps the match
 * exact: the drawing is stretched to whatever width the panel is, and without
 * it the rules would thicken with it while the sheet's borders stayed 1px.
 */
const RULE_WIDTH = 1
const RULE_OPACITY = 0.6
const RULE_EFFECT = 'non-scaling-stroke'

const MARGIN = 3
const PAD_RIGHT = 24

/**
 * The final bar closing the scale: a thin rule and a thick one, the same pair
 * the lead sheet above draws down its right-hand edge. It says the figure has
 * ended rather than run out of room — a staff whose lines simply stop reads as
 * a fragment, and a scale is a complete thing.
 *
 * Ruled between the outer lines only, never through the ledger lines a high or
 * low note needs: a barline belongs to the staff, not to the notes on it.
 */
const FINAL_THICK = 3.4
const FINAL_THIN = 1.4
/** Between the thin rule and the thick one. */
const FINAL_GAP = 4
/** An empty staff still needs a width to rule its lines across. */
const EMPTY_WIDTH = 200

/** Steps above middle C → the y the notehead's centre sits at. */
function yFor(step: number): number {
  return TOP_LINE_Y + (TOP_LINE_STEP - step) * HALF
}

/**
 * The baseline every degree numeral sits on — one number, the same on every
 * day (R1c). It is measured from `STAFF_FLOOR_STEP`, the lowest notehead any
 * scale in the rotation can produce, not from the day's own lowest note: a row
 * that rose and fell with the scale would move the panel's bottom edge from one
 * day to the next for no reason a player could see (R1e).
 */
const DEGREE_Y = yFor(STAFF_FLOOR_STEP) + NOTE_RY + DEGREE_GAP + DEGREE_SIZE / 2

/**
 * Derived, not chosen: the drawing is as tall as it needs to be to hold the
 * degree row. The staff lines, the clef and every notehead keep the y they
 * have — the drawing grows downward.
 */
const HEIGHT = DEGREE_Y + DEGREE_SIZE / 2 + MARGIN

/**
 * The treble clef: the G clef of Bravura, Steinberg's reference engraving font
 * (SMuFL U+E050) — © Steinberg Media Technologies GmbH, SIL Open Font License
 * 1.1, github.com/steinbergmedia/bravura. What ships is the glyph's outline as
 * coordinates, not the font: nothing is fetched at runtime, no face is loaded,
 * and the drawing cannot shift under us when a font updates.
 *
 * This is the third answer to the same question and worth recording, because the
 * first two were reasonable. Feature-11 drew the clef by hand as one
 * even-weight stroke, and its reasoning still holds for anything hand-placed: an
 * outline "wants a thick-thin axis held consistently around every turn, and
 * offsetting a hand-placed spine to fake one is what makes a clef look
 * scribbled". Feature-15 then generated an outline from a centreline carrying a
 * width profile, which fixed the axis — it is perpendicular to the curve by
 * construction — and still read as a stylised clef rather than a normal one. A
 * clef is not a place to have a house style: it is a glyph a player has read
 * ten thousand times, and anything but the expected shape reads as a mistake.
 *
 * `specs/feature-15/clef-glyph.py` is the extraction, and re-running it
 * reproduces this string exactly.
 *
 * Stated in a box where a staff space is 16 and the G line is y=112 — the units
 * SMuFL states the glyph in, scaled once. `CLEF_PLACEMENT` is the only thing
 * that maps it onto this staff, so changing the staff's size cannot distort the
 * artwork: the path data never moves.
 */
const CLEF_PATH =
  'M24.06 85.44C23.94 84.67 24.06 84.61 24.45 84.22C25.47 83.26 26.82 81.92 28.03 80.58C33.41 74.69 36.61 67.07 36.61 59.84C36.61 54.27 35.07 48.77 32.45 44.93C31.49 43.52 29.82 41.73 29.12 41.73C28.22 41.73 26.24 43.39 24.96 44.80C20.22 50.05 18.69 58.05 18.69 64.70C18.69 68.42 19.14 72.58 19.58 75.20C19.71 75.97 19.78 76.10 19.01 76.74C14.91 80.13 10.50 84.03 7.17 88.13C2.75 93.63 0.00 99.58 0.00 106.43C0.00 117.57 7.62 128.13 23.30 128.13C24.77 128.13 26.43 128.00 27.71 127.74C28.42 127.62 28.54 127.55 28.67 128.32C29.44 132.61 30.40 138.18 30.40 141.18C30.40 150.66 24.00 151.81 20.22 151.81C16.77 151.81 15.10 150.78 15.10 149.95C15.10 149.50 15.68 149.31 17.15 148.86C19.14 148.29 21.44 146.56 21.44 142.85C21.44 139.33 19.20 136.32 15.30 136.32C11.01 136.32 8.45 139.71 8.45 143.68C8.45 147.84 10.94 154.11 20.61 154.11C24.90 154.11 33.22 152.19 33.22 141.31C33.22 137.66 32.06 131.58 31.36 127.62C31.23 126.85 31.30 126.91 32.19 126.53C38.66 123.97 42.94 118.53 42.94 111.30C42.94 103.10 36.93 95.87 27.52 95.87C25.86 95.87 25.86 95.87 25.66 94.72ZM30.08 51.65C32.19 51.65 33.92 53.38 33.92 56.90C33.92 61.31 31.81 65.41 26.82 70.40C25.79 71.42 24.26 72.90 22.78 74.18C22.34 74.56 22.08 74.50 21.95 73.66C21.70 72.00 21.57 69.82 21.57 67.78C21.57 57.79 26.18 51.65 30.08 51.65ZM23.10 95.23C23.30 96.45 23.30 96.38 22.14 96.77C16.51 98.69 12.86 103.74 12.86 109.18C12.86 114.94 15.87 119.04 20.22 120.51C20.74 120.70 21.50 120.90 21.95 120.90C22.46 120.90 22.72 120.58 22.72 120.19C22.72 119.74 22.21 119.55 21.76 119.36C19.07 118.21 17.15 115.46 17.15 112.51C17.15 108.86 19.65 106.11 23.55 105.02C24.58 104.77 24.70 104.83 24.83 105.54L28.03 124.61C28.16 125.31 28.10 125.31 27.14 125.50C26.11 125.70 24.83 125.82 23.55 125.82C12.35 125.82 5.12 119.62 5.12 110.72C5.12 106.94 5.76 101.89 11.07 95.87C14.91 91.58 17.86 89.22 20.86 86.78C21.50 86.27 21.63 86.34 21.76 87.04ZM27.52 105.41C27.39 104.64 27.46 104.45 28.22 104.51C33.41 104.96 37.70 109.31 37.70 114.94C37.70 118.98 35.26 122.24 31.68 124.03C30.91 124.42 30.78 124.42 30.66 123.65Z'

const CLEF_SCALE = SPACE / 16
const CLEF_PLACEMENT = `translate(2 ${yFor(4) - 112 * CLEF_SCALE}) scale(${CLEF_SCALE})`

/** The five ruled lines, as steps: E4, G4, B4, D5, F5. */
const LINE_STEPS = [2, 4, 6, 8, 10]

/**
 * The line positions a note needs ruled in for it, because they are outside
 * the staff. A note in the space just above the top line needs none; a note on
 * the next line up needs that one line; a note above that needs both.
 */
function ledgerSteps(step: number): number[] {
  const steps: number[] = []
  for (let s = TOP_LINE_STEP + 2; s <= step; s += 2) steps.push(s)
  for (let s = BOTTOM_LINE_STEP - 2; s >= step; s -= 2) steps.push(s)
  return steps
}

/**
 * Where each notehead's centre falls. A note sharing the step of the one
 * before it is pushed an extra half-advance to the right, which is what leaves
 * room for its accidental to be read as belonging to it rather than to its
 * neighbour.
 */
function centres(notes: StaffNote[]): number[] {
  let x = LEFT
  return notes.map((note, i) => {
    if (i > 0) {
      x += ADVANCE
      if (notes[i - 1].step === note.step) x += SHARED_STEP_EXTRA
    }
    return x
  })
}

/**
 * The day's scale, drawn: five ruled lines, a treble clef, and one quarter note
 * per note ascending from the root — a filled head with a stem — with `♯ ♭ ♮` in
 * front of the notes that carry them, and a final bar closing the figure.
 *
 * No rhythm, still: nothing is beamed, dotted or barred into time, and the notes
 * are evenly spaced whatever their value would imply. A stem is not rhythm — it
 * is what makes a notehead read as a note to someone who does not read fluently,
 * which is the player this is drawn for.
 *
 * Under the staff runs a row of degree numbers, one per note, each on its own
 * notehead's x. Those arrive as `degrees`, in note order — the drawing pairs
 * them by index and never counts `1..7` (R2, R3).
 *
 * It derives nothing. `staffNotes` has already turned the spelled names into
 * steps and glyphs, so the drawing is arithmetic on `step` and nothing else:
 * every y in the file is `yFor(step)`, and every x is the note's place in the
 * row.
 *
 * It sets no colour. The staff is read on the panel's inverted accent surface,
 * so stroke and fill are `currentColor` and the ink flips with the palette
 * It is drawn at its natural size, not stretched. `width`/`height` in the
 * viewBox's own units make one unit one pixel, so a staff space is `SPACE` on
 * screen whatever the panel is doing — a staff blown up to the full width of a
 * card reads as a diagram of a staff rather than as notation, and the same
 * scale every day is what lets one day's shape be compared with another's.
 * `max-w-full h-auto` is what still fits it on a phone: below its natural width
 * the drawing scales down as a whole rather than overflowing (R10).
 */
export function ScaleStaff({ notes, label, degrees }: ScaleStaffProps) {
  const xs = centres(notes)
  const width =
    notes.length === 0 ? EMPTY_WIDTH : xs[xs.length - 1] + NOTE_RX + PAD_RIGHT
  // The thick rule sits inside the right margin; the thin one leads it.
  const finalX = width - MARGIN - FINAL_THICK
  const finalThinX = finalX - FINAL_GAP

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width={width}
      height={HEIGHT}
      className="max-w-full h-auto"
    >
      {LINE_STEPS.map((step) => (
        <line
          key={step}
          data-testid="staff-line"
          x1={MARGIN}
          y1={yFor(step)}
          x2={finalX + FINAL_THICK}
          y2={yFor(step)}
          stroke="currentColor"
          strokeOpacity={RULE_OPACITY}
          strokeWidth={RULE_WIDTH}
          vectorEffect={RULE_EFFECT}
        />
      ))}

      <path
        data-testid="clef"
        d={CLEF_PATH}
        transform={CLEF_PLACEMENT}
        fill="currentColor"
      />

      {notes.map((note, i) => {
        const cx = xs[i]
        const cy = yFor(note.step)
        const stemUp = note.step < STEM_TURNS_AT
        const stemX = cx + (stemUp ? 1 : -1) * NOTE_RX * STEM_ATTACH
        const stemY = cy + (stemUp ? -1 : 1) * STEM_SPACES * SPACE

        return (
          <g key={i}>
            {ledgerSteps(note.step).map((step) => (
              <line
                key={step}
                data-testid="ledger"
                x1={cx - LEDGER_HALF}
                y1={yFor(step)}
                x2={cx + LEDGER_HALF}
                y2={yFor(step)}
                stroke="currentColor"
                strokeOpacity={RULE_OPACITY}
                strokeWidth={RULE_WIDTH}
                vectorEffect={RULE_EFFECT}
              />
            ))}

            {note.accidental !== '' && (
              <text
                data-testid="accidental"
                // Anchored at its right-hand edge, so the glyph sits against
                // its notehead however wide the face draws it — and a double
                // accidental grows leftwards into the gap rather than into the
                // note.
                x={cx - NOTE_RX - ACCIDENTAL_GAP}
                y={cy}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={ACCIDENTAL_SIZE}
                fill="currentColor"
                className="font-jazz"
              >
                {note.accidental}
              </text>
            )}

            <ellipse
              data-testid="notehead"
              cx={cx}
              cy={cy}
              rx={NOTE_RX}
              ry={NOTE_RY}
              transform={`rotate(${NOTE_TILT} ${cx} ${cy})`}
              fill="currentColor"
            />

            {/*
              The stem. Up on the right below the middle line, down on the left
              on it and above — the convention, and also what keeps a stem
              inside the drawing at both ends of the range.
            */}
            <line
              data-testid="stem"
              x1={stemX}
              y1={cy}
              x2={stemX}
              y2={stemY}
              stroke="currentColor"
              strokeWidth={STEM_WIDTH}
              strokeLinecap="round"
            />
          </g>
        )
      })}

      {notes.length > 0 && (
        <g data-testid="final-bar">
          <line
            x1={finalThinX}
            y1={yFor(TOP_LINE_STEP)}
            x2={finalThinX}
            y2={yFor(BOTTOM_LINE_STEP)}
            stroke="currentColor"
            strokeWidth={FINAL_THIN}
            vectorEffect={RULE_EFFECT}
          />
          <rect
            x={finalX}
            y={yFor(TOP_LINE_STEP)}
            width={FINAL_THICK}
            height={yFor(BOTTOM_LINE_STEP) - yFor(TOP_LINE_STEP)}
            fill="currentColor"
          />
        </g>
      )}

      {/*
        Last in the SVG on purpose: the last sibling paints last, so a numeral
        that meets a ledger line is drawn over it rather than under it (R1d).
        Moving this group up the JSX changes the drawing.
      */}
      <g data-testid="degrees">
        {notes.map((_, i) =>
          degrees[i] === undefined ? null : (
            <text
              key={i}
              data-testid="degree"
              // The notehead's own x, taken from the same `centres` array the
              // noteheads are placed from, so a number cannot drift out of
              // step with its note (R1a).
              x={xs[i]}
              y={DEGREE_Y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={DEGREE_SIZE}
              fill="currentColor"
              className="font-jazz"
            >
              {degrees[i]}
            </text>
          ),
        )}
      </g>
    </svg>
  )
}
