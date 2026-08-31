import type { StaffNote } from '../../lib/theory/staff'

type ScaleStaffProps = {
  notes: StaffNote[]
  /** The accessible name: the note names, in order. */
  label: string
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
 * These are whole notes, so the head is open — an outline, not a filled oval.
 * A filled head with no stem is a different note value, and on a page that
 * carries no rhythm at all the lighter shape is also what keeps seven of them
 * from reading as heavier than the staff they sit on.
 */
const NOTE_WIDTH = 2.5

const ACCIDENTAL_SIZE = 20
/** Between the glyph's right edge and the notehead it belongs to. */
const ACCIDENTAL_GAP = 4

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
const HEIGHT = 110
/** An empty staff still needs a width to rule its lines across. */
const EMPTY_WIDTH = 200

/** Steps above middle C → the y the notehead's centre sits at. */
function yFor(step: number): number {
  return TOP_LINE_Y + (TOP_LINE_STEP - step) * HALF
}

/**
 * The treble clef, drawn once as artwork and never re-derived: one continuous
 * stroke, the way the glyph is actually written. It starts at the tail below
 * the staff, rises through the spine, turns over at the top, comes back down
 * the loop, crosses the spine and sweeps round the bowl into the spiral, which
 * ends on the G line. No font behind it and no glyph metrics deciding where it
 * sits.
 *
 * An even-weight stroke rather than a filled outline. A calligraphic outline
 * wants a thick-thin axis held consistently around every turn, and offsetting a
 * hand-placed spine to fake one is what makes a clef look scribbled; a single
 * round-capped stroke has no axis to get wrong, and it sits beside the app's
 * hand-lettered face rather than competing with an engraver's.
 *
 * Drawn against its own box where a staff space is 16 and the G line is y=112,
 * so the shape is stated in the units it was designed in. `CLEF_PLACEMENT` is
 * the only thing that maps it onto this staff — changing the staff's size
 * cannot silently distort the artwork, because the path data never moves.
 */
const CLEF_PATH =
  'M 15 144 C 24 150, 32 145, 34 134 C 37 114, 36 96, 34 84 C 31 70, 23 63, 24 55 C 25 46, 32 42, 37 48 C 42 54, 41 68, 36 78 C 31 88, 24 96, 17 102 C 9 110, 8 122, 15 130 C 23 139, 38 138, 45 128 C 51 119, 48 106, 39 101 C 31 97, 25 103, 26 111'

/** The stroke that draws it, in the clef's own units. */
const CLEF_WIDTH = 5.5

/**
 * Its box has a staff space of 16 and this one has `SPACE`, so the scale is the
 * ratio between them; the translate then drops the spiral's centre onto the G
 * line — `yFor(4)`, the second line up.
 */
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
 * The day's scale, drawn: five ruled lines, a treble clef, and one notehead per
 * note ascending from the root, with `♯ ♭ ♮` in front of the notes that carry
 * them. No stems, no bar lines, no rhythm — this is a picture of a scale, not a
 * transcription.
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
export function ScaleStaff({ notes, label }: ScaleStaffProps) {
  const xs = centres(notes)
  const width =
    notes.length === 0 ? EMPTY_WIDTH : xs[xs.length - 1] + NOTE_RX + PAD_RIGHT

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
          x2={width - MARGIN}
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
        fill="none"
        stroke="currentColor"
        strokeWidth={CLEF_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {notes.map((note, i) => {
        const cx = xs[i]
        const cy = yFor(note.step)

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
              fill="none"
              stroke="currentColor"
              strokeWidth={NOTE_WIDTH}
            />
          </g>
        )
      })}
    </svg>
  )
}
