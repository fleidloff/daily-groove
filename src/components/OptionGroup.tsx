'use client'

type OptionGroupProps = {
  options: string[]
  value: string | null
  onChange: (v: string) => void
  disabled?: boolean
  name: string
}

/**
 * Generic single-select radio group. Prop-driven and free of any feature or
 * domain knowledge.
 */
export function OptionGroup({ options, value, onChange, disabled = false, name }: OptionGroupProps) {
  return (
    <div role="radiogroup">
      {options.map((option) => (
        <label key={option}>
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            disabled={disabled}
            onChange={() => onChange(option)}
          />
          {option}
        </label>
      ))}
    </div>
  )
}
