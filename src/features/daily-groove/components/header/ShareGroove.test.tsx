import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShareGroove } from './ShareGroove'
import type { Groove } from '../../types'

/**
 * The control that hands the player this groove's link (F12 E2, Steps C1–C3).
 *
 * Both browser capabilities are injected — `deps` and `origin` are props — so
 * nothing here shims `navigator` or `window.location`, and every one of the four
 * outcomes is reachable by passing a different pair of functions. The decision
 * itself is `lib/share/share.ts`'s and is tested there; what is under test here
 * is only what the player sees for each outcome.
 */

const GROOVE: Groove = {
  id: 'groove-07',
  uuid: '61607a6c-3f9e-4fd7-9724-99ea22d32e4a',
  audioSrc: '/grooves/groove-07.mp3',
  name: 'Test Groove',
  bpm: 96,
  root: 'F♯',
  flavour: 'Dorian',
  bars: 4,
  scale: 'F♯ Dorian',
  chord: 'F♯m7',
  progression: 'F♯m–Bm–C♯7',
  headDelaySeconds: 0.025057,
}

const ORIGIN = 'https://x.test'
const LINK = `${ORIGIN}/groove/${GROOVE.uuid}`

const shareControl = () => screen.getByRole('button', { name: 'Share' })
const liveRegion = () => document.querySelector('[aria-live="polite"]')

/** Let the awaited share decision settle and the state it sets paint. */
async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

/**
 * Press the control under fake timers.
 *
 * `fireEvent` rather than `userEvent` in the three tests below, and only there:
 * `userEvent` schedules waits of its own on the timers being faked, and the two
 * deadlock. What those tests are about is the *clock* — a confirmation that
 * clears itself two seconds later — and the press is incidental. That the
 * control answers to a real keyboard is asserted separately, on real timers,
 * which is where an assertion about keyboard operation belongs anyway.
 */
async function press() {
  await act(async () => {
    fireEvent.click(shareControl())
  })
  await settle()
}

afterEach(() => {
  vi.useRealTimers()
})

