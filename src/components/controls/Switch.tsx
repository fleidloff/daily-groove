'use client'

type SwitchProps = {
  /** The visible words, and the control's accessible name. */
  label: string
  /** Whether the switch is on. The prop is the only truth. */
  checked: boolean
  /** Asked for the state the caller wants, not the one it is leaving. */
  onChange(checked: boolean): void
  /**
   * Settled: the browser declines the click, the key press and the focus
   * alike, so the control still says which way it is set without offering to
   * change it.
   */
  disabled?: boolean
}

/**
 * A labelled on/off switch: words on the left, a track on the right.
 *
 * A `role="switch"` rather than a pair of buttons: this is a binary setting,
 * not a choice among options, and a switch is what says that to a screen
 * reader. A native `<button>` underneath, so it is in the tab order and answers
 * to both space and enter without a keydown handler of its own.
 *
 * It holds no state. It is handed `checked` and hands back what was asked for,
 * which keeps the value in exactly one place — its caller's.
 *
 * Deliberately one shape: no size, no tone, no id. Every caller wants the same
 * control with different words, and a knob nobody turns is a knob that drifts.
 */
export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      // A settled switch stops offering the affordances of a live control: no
      // pointer cursor, no hover treatment, and dimmed. The focus-visible
      // outline stays in the string either way — a disabled button never takes
      // focus, so it costs nothing and stays correct if the prop is ever
      // removed.
      className={`flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-inset px-4 py-[11px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        disabled ? 'opacity-60' : 'cursor-pointer hover:border-border-strong'
      }`}
    >
      <span className="text-[14px] leading-[1.4] text-text-muted">{label}</span>

      {/*
        Decoration only: the state a screen reader reads is `aria-checked` on
        the button itself, so the track is hidden rather than announced twice.
      */}
      <span
        aria-hidden="true"
        className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-border-strong'
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-surface transition-[left] ${
            checked ? 'left-[21px]' : 'left-[3px]'
          }`}
        />
      </span>
    </button>
  )
}
