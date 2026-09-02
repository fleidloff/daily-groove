'use client'

type HelpToggleProps = {
  onShow: () => void
}

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
