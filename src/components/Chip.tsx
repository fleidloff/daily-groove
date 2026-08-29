'use client'

type ChipWidth = 'auto' | 'fixed'
type ChipTone = 'default' | 'inverted'

type ChipProps = {
  label: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
  width?: ChipWidth
  tone?: ChipTone
}

const BASE =
  'inline-flex cursor-pointer items-center justify-center rounded-chip border py-[9px] text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default'

// Fixed-width chips line up in a grid-like row; auto chips hug their label.
const WIDTH: Record<ChipWidth, string> = {
  auto: 'px-[15px]',
  fixed: 'w-[60px] px-0',
}

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
 */
export function Chip({
  label,
  selected,
  disabled,
  onSelect,
  width = 'auto',
  tone = 'default',
}: ChipProps) {
  const palette = TONE[tone]

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`${BASE} ${WIDTH[width]} ${selected ? palette.selected : palette.idle}`}
    >
      {label}
    </button>
  )
}
