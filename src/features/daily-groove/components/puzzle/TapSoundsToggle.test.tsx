import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TapSoundsToggle } from './TapSoundsToggle'

describe('TapSoundsToggle', () => {
  // --- Step D1: a switch that says what it switches (R1, R13, R14, AC12) ----

  it('is a switch whose name says what it switches (R1, AC12)', () => {
    render(<TapSoundsToggle on onChange={vi.fn()} />)

    expect(
      screen.getByRole('switch', { name: /tap sounds/i }),
    ).toBeInTheDocument()
  })

  it('reads checked when the sounds are on (R1)', () => {
    render(<TapSoundsToggle on onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('reads unchecked when the sounds are off (R1)', () => {
    render(<TapSoundsToggle on={false} onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('reports the state it is asking for, not the one it is in (R1, R13)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TapSoundsToggle on={false} onChange={onChange} />)

    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('asks to turn the sounds off when they are already on (R1, R13)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TapSoundsToggle on onChange={onChange} />)

    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('holds no state of its own — the prop is the only truth (R1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TapSoundsToggle on={false} onChange={onChange} />)

    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('switch'))

    // A control that had latched locally would ask for `false` the second time.
    expect(onChange).toHaveBeenNthCalledWith(1, true)
    expect(onChange).toHaveBeenNthCalledWith(2, true)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('is reachable by keyboard (R13, AC12)', async () => {
    const user = userEvent.setup()
    render(<TapSoundsToggle on={false} onChange={vi.fn()} />)

    await user.tab()

    expect(screen.getByRole('switch')).toHaveFocus()
  })

  it('is operable by the space key (R13, AC12)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TapSoundsToggle on={false} onChange={onChange} />)

    await user.tab()
    await user.keyboard(' ')

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is operable by the enter key (R13, AC12)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TapSoundsToggle on={false} onChange={onChange} />)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('never submits a form by accident (R13)', () => {
    render(<TapSoundsToggle on onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('type', 'button')
  })

  // --- Step D2: it has no way to be locked (R5a) ----------------------------

  /**
   * R5a made structural rather than defaulted: the switch is a durable
   * preference, not a record of how the day was played, and the guess card is
   * the only place it can be changed — so it stays live once the day ends.
   *
   * A default of `false` would be one prop away from being locked by a later
   * edit, so the rule asserted here is that the prop *cannot exist*. That is a
   * fact about the source rather than about a render, so it is read from disk
   * the way `structure.test.ts` reads `PlayControl`'s prop list.
   */
  it('declares no way to be locked, so a later edit cannot lock it (R5a)', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/features/daily-groove/components/puzzle/TapSoundsToggle.tsx',
      ),
      'utf8',
    )

    expect(source).not.toMatch(/^\s{2}disabled\??:/m)
    expect(source).not.toContain('disabled=')
  })

  it('is enabled with nothing said about the day being over (R5a, AC11b)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TapSoundsToggle on onChange={onChange} />)

    expect(screen.getByRole('switch')).toBeEnabled()
    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(false)
  })
})
