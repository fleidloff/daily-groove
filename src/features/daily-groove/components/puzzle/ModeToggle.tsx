'use client'

import { Switch } from '@/components/controls/Switch'

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
 * It renders `Switch`, so it is one of the two preference switches the card
 * carries rather than a treatment of its own (F16 E2 R14). Why the control is
 * a `role="switch"` on a native button, and why the track is decoration, lives
 * in that primitive's docstring; what is left here is the domain reasoning.
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
 * R1a, R4). That is the half `TapSoundsToggle` beneath it deliberately does not
 * have: the mode is a record of the day, the tap sounds are a setting.
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
    <Switch
      label="Simple mode"
      checked={simple}
      onChange={onChange}
      disabled={disabled}
    />
  )
}
