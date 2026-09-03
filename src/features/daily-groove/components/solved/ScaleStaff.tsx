import { STAFF_FLOOR_STEP, type StaffNote } from '@/lib/theory/staff'

type ScaleStaffProps = {
  notes: StaffNote[]
  label: string
  degrees: string[]
}

const SPACE = 12
const HALF = SPACE / 2

const BOTTOM_LINE_STEP = 2
const TOP_LINE_STEP = 10
const TOP_LINE_Y = 30

const LEFT = 76
const ADVANCE = 48
const SHARED_STEP_EXTRA = ADVANCE / 2

const NOTE_RX = 8
const NOTE_RY = 6
const NOTE_TILT = -22
const STEM_WIDTH = 1.7

const STEM_SPACES = 3.5

const STEM_TURNS_AT = 6

const STEM_ATTACH = 0.9

const ACCIDENTAL_SIZE = 20
const ACCIDENTAL_GAP = 4

const DEGREE_SIZE = 14
const DEGREE_GAP = SPACE

const LEDGER_HALF = 13

const RULE_WIDTH = 1
const RULE_OPACITY = 0.6
const RULE_EFFECT = 'non-scaling-stroke'

const MARGIN = 3
const PAD_RIGHT = 24

const FINAL_THICK = 3.4
const FINAL_THIN = 1.4
const FINAL_GAP = 4
const EMPTY_WIDTH = 200

function yFor(step: number): number {
  return TOP_LINE_Y + (TOP_LINE_STEP - step) * HALF
}

const DEGREE_Y = yFor(STAFF_FLOOR_STEP) + NOTE_RY + DEGREE_GAP + DEGREE_SIZE / 2

const HEIGHT = DEGREE_Y + DEGREE_SIZE / 2 + MARGIN

const CLEF_PATH =
  'M24.06 85.44C23.94 84.67 24.06 84.61 24.45 84.22C25.47 83.26 26.82 81.92 28.03 80.58C33.41 74.69 36.61 67.07 36.61 59.84C36.61 54.27 35.07 48.77 32.45 44.93C31.49 43.52 29.82 41.73 29.12 41.73C28.22 41.73 26.24 43.39 24.96 44.80C20.22 50.05 18.69 58.05 18.69 64.70C18.69 68.42 19.14 72.58 19.58 75.20C19.71 75.97 19.78 76.10 19.01 76.74C14.91 80.13 10.50 84.03 7.17 88.13C2.75 93.63 0.00 99.58 0.00 106.43C0.00 117.57 7.62 128.13 23.30 128.13C24.77 128.13 26.43 128.00 27.71 127.74C28.42 127.62 28.54 127.55 28.67 128.32C29.44 132.61 30.40 138.18 30.40 141.18C30.40 150.66 24.00 151.81 20.22 151.81C16.77 151.81 15.10 150.78 15.10 149.95C15.10 149.50 15.68 149.31 17.15 148.86C19.14 148.29 21.44 146.56 21.44 142.85C21.44 139.33 19.20 136.32 15.30 136.32C11.01 136.32 8.45 139.71 8.45 143.68C8.45 147.84 10.94 154.11 20.61 154.11C24.90 154.11 33.22 152.19 33.22 141.31C33.22 137.66 32.06 131.58 31.36 127.62C31.23 126.85 31.30 126.91 32.19 126.53C38.66 123.97 42.94 118.53 42.94 111.30C42.94 103.10 36.93 95.87 27.52 95.87C25.86 95.87 25.86 95.87 25.66 94.72ZM30.08 51.65C32.19 51.65 33.92 53.38 33.92 56.90C33.92 61.31 31.81 65.41 26.82 70.40C25.79 71.42 24.26 72.90 22.78 74.18C22.34 74.56 22.08 74.50 21.95 73.66C21.70 72.00 21.57 69.82 21.57 67.78C21.57 57.79 26.18 51.65 30.08 51.65ZM23.10 95.23C23.30 96.45 23.30 96.38 22.14 96.77C16.51 98.69 12.86 103.74 12.86 109.18C12.86 114.94 15.87 119.04 20.22 120.51C20.74 120.70 21.50 120.90 21.95 120.90C22.46 120.90 22.72 120.58 22.72 120.19C22.72 119.74 22.21 119.55 21.76 119.36C19.07 118.21 17.15 115.46 17.15 112.51C17.15 108.86 19.65 106.11 23.55 105.02C24.58 104.77 24.70 104.83 24.83 105.54L28.03 124.61C28.16 125.31 28.10 125.31 27.14 125.50C26.11 125.70 24.83 125.82 23.55 125.82C12.35 125.82 5.12 119.62 5.12 110.72C5.12 106.94 5.76 101.89 11.07 95.87C14.91 91.58 17.86 89.22 20.86 86.78C21.50 86.27 21.63 86.34 21.76 87.04ZM27.52 105.41C27.39 104.64 27.46 104.45 28.22 104.51C33.41 104.96 37.70 109.31 37.70 114.94C37.70 118.98 35.26 122.24 31.68 124.03C30.91 124.42 30.78 124.42 30.66 123.65Z'

const CLEF_SCALE = SPACE / 16
const CLEF_PLACEMENT = `translate(2 ${yFor(4) - 112 * CLEF_SCALE}) scale(${CLEF_SCALE})`

const LINE_STEPS = [2, 4, 6, 8, 10]

function ledgerSteps(step: number): number[] {
  const steps: number[] = []
  for (let s = TOP_LINE_STEP + 2; s <= step; s += 2) steps.push(s)
  for (let s = BOTTOM_LINE_STEP - 2; s >= step; s -= 2) steps.push(s)
  return steps
}

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

export function ScaleStaff({ notes, label, degrees }: ScaleStaffProps) {
  const xs = centres(notes)
  const width =
    notes.length === 0 ? EMPTY_WIDTH : xs[xs.length - 1] + NOTE_RX + PAD_RIGHT
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

      <g data-testid="degrees">
        {notes.map((_, i) =>
          degrees[i] === undefined ? null : (
            <text
              key={i}
              data-testid="degree"
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