describe('ShareGroove (F12 E2)', () => {
  // --- Step C1 — pressing share offers this groove's link ------------------

  it("offers this groove's link, and the same one every time (R3, R8, AC2)", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    expect(share).toHaveBeenCalledTimes(1)
    expect(share).toHaveBeenCalledWith({ url: LINK })

    await user.click(shareControl())
    await settle()

    // Same groove, same link — the second press is not a new URL.
    expect(share).toHaveBeenCalledTimes(2)
    expect(share.mock.calls[1][0]).toEqual({ url: LINK })
  })

  it('gives the link nothing about the answer to carry (R7, AC3)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    const offered = (share.mock.calls[0][0] as { url: string }).url
    expect(offered).toBe(`${ORIGIN}/groove/${GROOVE.uuid}`)
    for (const secret of [
      GROOVE.root,
      GROOVE.flavour,
      GROOVE.scale,
      GROOVE.chord,
      GROOVE.progression,
      GROOVE.name,
      GROOVE.id,
    ]) {
      expect(offered).not.toContain(secret)
    }
  })

  it("reads the page's own origin when none is given (R3)", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    // The origin is read at press time, not at render: a page rendered on the
    // server has none.
    expect(share).toHaveBeenCalledWith({
      url: `${window.location.origin}/groove/${GROOVE.uuid}`,
    })
  })

  it('shows nothing extra when the sheet took the link (R14)', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share }} />)

    await user.click(shareControl())
    await settle()

    // The sheet opening is the confirmation.
    expect(screen.queryByText('Link copied')).toBeNull()
    expect(screen.queryByText(LINK)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  // --- Step C2 — copying confirms itself, and the confirmation clears ------

  it('copies the link from the keyboard alone, and announces it (R6, R14, AC5, AC9)', async () => {
    const user = userEvent.setup()
    const write = vi.fn().mockResolvedValue(undefined)
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />)

    // The live region is on the page before there is anything to say, which is
    // what lets a screen reader announce the change rather than a new node.
    expect(liveRegion()).not.toBeNull()

    // Keyboard only: tab to it and press Enter (AC9).
    await user.tab()
    expect(shareControl()).toHaveFocus()
    await user.keyboard('{Enter}')
    await settle()

    expect(write).toHaveBeenCalledWith(LINK)
    const confirmation = screen.getByText('Link copied')
    expect(confirmation.closest('[aria-live="polite"]')).not.toBeNull()

    // Still focused, still named the same, and it answers again.
    expect(shareControl()).toHaveFocus()
    expect(shareControl()).toHaveAccessibleName('Share')
    await user.keyboard('{Enter}')
    await settle()
    expect(write).toHaveBeenCalledTimes(2)
  })

  it('clears the confirmation on its own, without a second press (R14, AC5)', async () => {
    vi.useFakeTimers()
    const write = vi.fn().mockResolvedValue(undefined)
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />)

    await press()
    expect(screen.getByText('Link copied')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(2500)
    })

    expect(screen.queryByText('Link copied')).toBeNull()
    // The live region stays on the page, empty, ready to say it again.
    expect(liveRegion()).not.toBeNull()
    expect(shareControl()).toBeInTheDocument()

    await press()
    expect(screen.getByText('Link copied')).toBeInTheDocument()
  })

  it('leaves no timer behind when it is unmounted mid-confirmation (R6)', async () => {
    vi.useFakeTimers()
    const write = vi.fn().mockResolvedValue(undefined)
    const view = render(
      <ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />,
    )

    await press()
    expect(screen.getByText('Link copied')).toBeInTheDocument()

    view.unmount()

    // The pending clear is cancelled, so nothing sets state on a gone tree.
    expect(vi.getTimerCount()).toBe(0)
  })

  // --- Step C3 — the last resort shows the URL -----------------------------

  it('hands the URL over when the clipboard refuses (R11, R13, AC6)', async () => {
    const user = userEvent.setup()
    const write = vi.fn().mockRejectedValue(new Error('denied'))
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ write }} />)

    await user.click(shareControl())
    await settle()

    const shown = screen.getByText(LINK)
    expect(shown).toBeInTheDocument()
    // Selectable by construction: one click takes the whole URL, because the
    // player has to copy it by hand.
    expect(shown.className).toContain('select-all')
    // A link the player can still copy is not an error (R13).
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('hands the URL over when the browser offers nothing at all (R11, AC6)', async () => {
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{}} />)

    await user.click(shareControl())
    await settle()

    expect(screen.getByText(LINK)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('keeps the offered URL on screen instead of clearing it (R11)', async () => {
    vi.useFakeTimers()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{}} />)

    await press()
    expect(screen.getByText(LINK)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(10_000)
    })

    // It persists: a confirmation may vanish, a link you have to read may not.
    expect(screen.getByText(LINK)).toBeInTheDocument()
  })

  // --- The dismissed sheet, which is not a failure -------------------------

  it('says nothing at all when the sheet is dismissed (R12, AC7)', async () => {
    const user = userEvent.setup()
    const share = vi
      .fn()
      .mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    const write = vi.fn().mockResolvedValue(undefined)
    render(
      <ShareGroove groove={GROOVE} origin={ORIGIN} deps={{ share, write }} />,
    )

    await user.click(shareControl())
    await settle()

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Link copied')).toBeNull()
    expect(screen.queryByText(LINK)).toBeNull()
    // Nothing was copied behind the player's back, either.
    expect(write).not.toHaveBeenCalled()

    // And the control is back at rest, ready to be pressed again.
    expect(shareControl()).toBeEnabled()
    await user.click(shareControl())
    await settle()
    expect(share).toHaveBeenCalledTimes(2)
  })

  // --- The label, which never changes (R2) --------------------------------

  it('says "Share" whatever has just happened (R2, AC1)', async () => {
    const user = userEvent.setup()
    render(<ShareGroove groove={GROOVE} origin={ORIGIN} deps={{}} />)

    expect(shareControl()).toHaveAccessibleName('Share')
    await user.click(shareControl())
    await settle()

    // After the URL has been handed over, the control still says the one thing
    // it does.
    expect(shareControl()).toHaveAccessibleName('Share')
  })
})
