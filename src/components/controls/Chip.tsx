'use client'

type ChipTone = 'default' | 'inverted'

type ChipProps = {
  label: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
  tone?: ChipTone
  adornment?: string
}

const BASE =
  'inline-flex cursor-pointer items-center justify-center rounded-chip border px-[15px] py-[9px] text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default'

const IDLE =
  'border-border-strong bg-surface text-text hover:bg-surface-inset disabled:opacity-60'

const SELECTED = 'border-accent bg-accent text-on-accent hover:bg-accent-hover'

const INVERTED_IDLE =
  'border-on-accent/20 bg-on-accent/10 text-on-accent hover:bg-on-accent/20'

const INVERTED_SELECTED =
  'border-on-accent/45 bg-on-accent/25 text-on-accent hover:bg-paper-tint/30'

const ADORNMENT = 'mr-[5px]'

const TONE: Record<ChipTone, { idle: string; selected: string }> = {
  default: { idle: IDLE, selected: SELECTED },
  inverted: { idle: INVERTED_IDLE, selected: INVERTED_SELECTED },
}

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
