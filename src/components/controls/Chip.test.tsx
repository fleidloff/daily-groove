import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from './Chip'

const NOTE = '♪'

describe('Chip', () => {
  it('renders its label as a button', () => {
    render(<Chip label="Alpha" selected={false} disabled={false} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('is a type="button" so it never submits a form', () => {
    render(<Chip label="Alpha" selected={false} disabled={false} onSelect={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('calls onSelect once when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Chip label="Alpha" selected={false} disabled={false} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Alpha' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('reports its selection through aria-pressed', () => {
    const { rerender } = render(
      <Chip label="Alpha" selected={false} disabled={false} onSelect={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    rerender(<Chip label="Alpha" selected disabled={false} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('does not call onSelect while disabled', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Chip label="Alpha" selected={false} disabled onSelect={onSelect} />)

    const chip = screen.getByRole('button', { name: 'Alpha' })
    expect(chip).toBeDisabled()
    await user.click(chip)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('draws idle and selected differently', () => {
    const idle = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const selected = render(
      <Chip label="A" selected disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement

    expect(idle.className).not.toBe(selected.className)
    expect(idle.className).toContain('border-border-strong')
    expect(selected.className).toContain('bg-accent')
  })

  it('leaves its width to the cell it sits in (R6, AC7)', () => {
    const chip = render(
      <Chip label="C" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement

    expect(chip.className).not.toContain('w-[60px]')
    expect(chip.className).not.toMatch(/\bpx-0\b/)
    expect(chip.className).not.toMatch(/\bw-\[/)
  })

  it('declares no width prop (R6, AC7)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/controls/Chip.tsx'),
      'utf8',
    )

    expect(source).not.toContain('ChipWidth')
    expect(source).not.toMatch(/^\s*width\??:/m)
    expect(source).not.toContain('w-[60px]')
  })

  it('defaults to the default tone', () => {
    const implicit = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const explicit = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="default" />,
    ).container.firstElementChild as HTMLElement

    expect(implicit.className).toBe(explicit.className)
  })

  it('draws the inverted tone differently from the default one', () => {
    const base = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const inverted = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement

    expect(inverted.className).not.toBe(base.className)
  })

  it('still renders its label in the inverted tone', () => {
    render(
      <Chip
        label="Alpha"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        tone="inverted"
      />,
    )

    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('gives the inverted tone a translucent light treatment from the tokens', () => {
    const inverted = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement

    expect(inverted.className).toMatch(/bg-on-accent\/\d+/)
    expect(inverted.className).toContain('text-on-accent')
  })

  it('separates selected from idle within the inverted tone too', () => {
    const idle = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement
    const selected = render(
      <Chip label="A" selected disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement

    expect(idle.className).not.toBe(selected.className)
  })

  it.each(['default', 'inverted'] as const)(
    'renders nothing but its label with no adornment, in the %s tone (R6, R7, AC7)',
    (tone) => {
      render(
        <Chip
          label="C"
          selected={false}
          disabled={false}
          onSelect={() => {}}
          tone={tone}
        />,
      )
      const chip = screen.getByRole('button')

      expect(chip.children).toHaveLength(0)
      expect(chip.textContent).toBe('C')
      expect(chip).toHaveAccessibleName('C')
    },
  )

  it('renders its adornment before its label (R1)', () => {
    render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        adornment={NOTE}
      />,
    )

    expect(screen.getByRole('button').textContent).toBe(`${NOTE}C`)
  })

  it('changes nothing about the chip’s own box when adorned (R8)', () => {
    const plain = render(
      <Chip label="C" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const adorned = render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        adornment={NOTE}
      />,
    ).container.firstElementChild as HTMLElement

    expect(adorned.className).toBe(plain.className)
  })

  it('keeps the accessible name to the label alone (R4, AC5)', () => {
    render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        adornment={NOTE}
      />,
    )
    const chip = screen.getByRole('button')

    expect(chip).toHaveAccessibleName('C')
    expect(screen.getByRole('button', { name: 'C' })).toBe(chip)
  })

  it('hides the adornment from the accessibility tree (R4, AC5)', () => {
    render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        adornment={NOTE}
      />,
    )
    const chip = screen.getByRole('button')
    const mark = chip.firstElementChild as HTMLElement

    expect(mark).not.toBeNull()
    expect(mark.textContent).toBe(NOTE)
    expect(mark).toHaveAttribute('aria-hidden', 'true')
  })

  it.each([
    { state: 'idle', props: { selected: false, disabled: false } },
    { state: 'selected', props: { selected: true, disabled: false } },
    { state: 'disabled', props: { selected: false, disabled: true } },
    {
      state: 'inverted',
      props: { selected: false, disabled: false, tone: 'inverted' as const },
    },
  ])('still carries its adornment when $state (R3)', ({ props }) => {
    render(<Chip label="C" onSelect={() => {}} adornment={NOTE} {...props} />)

    expect(screen.getByRole('button').textContent).toBe(`${NOTE}C`)
  })

  it('carries horizontal spacing and nothing else, so it cannot grow the row (R8, AC10)', () => {
    render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        adornment={NOTE}
      />,
    )
    const mark = screen.getByRole('button').firstElementChild as HTMLElement

    const classes = mark.className.split(/\s+/).filter(Boolean)
    expect(classes.length).toBeGreaterThan(0)
    const offenders = classes.filter((name) => !/^-?m[rlx]-/.test(name))
    expect(
      offenders,
      'the adornment may only carry horizontal margin: anything else can change the line box',
    ).toEqual([])
  })

  it('gives the adornment no colour of its own, so it inherits the ink (R9)', () => {
    render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        adornment={NOTE}
      />,
    )
    const mark = screen.getByRole('button').firstElementChild as HTMLElement

    expect(mark.className).not.toMatch(/\btext-(?!\[)/)
    expect(mark.className).not.toMatch(/\b(bg|border|fill|stroke)-/)
    expect(mark.className).not.toMatch(/\bopacity-/)
    expect(mark).not.toHaveAttribute('style')
  })

  it('is an ordinary pressable chip with no state given (R4b)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Chip label="C" selected={false} disabled={false} onSelect={onSelect} />)
    const chip = screen.getByRole('button', { name: 'C' })

    expect(chip).not.toBeDisabled()
    expect(chip).not.toHaveAttribute('aria-disabled')

    await user.click(chip)
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('reports an unavailable chip through aria-disabled without disabling it (R4, R4a, AC4, AC5a)', () => {
    render(
      <Chip label="C" selected={false} disabled={false} unavailable onSelect={() => {}} />,
    )
    const chip = screen.getByRole('button', { name: 'C' })

    expect(chip).toHaveAttribute('aria-disabled', 'true')
    expect(chip).not.toBeDisabled()
  })

  it('declines the pick and still reports the press when unavailable (R4a, AC5a)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onPress = vi.fn()
    render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        unavailable
        onSelect={onSelect}
        onPress={onPress}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'C' }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('picks before it reports the press when it is live (R4a, AC5a)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onPress = vi.fn()
    render(
      <Chip
        label="C"
        selected={false}
        disabled={false}
        onSelect={onSelect}
        onPress={onPress}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'C' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.invocationCallOrder[0]).toBeLessThan(
      onPress.mock.invocationCallOrder[0],
    )
  })

  it.each([
    { disabled: false, unavailable: false, select: 1, press: 1 },
    { disabled: false, unavailable: true, select: 0, press: 1 },
    { disabled: true, unavailable: false, select: 0, press: 0 },
    { disabled: true, unavailable: true, select: 0, press: 0 },
  ])(
    'calls onSelect $select and onPress $press times when disabled=$disabled unavailable=$unavailable (R4b, AC5b)',
    async ({ disabled, unavailable, select, press }) => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      const onPress = vi.fn()
      render(
        <Chip
          label="C"
          selected={false}
          disabled={disabled}
          unavailable={unavailable}
          onSelect={onSelect}
          onPress={onPress}
        />,
      )
      const chip = screen.getByRole('button', { name: 'C' })
      if (disabled) expect(chip).toBeDisabled()

      await user.click(chip)

      expect(onSelect).toHaveBeenCalledTimes(select)
      expect(onPress).toHaveBeenCalledTimes(press)
    },
  )

  it('never derives one lock from the other (R4b)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/controls/Chip.tsx'),
      'utf8',
    )

    expect(source).toContain('disabled={disabled}')
    expect(
      source,
      'the native disabled attribute may never be fed by unavailable; aria-disabled is a different attribute and is exempt',
    ).not.toMatch(/(?<!aria-)disabled=\{[^}]*unavailable/)
    expect(source).not.toMatch(/unavailable\s*(\|\||&&|\?\?)\s*disabled/)
    expect(source).not.toMatch(/disabled\s*(\|\||&&|\?\?)\s*unavailable/)
  })

  it('draws an unavailable chip apart from an idle and a locked one (R4, R5, R20, AC4, AC19)', () => {
    const chipWith = (props: Partial<Parameters<typeof Chip>[0]>) =>
      render(
        <Chip
          label="C"
          selected={false}
          disabled={false}
          onSelect={() => {}}
          {...props}
        />,
      ).container.firstElementChild as HTMLButtonElement
    const treatment = (chip: HTMLButtonElement) =>
      `${chip.className}|${chip.disabled}`

    const idle = chipWith({})
    const unavailable = chipWith({ unavailable: true })
    const locked = chipWith({ disabled: true })
    const lockedOut = chipWith({ disabled: true, unavailable: true })

    expect(
      new Set([idle, unavailable, locked].map(treatment)).size,
      'idle, unavailable and locked must be three distinguishable treatments',
    ).toBe(3)
    expect(unavailable.className).not.toBe(idle.className)
    expect(unavailable.className).not.toBe(locked.className)
    expect(
      lockedOut.className,
      'a finished row must still show which chips were ruled out during play',
    ).not.toBe(locked.className)
  })

  it('leaves the adornment untouched when unavailable (R4c, AC5c)', () => {
    const mark = (props: Partial<Parameters<typeof Chip>[0]>) => {
      const chip = render(
        <Chip
          label="C"
          selected={false}
          disabled={false}
          onSelect={() => {}}
          adornment={NOTE}
          {...props}
        />,
      ).container.firstElementChild as HTMLElement
      return { chip, mark: chip.firstElementChild as HTMLElement }
    }

    const available = mark({})
    const unavailable = mark({ unavailable: true })

    expect(unavailable.chip.textContent).toBe(`${NOTE}C`)
    expect(unavailable.mark.className).toBe(available.mark.className)
    expect(unavailable.mark.className).not.toMatch(/\btext-(?!\[)/)
    expect(unavailable.mark.className).not.toMatch(/\b(bg|border|fill|stroke)-/)
    expect(unavailable.mark.className).not.toMatch(/\bopacity-/)
  })
})
