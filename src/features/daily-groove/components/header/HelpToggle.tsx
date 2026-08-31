'use client'

type HelpToggleProps = {
  /**
   * Asked for the box to be shown. Never a toggle: the box carries its own
   * close control, and a question mark that hides things is a surprise (R8).
   */
  onShow: () => void
}

/**
 * The question mark at the end of the subtitle that brings the how-to-play box
 * back — whether it was never shown, closed by the player, or withheld because
 * they are a regular (R8, R10).
 *
 * Inline: it is rendered inside the tagline's own paragraph, so `align-middle`
 * seats it against the text it follows rather than on the baseline.
 *
 * A native `<button>`, so it is in the tab order and answers to both space and
 * enter without a keydown handler of its own; a `<span onClick>` would look
 * identical and be unreachable by keyboard (R9). The glyph is decoration that
 * happens to be text, so the name comes from `aria-label` rather than from a
 * screen reader spelling out "question mark".
 *
 * Not the design system's `Button`, which is the page's full-width call to
 * action. This is a small round control with its own geometry, as `ModeToggle`
 * is.
 */
export function HelpToggle({ onShow }: HelpToggleProps) {
  return (
    <button
      type="button"
      aria-label="How to play"
      onClick={onShow}
      className="inline-flex h-[22px] w-[22px] shrink-0 cursor-pointer align-middle items-center justify-center rounded-full border border-border bg-surface-inset text-[13px] leading-none text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      ?
    </button>
  )
}
