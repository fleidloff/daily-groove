import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from './Chip'

// A decorative glyph, used as any caller's string would be. The primitive knows
// nothing about what it means.
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

  // Step A1 — R6, AC7. The grid cell the chip sits in owns the width now, so
  // the chip carries neither the 60px cap nor the padding reset that came with
  // it, and it can no longer be asked for either.
  it('leaves its width to the cell it sits in (R6, AC7)', () => {
    const chip = render(
      <Chip label="C" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement

    expect(chip.className).not.toContain('w-[60px]')
    expect(chip.className).not.toMatch(/\bpx-0\b/)
    expect(chip.className).not.toMatch(/\bw-\[/)
  })

  // AC7 is about the prop surface, not about a rendered class, so it is read
  // off the module the way the structural tests read the tree.
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

  // --- Step A1 — a chip with no adornment is unchanged (R6, R7, AC7) -------
  //
  // The regression guard for the whole track: it passes today, and it is what
  // proves the new prop acquired no default. `SolvedPanel` renders inverted
  // chips with no adornment, which is why both tones are asserted.

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

  // --- Step A2 — the adornment renders before the label (R1, R8) -----------

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

  // --- Step A3 — the adornment is hidden from assistive tech (R4, AC5) -----

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

  // --- Step A4 — it survives every chip state (R3, R9) ---------------------

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

  /**
   * R8/AC10: the root row must stay the same height as the unadorned mode row
   * beside it. The two tests above prove the button and the grid are untouched,
   * which leaves the span itself as the only thing that could grow the line box
   * — and the colour test below cannot see that, because it exempts Tailwind's
   * arbitrary-value syntax, so a `text-[20px]` would slip straight through it.
   *
   * An allowlist rather than a blocklist: anything that is not horizontal
   * spacing is refused, so a metric nobody thought of is refused too.
   */
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
})
