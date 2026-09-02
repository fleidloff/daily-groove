'use client'

type SwitchProps = {
  label: string
  checked: boolean
  onChange(checked: boolean): void
  disabled?: boolean
}

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
      className={`flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-inset px-4 py-[11px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        disabled ? 'opacity-60' : 'cursor-pointer hover:border-border-strong'
      }`}
    >
      <span className="text-[14px] leading-[1.4] text-text-muted">{label}</span>

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
