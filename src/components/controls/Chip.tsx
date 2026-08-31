'use client'

type ChipTone = 'default' | 'inverted'

type ChipProps = {
  label: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
  tone?: ChipTone
  /** Decorative glyph rendered before the label, hidden from assistive tech. */
  adornment?: string
}

// The chip carries its own padding and nothing else about its size: the row it
// sits in is a grid, so the cell decides how wide the chip is.
const BASE =
  'inline-flex cursor-pointer items-center justify-center rounded-chip border px-[15px] py-[9px] text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default'

// A locked idle chip recedes; a locked selected chip stays fully legible,
// because it is the answer the player is looking at.
const IDLE =
  'border-border-strong bg-surface text-text hover:bg-surface-inset disabled:opacity-60'

const SELECTED = 'border-accent bg-accent text-on-accent hover:bg-accent-hover'

// The inverted tone is the treatment for an inverted surface: the light paper
// token at low alpha, so the chip lifts off whatever the surface is painted
// with. It carries no disabled fade — an inverted chip is usually a locked
// read-only value, and it has to stay fully legible.
const INVERTED_IDLE =
  'border-on-accent/20 bg-on-accent/10 text-on-accent hover:bg-on-accent/20'

const INVERTED_SELECTED =
  'border-on-accent/45 bg-on-accent/25 text-on-accent hover:bg-paper-tint/30'

// Spacing only. The adornment takes the chip's own ink through `currentColor`,
// so it stays legible in every tone and state without naming a palette token —
// and it carries no line-height of its own, so it cannot grow the chip.
const ADORNMENT = 'mr-[5px]'

const TONE: Record<ChipTone, { idle: string; selected: string }> = {
  default: { idle: IDLE, selected: SELECTED },
  inverted: { idle: INVERTED_IDLE, selected: INVERTED_SELECTED },
}

/**
 * A single-choice pill. It is a toggle button reporting its state through
 * `aria-pressed` rather than a native radio, so the pressed and idle
 * treatments are free of the input's own styling constraints.
 *
 * `tone` picks the surface the chip is drawn for: `default` on paper, and
 * `inverted` on an inverted panel.
 *
 * `adornment` is an optional decorative string drawn before the label. It is
 * hidden from assistive technology, so the chip's accessible name stays its
 * label alone. What the mark means is the caller's business — the chip only
 * knows where to put it.
 *
 * It takes no width. A chip stretches to the grid cell it is placed in, and
 * hugs its label in a flex row — which is what its caller's layout is for.
 */
export function Chip({
  label,
  selected,
  disabled,
  onSelect,
  tone = 'default',
  adornment,
}: ChipProps) {
  const palette = TONE[tone]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`${BASE} ${selected ? palette.selected : palette.idle}`}
    >
      {adornment && (
        <span aria-hidden="true" className={ADORNMENT}>
          {adornment}
        </span>
      )}
      {label}
    </button>
  )
}
