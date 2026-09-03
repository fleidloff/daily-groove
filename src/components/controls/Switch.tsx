"use client";

import { useId } from "react";

type SwitchProps = {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  description?: string;
};

export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  description,
}: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-inset px-4 py-[11px] text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        disabled ? "opacity-60" : "cursor-pointer hover:border-border-strong"
      }`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          id={labelId}
          className="text-[14px] leading-[1.4] text-text-muted"
        >
          {label}
        </span>
        {description !== undefined && (
          <span
            id={descriptionId}
            className="text-[12px] leading-[1.4] text-text-faint"
          >
            {description}
          </span>
        )}
      </span>

      <span
        aria-hidden="true"
        className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-border-strong"
        }`}
      >
        <span
          className={`absolute top-[3px] h-4 w-4 rounded-full bg-surface transition-[left] ${
            checked ? "left-[21px]" : "left-[3px]"
          }`}
        />
      </span>
    </button>
  );
}
