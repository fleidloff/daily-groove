'use client'

type ModeToggleProps = {
  /** Whether simple mode is on. The prop is the only truth (R8a). */
  simple: boolean
  /** Asked for the state the player wants, not the one they are leaving. */
  onChange(simple: boolean): void
  /**
   * The day is over. The switch keeps its position and stops responding — the
   * mode is a record of how the day was played, not a control any more
   * (F11 E4 R1).
   */
  disabled?: boolean
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
 * itself an attempt.
 *
 * The switch stays operable for the whole *playable* day: it is never locked by
 * having guessed, however many attempts are spent (R8a, narrowed by F11 E4 R3).
 * It settles once the day ends — `disabled` is set, and the browser declines
 * the click, the key press and the focus alike, so the finished card still says
 * which mode the day was played in without offering to change it (F11 E4 R1,
 * R1a, R4).
 *
 * It names no mode. In simple mode nothing on the card may read as one of the
 * six, and the switch sits directly above the row that replaces them (R4).
 */
export function ModeToggle({
  simple,
  onChange,
  disabled = false,
}: ModeToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={simple}
      disabled={disabled}
      onClick={() => onChange(!simple)}
      // A settled switch stops offering the affordances of a live control: no
      // pointer cursor, no hover treatment, and dimmed the way the locked chips
      // beneath it already are (F11 E4 R6). The focus-visible outline stays in
      // the string either way — a disabled button never takes focus, so it
      // costs nothing and stays correct if the prop is ever removed.
      className={`flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-inset px-4 py-[11px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        disabled ? 'opacity-60' : 'cursor-pointer hover:border-border-strong'
      }`}
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
