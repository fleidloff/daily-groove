'use client'

type ModeToggleProps = {
  /** Whether simple mode is on. The prop is the only truth (R8a). */
  simple: boolean
  /** Asked for the state the player wants, not the one they are leaving. */
  onChange(simple: boolean): void
}

/**
 * The switch at the top of the guess card that narrows the puzzle (R1).
 *
 * A `role="switch"` rather than a two-chip row: simple mode is a binary
 * preference, not a choice among options, and a switch is what says that to a
 * screen reader. A native `<button>` underneath, so it is in the tab order and
 * answers to both space and enter without a keydown handler of its own (R11).
 *
 * It holds no state. The card is handed `simple` and hands back what was asked
 * for, which is what keeps the preference in one place — switching is never
 * itself an attempt, and the control is never locked by having guessed (R8a).
 *
 * It names no mode. In simple mode nothing on the card may read as one of the
 * six, and the switch sits directly above the row that replaces them (R4).
 */
export function ModeToggle({ simple, onChange }: ModeToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={simple}
      onClick={() => onChange(!simple)}
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-control border border-border bg-surface-inset px-4 py-[11px] text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="text-[14px] leading-[1.4] text-text-muted">
        Simple mode
      </span>

      {/*
        Decoration only: the state a screen reader reads is `aria-checked` on
        the button itself, so the track is hidden rather than announced twice.
      */}
      <span
        aria-hidden="true"
        className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors ${
          simple ? 'bg-accent' : 'bg-border-strong'
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-surface transition-[left] ${
            simple ? 'left-[21px]' : 'left-[3px]'
          }`}
        />
      </span>
    </button>
  )
}
