import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders its children', () => {
    render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        Continue
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('is a type="button" so it never submits a form', () => {
    render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        Go
      </Button>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('calls onPress once when pressed', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(
      <Button onPress={onPress} disabled={false} tone="ready">
        Go
      </Button>,
    )

    await user.click(screen.getByRole('button', { name: 'Go' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('blocks onPress and sets the disabled attribute while disabled', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(
      <Button onPress={onPress} disabled tone="idle">
        Not ready yet
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Not ready yet' })
    expect(button).toBeDisabled()
    await user.click(button)

    expect(onPress).not.toHaveBeenCalled()
  })

  it('gives the three tones distinct class strings', () => {
    const classOf = (tone: 'idle' | 'ready' | 'solved') =>
      (
        render(
          <Button onPress={() => {}} disabled={false} tone={tone}>
            Go
          </Button>,
        ).container.firstElementChild as HTMLElement
      ).className

    const idle = classOf('idle')
    const ready = classOf('ready')
    const solved = classOf('solved')

    expect(new Set([idle, ready, solved]).size).toBe(3)
  })

  it('spans the full width of its container', () => {
    const { container } = render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        Go
      </Button>,
    )
    expect((container.firstElementChild as HTMLElement).className).toContain('w-full')
  })

  it('takes its accessible name from label while keeping its visible text (A0, R5, AC4)', () => {
    render(
      <Button label="Play the loop" onPress={() => {}} disabled={false} tone="ready">
        ▶ Play the loop
      </Button>,
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAccessibleName('Play the loop')
    expect(button).toHaveTextContent('▶ Play the loop')
  })

  it('renders today\'s geometry when no size is given (A1, R1, AC1)', () => {
    const { container } = render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        Go
      </Button>,
    )

    const className = (container.firstElementChild as HTMLElement).className

    for (const utility of ['py-[15px]', 'text-[15px]', 'w-full', 'rounded-control', 'px-4']) {
      expect(className).toContain(utility)
    }
  })

  it('swaps only the two size utilities at the large size (A2, R2, AC2)', () => {
    const classOf = (size?: 'md' | 'lg') =>
      (
        render(
          <Button onPress={() => {}} disabled={false} tone="ready" size={size}>
            Go
          </Button>,
        ).container.firstElementChild as HTMLElement
      ).className

    const large = classOf('lg')

    expect(large).toContain('py-[22px]')
    expect(large).toContain('text-[17px]')
    expect(large).not.toContain('py-[15px]')
    expect(large).not.toContain('text-[15px]')

    // Everything that is not size — radius, tones, focus ring — is identical,
    // checked by stripping the size utilities rather than listing the rest.
    const withoutSize = (classes: string) =>
      classes
        .split(/\s+/)
        .filter(
          (utility) =>
            !['py-[15px]', 'text-[15px]', 'py-[22px]', 'text-[17px]'].includes(utility),
        )
        .sort()
        .join(' ')

    expect(withoutSize(large)).toBe(withoutSize(classOf()))
  })

  it('disables at the large size exactly as it does at the default (A3, R2, AC3)', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    const { container } = render(
      <Button onPress={onPress} disabled tone="idle" size="lg">
        Not ready yet
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Not ready yet' })
    expect(button).toBeDisabled()
    expect((container.firstElementChild as HTMLElement).className).toContain(
      'disabled:cursor-default',
    )

    await user.click(button)

    expect(onPress).not.toHaveBeenCalled()
  })

  it('falls back to its children for the accessible name when label is omitted (A0, R5)', () => {
    render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        ▶ Play the loop
      </Button>,
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAccessibleName('▶ Play the loop')
    expect(button).not.toHaveAttribute('aria-label')
  })

  // R3 / AC10 — "the size names no domain concept" — is enforced repo-wide by
  // `src/app/globals.test.ts` guard I5, which reads every design-system file,
  // tests included, against a domain-vocabulary pattern. A local version here
  // would have to name the banned words to ban them, which is itself the leak
  // I5 catches. One guard, in the place that already owns the rule.
})
