import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InlineButton } from './InlineButton'

describe('InlineButton', () => {
  it('renders a button whose accessible name is its children (A1, R1c, AC12)', () => {
    render(<InlineButton onPress={() => {}}>Send</InlineButton>)

    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('type', 'button')
    expect(button).not.toHaveAttribute('aria-label')
  })

  it('calls onPress once when clicked (A1, R1c, AC12)', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(<InlineButton onPress={onPress}>Send</InlineButton>)

    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('is reachable by keyboard and calls onPress on Enter (A1, R1c, AC12)', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(<InlineButton onPress={onPress}>Send</InlineButton>)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Send' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('takes its accessible name from label while keeping its visible text (A1, R1c, AC12)', () => {
    render(
      <InlineButton label="Send this to a friend" onPress={() => {}}>
        ↗ Send
      </InlineButton>,
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAccessibleName('Send this to a friend')
    expect(button).toHaveTextContent('↗ Send')
  })

  it('blocks onPress and sets the disabled attribute while disabled (A1, R1c, AC12)', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(
      <InlineButton onPress={onPress} disabled>
        Send
      </InlineButton>,
    )

    const button = screen.getByRole('button', { name: 'Send' })
    expect(button).toBeDisabled()
    await user.click(button)

    expect(onPress).not.toHaveBeenCalled()
  })

  it('is enabled when disabled is omitted (A1, R1c)', () => {
    render(<InlineButton onPress={() => {}}>Send</InlineButton>)

    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('hugs its label instead of spanning its container (A1, R1c)', () => {
    const { container } = render(<InlineButton onPress={() => {}}>Send</InlineButton>)

    const className = (container.firstElementChild as HTMLElement).className
    expect(className).not.toContain('w-full')
    expect(className).toContain('inline-flex')
  })

  it('wears the design system radius, focus ring and disabled treatment (A1, R1c)', () => {
    const { container } = render(<InlineButton onPress={() => {}}>Send</InlineButton>)

    const className = (container.firstElementChild as HTMLElement).className
    for (const utility of [
      'rounded-control',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-accent',
      'disabled:cursor-default',
    ]) {
      expect(className).toContain(utility)
    }
  })
})
