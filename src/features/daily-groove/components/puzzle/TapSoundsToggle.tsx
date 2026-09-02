'use client'

import { Switch } from '@/components/controls/Switch'

type TapSoundsToggleProps = {
  /** Whether tapping a chip sounds. The prop is the only truth. */
  on: boolean
  /** Asked for the state the player wants, not the one they are leaving. */
  onChange(on: boolean): void
}

/**
 * The second switch on the guess card: whether tapping a chip makes a sound
 * (R1).
 *
 * What it governs is the noise a *chip* makes — a root's reference note, a
 * mode's lick — and nothing else. It is not a mute over the groove: the band
 * keeps playing, at the same position, and the play control is how it is
 * silenced (R6). Sam plays on the bus, and an app that can only be quietened
 * by silencing the phone is an app that gets closed instead.
 *
 * It renders `Switch`, so it is the simple-mode toggle with different words —
 * same shape, same alignment, same treatment (R14).
 *
 * **It takes no `disabled`, deliberately.** The mode toggle above it settles
 * when the day ends, because the mode is a record of how the day was played.
 * This is a durable preference instead, and the guess card is the only place
 * it can be changed, so it stays live for the whole day (R5a). A prop that
 * does not exist cannot be wired up by a later edit, which is why the rule is
 * structural here rather than a default of `false`.
 */
export function TapSoundsToggle({ on, onChange }: TapSoundsToggleProps) {
  return <Switch label="Tap sounds" checked={on} onChange={onChange} />
}
